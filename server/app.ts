/** HTTP API. Every AI answer is re-validated and sanitized before it reaches the browser. */
import { Hono, type Context } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';
import type { AIProvider } from './ai/provider';
import { ProviderError } from './ai/provider';
import { explainSystem, userParts } from './ai/prompts';
import { validateImage } from './lib/image';
import { RateLimiter } from './lib/ratelimit';
import { YouTubeSearch, VideoError, searchUrl } from './video/youtube';
import type { Store } from './store';
import type { AppConfig } from './config';
import { LANGUAGES, sanitizeExplanation, type LanguageCode } from '../shared/scene';
import { modelJsonSchema } from './ai/schema';

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://i.ytimg.com",
  "font-src 'self' data:",
  "connect-src 'self'",
  'frame-src https://www.youtube-nocookie.com',
  "worker-src 'self' blob:",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export function createApp(deps: { ai: AIProvider; video: YouTubeSearch; store: Store; config: AppConfig }) {
  const { ai, video, store, config } = deps;
  const app = new Hono();
  const explainLimit = new RateLimiter(12, 10 * 60_000);
  const videoLimit = new RateLimiter(40, 10 * 60_000);
  const shareLimit = new RateLimiter(30, 10 * 60_000);
  const schema = modelJsonSchema();

  const ip = (c: Context) => {
    const fwd = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
    if (fwd) return fwd;
    try { return getConnInfo(c).remote.address ?? 'local'; } catch { return 'local'; }
  };
  const err = (c: Context, status: number, code: string, message: string, extra: object = {}) => c.json({ error: { code, message, ...extra } }, status as any);

  app.use('*', async (c, next) => {
    await next();
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
    if (!c.req.path.startsWith('/api/')) c.header('Content-Security-Policy', CSP);
    else c.header('Cache-Control', 'no-store');
  });

  app.get('/api/health', (c) => c.json({
    ok: true,
    ai: { configured: ai.configured, provider: ai.name, model: ai.model },
    video: { configured: video.configured, provider: video.configured ? 'YouTube Data API' : 'YouTube search link' },
  }));

  app.post('/api/explain', async (c) => {
    if (!ai.configured) return err(c, 503, 'not_configured', 'AI is not set up on this server yet. The site owner needs to add GEMINI_API_KEY. You can still explore the example models.');
    const wait = explainLimit.take(ip(c));
    if (wait) return err(c, 429, 'rate_limited', `Too many diagrams in a short time. Try again in ${Math.ceil(wait / 60)} min.`);
    let form: FormData;
    try { form = await c.req.formData(); } catch { return err(c, 400, 'bad_form', 'Add a photo or type your question.'); }
    const rawNote = form.get('note');
    const note = typeof rawNote === 'string' && rawNote.trim() ? rawNote.trim().slice(0, 1500) : null;
    const file = form.get('image');
    let image: { mime: string; base64: string } | null = null;
    if (file instanceof File && file.size > 0) {
      if (file.size > config.limits.uploadBytes) return err(c, 413, 'too_large', `Images must be ${Math.round(config.limits.uploadBytes / 1048576)} MB or smaller.`);
      const buf = new Uint8Array(await file.arrayBuffer());
      const v = validateImage(buf, config.limits);
      if (!v.ok) return err(c, 400, v.code, v.message);
      image = { mime: v.info.mime, base64: Buffer.from(buf).toString('base64') };
    }
    if (!image && (!note || note.length < 3)) return err(c, 400, 'no_input', 'Add a photo or type your question.');
    const rawLang = form.get('lang');
    const lang: LanguageCode = typeof rawLang === 'string' && rawLang in LANGUAGES ? (rawLang as LanguageCode) : 'en';
    const rawGrade = Number(form.get('grade'));
    const grade = Number.isInteger(rawGrade) && rawGrade >= 1 && rawGrade <= 12 ? rawGrade : null;

    let raw: unknown;
    const t0 = Date.now();
    const log = (outcome: string) => console.log(`[explain] ${outcome} in ${((Date.now() - t0) / 1000).toFixed(1)}s (model ${(ai as any).lastModel ?? ai.model}, lang ${lang})`);
    try {
      raw = await ai.generateJSON({
        system: explainSystem(lang, grade),
        parts: [...(image ? [{ image }] : []), { text: userParts(note, Boolean(image)) }],
        schema,
        temperature: 0.4,
        maxOutputTokens: 16_000,
      });
    } catch (e) {
      log(`failed: ${(e as Error).message}`);
      if (e instanceof ProviderError) {
        const status = e.kind === 'quota' ? 429 : e.kind === 'timeout' ? 504 : e.kind === 'blocked' ? 422 : 502;
        return err(c, status, `ai_${e.kind}`, e.message);
      }
      console.error('explain failed', e);
      return err(c, 500, 'internal', 'Something went wrong while explaining the diagram.');
    }
    const s = sanitizeExplanation(raw);
    if (s.ok && s.explanation.grade == null) s.explanation.grade = grade;
    if (!s.ok) { log(`not understood: ${s.reason}`); return err(c, 422, 'not_understood', s.reason); }
    log(`ok: "${s.explanation.title}", ${s.explanation.scene.objects.length} shapes`);
    const bad = s.explanation.homework?.checks.filter((k) => k.ok === false) ?? [];
    if (bad.length) s.explanation.warnings.unshift(`Double-check: the app recalculated ${bad.map((k) => k.label).join(', ')} and got a different number than the AI. See the answer check below.`);
    if (s.dropped) s.explanation.warnings.push(`${s.dropped} shape${s.dropped === 1 ? ' was' : 's were'} left out of the 3D model because ${s.dropped === 1 ? 'it was' : 'they were'} invalid.`);
    return c.json({ explanation: s.explanation, model: (ai as any).lastModel ?? ai.model, lang });
  });

  app.get('/api/videos', async (c) => {
    const q = (c.req.query('q') ?? '').replace(/\s+/g, ' ').trim().slice(0, 100);
    if (!q) return err(c, 400, 'no_query', 'Missing search query.');
    const lang = c.req.query('lang') ?? 'en';
    const link = searchUrl(q);
    if (!video.configured) return c.json({ configured: false, videos: [], searchUrl: link });
    const wait = videoLimit.take(ip(c));
    if (wait) return err(c, 429, 'rate_limited', 'Too many video searches. Try again in a few minutes.', { searchUrl: link });
    try {
      const videos = await video.search(q, lang in LANGUAGES ? lang : 'en');
      return c.json({ configured: true, videos, searchUrl: link });
    } catch (e) {
      const k = e instanceof VideoError ? e.kind : 'unavailable';
      return err(c, k === 'quota' ? 429 : 502, `video_${k}`, e instanceof VideoError ? e.message : 'Video search failed.', { searchUrl: link });
    }
  });

  app.post('/api/shares', async (c) => {
    const wait = shareLimit.take(ip(c));
    if (wait) return err(c, 429, 'rate_limited', 'Too many share links. Try again later.');
    const text = await c.req.text();
    if (text.length > config.limits.shareBytes) return err(c, 413, 'too_large', 'This model is too large to share.');
    let body: any;
    try { body = JSON.parse(text); } catch { return err(c, 400, 'bad_json', 'Invalid share data.'); }
    const s = sanitizeExplanation(body?.explanation);
    if (!s.ok) return err(c, 400, 'bad_share', 'Invalid share data.');
    const id = await store.put(JSON.stringify({ explanation: s.explanation, createdAt: new Date().toISOString() }));
    const base = config.publicUrl || new URL(c.req.url).origin;
    return c.json({ id, url: `${base}/s/${id}` });
  });

  app.get('/api/shares/:id', async (c) => {
    const json = await store.get(c.req.param('id'));
    if (!json) return err(c, 404, 'not_found', 'This shared model does not exist or was removed.');
    return c.body(json, 200, { 'Content-Type': 'application/json' });
  });

  app.all('/api/*', (c) => err(c, 404, 'not_found', 'Unknown API route.'));
  return app;
}
