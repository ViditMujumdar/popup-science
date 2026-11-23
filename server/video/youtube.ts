/**
 * Finds REAL, existing YouTube lessons with the official YouTube Data API v3.
 * Docs: https://developers.google.com/youtube/v3/docs/search/list and /videos/list
 *  - search.list costs 100 quota units, videos.list 1 unit (free quota: 10,000 units/day).
 * Without a key the app shows a YouTube search link instead and never invents video links.
 */

export interface Video {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  durationSec: number | null;
  views: number | null;
  publishedAt: string | null;
  trusted: boolean;
}

export class VideoError extends Error {
  constructor(public kind: 'not_configured' | 'quota' | 'auth' | 'unavailable', message: string) { super(message); }
}

/** Well-known educational channels get a small ranking boost (never a requirement). */
const TRUSTED = [
  'khan academy', 'crashcourse', 'physics wallah', 'vedantu', "byju's", 'byjus', 'magnet brains', 'learnohub', 'amoeba sisters',
  'fuseschool', 'the organic chemistry tutor', 'professor dave explains', 'ted-ed', 'veritasium', 'minutephysics', 'kurzgesagt',
  'nptel', 'unacademy', 'study iq', 'manocha academy', 'bozeman science', 'tyler dewitt', 'smart learning for all', 'doubtnut',
  'dr. binocs', 'peekaboo kidz', 'neet adda247', 'science with sam', 'eduspark', 'ncert', 'cbse', 'sciencedaily', 'nasa',
];
const isTrusted = (channel: string) => { const c = channel.toLowerCase(); return TRUSTED.some((t) => c.includes(t)); };

/** ISO-8601 duration (PT1H2M3S) to seconds. */
export function parseDuration(iso: string | undefined | null): number | null {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso ?? '');
  if (!m) return null;
  return (+(m[1] ?? 0)) * 86400 + (+(m[2] ?? 0)) * 3600 + (+(m[3] ?? 0)) * 60 + (+(m[4] ?? 0));
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

export const searchUrl = (q: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

export class YouTubeSearch {
  private cache = new Map<string, { at: number; videos: Video[] }>();
  constructor(private o: { apiKey: string; baseUrl: string; timeoutMs: number; cacheMs?: number }) {}
  get configured() { return Boolean(this.o.apiKey); }

  private async get(path: string, params: Record<string, string>) {
    const u = new URL(`${this.o.baseUrl}/youtube/v3/${path}`);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    u.searchParams.set('key', this.o.apiKey);
    let res: Response;
    try {
      res = await fetch(u, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(this.o.timeoutMs) });
    } catch {
      throw new VideoError('unavailable', 'Could not reach YouTube.');
    }
    const body: any = await res.json().catch(() => null);
    if (!res.ok) {
      const reason = body?.error?.errors?.[0]?.reason ?? '';
      if (res.status === 403 && /quota/i.test(reason)) throw new VideoError('quota', 'The daily YouTube search limit has been reached. Use the YouTube search link instead.');
      if (res.status === 400 || res.status === 401 || res.status === 403) throw new VideoError('auth', 'YouTube rejected the server’s API key.');
      throw new VideoError('unavailable', `YouTube returned an error (${res.status}).`);
    }
    return body;
  }

  async search(query: string, lang = 'en'): Promise<Video[]> {
    if (!this.configured) throw new VideoError('not_configured', 'YouTube search is not configured.');
    const key = `${lang}|${query.toLowerCase()}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < (this.o.cacheMs ?? 12 * 3600_000)) return hit.videos;

    const s = await this.get('search', {
      part: 'snippet', type: 'video', q: query, maxResults: '10', safeSearch: 'strict', videoEmbeddable: 'true',
      relevanceLanguage: lang === 'hinglish' ? 'hi' : lang,
    });
    const items: any[] = Array.isArray(s?.items) ? s.items : [];
    const base = items
      .map((it) => ({ id: String(it?.id?.videoId ?? ''), sn: it?.snippet ?? {} }))
      .filter((it) => VIDEO_ID.test(it.id) && it.sn?.liveBroadcastContent !== 'live');
    if (!base.length) { this.remember(key, []); return []; }

    const details = new Map<string, { dur: number | null; views: number | null }>();
    try {
      const v = await this.get('videos', { part: 'contentDetails,statistics', id: base.map((b) => b.id).join(',') });
      for (const it of Array.isArray(v?.items) ? v.items : []) {
        const views = Number(it?.statistics?.viewCount);
        details.set(String(it.id), { dur: parseDuration(it?.contentDetails?.duration), views: Number.isFinite(views) ? views : null });
      }
    } catch { /* details are optional; keep search results */ }

    const videos: Video[] = base.map(({ id, sn }) => {
      const d = details.get(id);
      const thumbs = sn.thumbnails ?? {};
      const thumb = thumbs.high?.url ?? thumbs.medium?.url ?? thumbs.default?.url ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      const channel = decode(String(sn.channelTitle ?? ''));
      return {
        id,
        title: decode(String(sn.title ?? 'YouTube video')).slice(0, 160),
        channel: channel.slice(0, 80),
        thumbnail: /^https:\/\/i\.ytimg\.com\//.test(thumb) ? thumb : `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        durationSec: d?.dur ?? null,
        views: d?.views ?? null,
        publishedAt: typeof sn.publishedAt === 'string' ? sn.publishedAt : null,
        trusted: isTrusted(channel),
      };
    });
    // Lessons, not Shorts or 3-hour lectures: keep 1–45 minutes when the duration is known.
    const fit = videos.filter((v) => v.durationSec == null || (v.durationSec >= 60 && v.durationSec <= 45 * 60));
    const ranked = (fit.length >= 2 ? fit : videos)
      .map((v, i) => ({ v, score: -i + (v.trusted ? 3 : 0) + (v.views ? Math.log10(v.views + 1) * 0.6 : 0) }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.v)
      .slice(0, 4);
    this.remember(key, ranked);
    return ranked;
  }

  private remember(key: string, videos: Video[]) {
    if (this.cache.size > 500) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(key, { at: Date.now(), videos });
  }
}
