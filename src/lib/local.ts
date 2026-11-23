/** Browser-side memory: the current pop-up (this tab) and recent pop-ups (this device). Photos never leave the tab. */
import { sanitizeExplanation, type Explanation, type LanguageCode } from '../../shared/scene';

export interface Current { explanation: Explanation; photo: string | null; lang: LanguageCode; model: string | null }
export interface Recent { id: string; at: number; explanation: Explanation }

const safe = <T,>(f: () => T, d: T): T => { try { return f(); } catch { return d; } };

let memCurrent: Current | null = null; // fallback when sessionStorage is unavailable or full
export function setCurrent(c: Current) {
  memCurrent = c;
  safe(() => sessionStorage.setItem('pop:current', JSON.stringify(c)), undefined);
  if (safe(() => sessionStorage.getItem('pop:current'), null) == null) safe(() => sessionStorage.setItem('pop:current', JSON.stringify({ ...c, photo: null })), undefined);
}
export function getCurrent(): Current | null {
  const raw = safe(() => sessionStorage.getItem('pop:current'), null);
  if (!raw) return memCurrent;
  const c = safe(() => JSON.parse(raw), null) as Current | null;
  const s = c && sanitizeExplanation(c.explanation);
  if (!c || !s || !s.ok) return memCurrent;
  return { ...c, explanation: s.explanation, photo: memCurrent?.photo ?? c.photo };
}

export function addRecent(explanation: Explanation): string {
  const id = Math.random().toString(36).slice(2, 10);
  const list = [{ id, at: Date.now(), explanation }, ...getRecent()].slice(0, 8);
  safe(() => localStorage.setItem('pop:recent', JSON.stringify(list)), undefined);
  return id;
}
export function getRecent(): Recent[] {
  const list = safe(() => JSON.parse(localStorage.getItem('pop:recent') || '[]'), []) as Recent[];
  if (!Array.isArray(list)) return [];
  return list.flatMap((r) => { const s = sanitizeExplanation(r?.explanation); return s.ok && typeof r.id === 'string' ? [{ id: r.id, at: Number(r.at) || 0, explanation: s.explanation }] : []; });
}
