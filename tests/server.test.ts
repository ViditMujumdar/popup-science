import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import type { Server } from 'node:http';
import { createApp } from '../server/app';
import { GeminiProvider } from '../server/ai/gemini';
import { YouTubeSearch, parseDuration } from '../server/video/youtube';
import { createStore } from '../server/store';
import { config as baseConfig } from '../server/config';
import { type AIProvider, ProviderError, type GenerateJSONRequest } from '../server/ai/provider';
import { makePng } from './helpers';
import { HEART, startMock } from '../scripts/mock-upstream.mjs';

class FakeAI implements AIProvider {
  name = 'Fake'; model = 'fake-1'; configured = true;
  next: unknown = HEART; error: ProviderError | null = null; last: GenerateJSONRequest | null = null;
  async generateJSON(req: GenerateJSONRequest) { this.last = req; if (this.error) throw this.error; return this.next; }
  async probe() {}
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-test-'));
const cfg = { ...baseConfig, dataDir: tmp, publicUrl: 'https://pop.example' };
const noVideo = () => new YouTubeSearch({ apiKey: '', baseUrl: 'http://127.0.0.1:1', timeoutMs: 300 });
async function setup(ai: AIProvider, video = noVideo()) {
  const store = await createStore(fs.mkdtempSync(path.join(tmp, 's-')));
  return createApp({ ai, video, store, config: cfg });
}
const form = (buf: Buffer, extra: Record<string, string> = {}) => { const f = new FormData(); f.append('image', new File([new Uint8Array(buf)], 'd.png', { type: 'image/png' })); for (const [k, v] of Object.entries(extra)) f.append(k, v); return f; };
let mock: Server;
const MOCK = 'http://127.0.0.1:8897';
beforeAll(async () => { mock = await startMock(8897); });
afterAll(() => mock.close());

describe('/api/explain', () => {
  it('returns a sanitized explanation and sends the image + schema + language to the AI', async () => {
    const ai = new FakeAI(); const app = await setup(ai);
    const res = await app.request('/api/explain', { method: 'POST', body: form(makePng(400, 300), { note: 'heart diagram', lang: 'hi' }) });
    expect(res.status).toBe(200);
    const j: any = await res.json();
    expect(j.explanation.scene.objects).toHaveLength(3);
    expect(j.explanation.warnings.join(' ')).toMatch(/2 shapes were left out/);
    expect(j.lang).toBe('hi');
    expect(ai.last!.system).toMatch(/Hindi/);
    expect(ai.last!.parts.some((p) => 'image' in p)).toBe(true);
    expect(JSON.stringify(ai.last!.parts)).toContain('heart diagram');
    expect((ai.last!.schema as any).properties.objects).toBeTruthy();
  });
  it('rejects non-images, tiny images and missing files', async () => {
    const app = await setup(new FakeAI());
    const bad = new FormData(); bad.append('image', new File([Buffer.from('<?php echo 1; ?>'.padEnd(80))], 'x.png', { type: 'image/png' }));
    expect((await app.request('/api/explain', { method: 'POST', body: bad })).status).toBe(400);
    expect((await app.request('/api/explain', { method: 'POST', body: form(makePng(100, 100)) })).status).toBe(400);
    expect((await app.request('/api/explain', { method: 'POST', body: new FormData() })).status).toBe(400);
  });
  it('maps "not a diagram" to 422 with the AI reason', async () => {
    const ai = new FakeAI(); ai.next = { understood: false, notUnderstoodReason: 'This is a photo of a cat.' };
    const res = await (await setup(ai)).request('/api/explain', { method: 'POST', body: form(makePng(400, 300)) });
    expect(res.status).toBe(422);
    expect(((await res.json()) as any).error.message).toBe('This is a photo of a cat.');
  });
  it('maps provider quota errors to 429 with an honest message', async () => {
    const ai = new FakeAI(); ai.error = new ProviderError('quota', 'The AI usage limit for this server’s key has been reached.', 429);
    const res = await (await setup(ai)).request('/api/explain', { method: 'POST', body: form(makePng(400, 300)) });
    expect(res.status).toBe(429);
    expect(((await res.json()) as any).error.code).toBe('ai_quota');
  });
  it('says AI is not configured instead of failing silently', async () => {
    const ai = new FakeAI(); ai.configured = false;
    const res = await (await setup(ai)).request('/api/explain', { method: 'POST', body: form(makePng(400, 300)) });
    expect(res.status).toBe(503);
  });
});

describe('/api/explain homework mode', () => {
  it('accepts a typed question without a photo and writes for the chosen class', async () => {
    const ai = new FakeAI();
    ai.next = { understood: true, kind: 'homework', grade: null, title: 'Sharing sweets', subject: 'mathematics', topic: 'Division', summary: 's', descriptionMarkdown: 'd', parts: [], steps: [{ title: 'Divide', text: '24 ÷ 6 = 4', focus: null }], keyTerms: [], funFact: null, objects: [],
      homework: { question: '24 sweets shared by 6 children?', hints: ['Share equally'], answerMarkdown: '4 sweets each', checks: [{ label: 'Each', expression: '24/6', claimed: 5 }], practice: [] }, videoQuery: 'division class 3', warnings: [] };
    const f = new FormData(); f.append('note', '24 sweets are shared equally by 6 children. How many does each get?'); f.append('grade', '3');
    const res = await (await setup(ai)).request('/api/explain', { method: 'POST', body: f });
    expect(res.status).toBe(200);
    const j: any = await res.json();
    expect(ai.last!.parts.some((p) => 'image' in p)).toBe(false);
    expect(ai.last!.system).toMatch(/Class 3/);
    expect(j.explanation.grade).toBe(3);
    expect(j.explanation.homework.checks[0]).toMatchObject({ computed: 4, ok: false });
    expect(j.explanation.warnings[0]).toMatch(/Double-check/);
  });
  it('needs a photo or a question', async () => {
    const f = new FormData(); f.append('note', 'hi');
    expect((await (await setup(new FakeAI())).request('/api/explain', { method: 'POST', body: f })).status).toBe(400);
  });
});

describe('Gemini adapter (real HTTP contract against a local mock)', () => {
  it('sends image inline + JSON schema (array-length keywords stripped) and falls back on 429', async () => {
    const ai = new GeminiProvider({ apiKey: 'test', model: 'main-model', fallbackModel: 'lite-model', baseUrl: MOCK, timeoutMs: 5000 });
    const app = await setup(ai);
    await fetch(`${MOCK}/__fail`, { method: 'POST', body: '1' });
    const res = await app.request('/api/explain', { method: 'POST', body: form(makePng(400, 300)) });
    expect(res.status).toBe(200);
    const j: any = await res.json();
    expect(j.model).toBe('lite-model');
    const last: any = await (await fetch(`${MOCK}/__last`)).json();
    expect(last.hadImage).toBe(true);
    expect(last.hasSchema).toBe(true);
    expect(last.url).toContain('lite-model');
    expect(last.system).toContain('Pop-Up Science');
  });
});

describe('Gemini adapter: slow main model', () => {
  it('switches to the fallback when the main model is too slow, then skips the main model for a while', async () => {
    const ai = new GeminiProvider({ apiKey: 'test', model: 'main-model', fallbackModel: 'lite-model', baseUrl: MOCK, timeoutMs: 5000, mainTimeoutMs: 400 });
    const app = await setup(ai);
    await fetch(`${MOCK}/__slow`, { method: 'POST', body: '1' });
    const t0 = Date.now();
    const r1: any = await (await app.request('/api/explain', { method: 'POST', body: form(makePng(400, 300)) })).json();
    expect(r1.model).toBe('lite-model');
    expect(Date.now() - t0).toBeLessThan(1400); // did not wait for the slow main model
    const r2: any = await (await app.request('/api/explain', { method: 'POST', body: form(makePng(400, 300)) })).json();
    expect(r2.model).toBe('lite-model'); // cooldown: straight to the fallback
    const last: any = await (await fetch(`${MOCK}/__last`)).json();
    expect(last.url).toContain('lite-model');
  });
});

describe('/api/videos', () => {
  it('without a YouTube key returns an honest search link and no invented videos', async () => {
    const res = await (await setup(new FakeAI())).request('/api/videos?q=convex%20lens%20class%2010');
    const j: any = await res.json();
    expect(j).toEqual({ configured: false, videos: [], searchUrl: 'https://www.youtube.com/results?search_query=convex%20lens%20class%2010' });
  });
  it('with a key returns real search results, ranked, Shorts removed, HTML entities decoded', async () => {
    const video = new YouTubeSearch({ apiKey: 'k', baseUrl: MOCK, timeoutMs: 3000 });
    const res = await (await setup(new FakeAI(), video)).request('/api/videos?q=heart');
    const j: any = await res.json();
    expect(j.configured).toBe(true);
    expect(j.videos.map((v: any) => v.id)).toEqual(['aaaaaaaaaaa', 'dQw4w9WgXcQ']); // 45 s Short removed, trusted channel first
    expect(j.videos[0].trusted).toBe(true);
    expect(j.videos[0].title).toBe('Heart lesson 2 & circulation');
    expect(j.videos[0].durationSec).toBe(492);
    expect(j.videos[0].thumbnail).toMatch(/^https:\/\/i\.ytimg\.com\//);
  });
  it('parses ISO-8601 durations', () => { expect(parseDuration('PT1H2M3S')).toBe(3723); expect(parseDuration('PT45S')).toBe(45); expect(parseDuration('bad')).toBeNull(); });
  it('requires a query', async () => { expect((await (await setup(new FakeAI())).request('/api/videos')).status).toBe(400); });
});

describe('/api/shares', () => {
  it('stores a sanitized copy and returns a public link', async () => {
    const app = await setup(new FakeAI());
    const res = await app.request('/api/shares', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ explanation: { ...HEART, scene: { objects: HEART.objects } } }) });
    expect(res.status).toBe(200);
    const { id, url } = (await res.json()) as any;
    expect(url).toBe(`https://pop.example/s/${id}`);
    const got: any = await (await app.request(`/api/shares/${id}`)).json();
    expect(got.explanation.title).toBe(HEART.title);
    expect(got.explanation.scene.objects).toHaveLength(3);
  });
  it('rejects garbage, oversized bodies and path tricks', async () => {
    const app = await setup(new FakeAI());
    expect((await app.request('/api/shares', { method: 'POST', body: 'nope' })).status).toBe(400);
    expect((await app.request('/api/shares', { method: 'POST', body: 'x'.repeat(300_000) })).status).toBe(413);
    expect((await app.request('/api/shares/..%2F..%2Fetc')).status).toBe(404);
  });
});

describe('security headers', () => {
  it('pages get a CSP that only allows YouTube embeds/thumbnails as third parties', async () => {
    const app = await setup(new FakeAI());
    app.get('/x', (c) => c.text('ok'));
    const res = await app.request('/x');
    const csp = res.headers.get('content-security-policy')!;
    expect(csp).toContain('frame-src https://www.youtube-nocookie.com');
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain('img-src');
  });
});
