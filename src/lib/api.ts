import type { Explanation, LanguageCode } from '../../shared/scene';

export class ApiError extends Error { constructor(public code: string, message: string, public status = 0, public extra: Record<string, unknown> = {}) { super(message); } }

async function json<T>(res: Response): Promise<T> {
  const body: any = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(body?.error?.code ?? 'http_' + res.status, body?.error?.message ?? `Request failed (${res.status}).`, res.status, body?.error ?? {});
  return body as T;
}

export interface Health { ok: boolean; ai: { configured: boolean; model: string }; video: { configured: boolean; provider: string } }
export const getHealth = () => fetch('/api/health').then((r) => json<Health>(r));

export async function explain(image: Blob | null, note: string, lang: LanguageCode, grade: number | null, signal: AbortSignal) {
  const f = new FormData();
  if (image) f.append('image', image, 'homework.jpg');
  if (note.trim()) f.append('note', note.trim());
  f.append('lang', lang);
  if (grade) f.append('grade', String(grade));
  let res: Response;
  try { res = await fetch('/api/explain', { method: 'POST', body: f, signal }); }
  catch (e) {
    if ((e as Error).name === 'TimeoutError') throw new ApiError('timeout', 'The AI took too long. Please try again.');
    if ((e as Error).name === 'AbortError') throw new ApiError('aborted', 'Cancelled.');
    throw new ApiError('offline', 'Could not reach the server. Check your internet connection.');
  }
  return json<{ explanation: Explanation; model: string; lang: LanguageCode }>(res);
}

export interface Video { id: string; title: string; channel: string; thumbnail: string; durationSec: number | null; views: number | null; publishedAt: string | null; trusted: boolean }
export const findVideos = (q: string, lang: string) =>
  fetch(`/api/videos?q=${encodeURIComponent(q)}&lang=${encodeURIComponent(lang)}`).then((r) => json<{ configured: boolean; videos: Video[]; searchUrl: string }>(r));

export const createShare = (explanation: Explanation) =>
  fetch('/api/shares', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ explanation }) }).then((r) => json<{ id: string; url: string }>(r));
export const getShare = (id: string) => fetch(`/api/shares/${encodeURIComponent(id)}`).then((r) => json<{ explanation: Explanation }>(r));
