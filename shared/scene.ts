/**
 * The 3D "pop-up" format. The AI only DESCRIBES a scene with simple primitives;
 * the app validates every value here and builds the 3D model itself with trusted code.
 *
 * Coordinates: y is up, the scene fits roughly inside a cube from -5 to 5.
 */
export const KINDS = ['box', 'sphere', 'cylinder', 'cone', 'torus', 'plane', 'arrow', 'tube', 'line', 'helix', 'particles', 'label'] as const;
export const ANIMS = ['none', 'spin', 'orbit', 'bob', 'pulse', 'flow', 'jitter'] as const;
export const AXES = ['x', 'y', 'z'] as const;
export const SUBJECTS = ['mathematics', 'physics', 'chemistry', 'biology', 'evs', 'earth-science', 'astronomy', 'social-science', 'english', 'languages', 'computer-science', 'other'] as const;
export const SUBJECT_LABEL: Record<string, string> = { mathematics: 'Maths', physics: 'Physics', chemistry: 'Chemistry', biology: 'Biology', evs: 'EVS', 'earth-science': 'Earth science', astronomy: 'Astronomy', 'social-science': 'Social science', english: 'English', languages: 'Languages', 'computer-science': 'Computer science', other: 'General' };
export const LANGUAGES = { en: 'English', hi: 'Hindi', hinglish: 'Hinglish (Hindi in Latin script)', bn: 'Bengali', ta: 'Tamil', te: 'Telugu', mr: 'Marathi', es: 'Spanish' } as const;
export type LanguageCode = keyof typeof LANGUAGES;

export type Kind = (typeof KINDS)[number];
export type Anim = (typeof ANIMS)[number];
export type Axis = (typeof AXES)[number];
export type Subject = (typeof SUBJECTS)[number];
import { evaluate } from './expr';

type V3 = [number, number, number];

export interface SceneObject {
  kind: Kind;
  part: string | null;
  label: string | null;
  position: V3;
  rotation: V3;
  size: number[];
  points: number[];
  color: string;
  opacity: number;
  glow: boolean;
  double: boolean;
  count: number;
  step: number;
  animation: Anim;
  axis: Axis;
  speed: number;
  center: V3;
}
export interface Part { id: string; name: string; description: string }
export interface Step { title: string; text: string; focus: string[] }
/** A numeric claim in the answer that the app re-computes itself (safe evaluator, no eval). */
export interface Check { label: string; expression: string; claimed: number; computed: number | null; ok: boolean | null }
export interface Homework {
  question: string;
  hints: string[];
  answerMarkdown: string;
  checks: Check[];
  practice: { question: string; answer: string }[];
}
export interface Explanation {
  title: string;
  grade: number | null;
  homework: Homework | null;
  subject: Subject;
  topic: string;
  gradeLevel: string | null;
  summary: string;
  descriptionMarkdown: string;
  parts: Part[];
  steps: Step[];
  keyTerms: { term: string; meaning: string }[];
  funFact: string | null;
  scene: { objects: SceneObject[] };
  videoQuery: string;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Sanitizer: tolerant of odd model output, strict about what reaches the renderer.
export const LIMITS = { objects: 80, points: 60, particles: 400, parts: 16, steps: 8, terms: 10, coord: 8, steps_max: 8 } as const;
const NAMED: Record<string, string> = {
  red: '#ff5a5a', blue: '#4f8cff', green: '#3ddc84', yellow: '#ffd23f', orange: '#ff9a3c', purple: '#a974ff', pink: '#ff6fb5',
  cyan: '#4fe3f0', white: '#f4f1e8', black: '#3a3f4b', grey: '#9aa3b2', gray: '#9aa3b2', brown: '#b07a4f', gold: '#ffc857', silver: '#c9d1dc',
};
const DEFAULT_COLOR = '#4fe3f0';

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, max: number, d = ''): string => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max) : d);
const optStr = (v: unknown, max: number): string | null => { const s = str(v, max); return s ? s : null; };
const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const vec3 = (v: unknown, d: V3, lim: number = LIMITS.coord): V3 => {
  if (!Array.isArray(v) || v.length < 3) return [...d];
  return [num(v[0], -lim, lim, d[0]), num(v[1], -lim, lim, d[1]), num(v[2], -lim, lim, d[2])];
};
export const ident = (v: unknown) => str(v, 40).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');

export function color(v: unknown): string {
  const s = str(v, 20).toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  if (/^#[0-9a-f]{3}$/.test(s)) return '#' + [...s.slice(1)].map((c) => c + c).join('');
  return NAMED[s] ?? DEFAULT_COLOR;
}

const PATH_KINDS: Kind[] = ['arrow', 'tube', 'line'];

export function sanitizeObject(raw: unknown, partIds: Set<string>): SceneObject | null {
  if (!isObj(raw)) return null;
  const kind = (KINDS as readonly string[]).includes(raw.kind as string) ? (raw.kind as Kind) : null;
  if (!kind) return null;
  let points: number[] = [];
  if (Array.isArray(raw.points)) {
    const flat = raw.points.filter((n): n is number => typeof n === 'number' && Number.isFinite(n)).map((n) => Math.min(LIMITS.coord, Math.max(-LIMITS.coord, n)));
    points = flat.slice(0, Math.floor(Math.min(flat.length, LIMITS.points * 3) / 3) * 3);
  }
  if (PATH_KINDS.includes(kind) && points.length < 6) return null; // a path needs two points
  const label = optStr(raw.label, 40);
  if (kind === 'label' && !label) return null;
  const size = Array.isArray(raw.size) ? raw.size.slice(0, 3).map((n) => num(n, 0.02, 10, 1)) : [];
  const part = optStr(raw.part, 40) ? ident(raw.part) : null;
  const anim = (ANIMS as readonly string[]).includes(raw.animation as string) ? (raw.animation as Anim) : 'none';
  const axis = (AXES as readonly string[]).includes(raw.axis as string) ? (raw.axis as Axis) : 'y';
  return {
    kind,
    part: part && partIds.has(part) ? part : null,
    label,
    position: vec3(raw.position, [0, 0, 0]),
    rotation: vec3(raw.rotation, [0, 0, 0], 720),
    size,
    points,
    color: color(raw.color),
    opacity: num(raw.opacity, 0.08, 1, 1),
    glow: raw.glow === true,
    double: raw.double === true,
    count: Math.round(num(raw.count, 1, LIMITS.particles, 80)),
    step: Math.round(num(raw.step, 0, LIMITS.steps_max, 0)),
    animation: anim,
    axis,
    speed: num(raw.speed, 0, 3, 1),
    center: vec3(raw.center, [0, 0, 0]),
  };
}

export type SanitizeResult = { ok: true; explanation: Explanation; dropped: number } | { ok: false; reason: string };

/** Accepts either raw model output ({objects}) or a stored Explanation ({scene:{objects}}). */
export function sanitizeExplanation(raw: unknown): SanitizeResult {
  if (!isObj(raw)) return { ok: false, reason: 'The AI answer had an unexpected shape.' };
  if (raw.understood === false) return { ok: false, reason: str(raw.notUnderstoodReason, 400) || 'This does not look like homework or a school diagram I can explain.' };

  const parts: Part[] = [];
  const seen = new Set<string>();
  for (const p of Array.isArray(raw.parts) ? raw.parts : []) {
    if (!isObj(p)) continue;
    const id = ident(p.id) || ident(p.name);
    const name = str(p.name, 60);
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    parts.push({ id, name, description: str(p.description, 400) });
    if (parts.length >= LIMITS.parts) break;
  }

  const rawObjects = Array.isArray(raw.objects) ? raw.objects : isObj(raw.scene) && Array.isArray(raw.scene.objects) ? raw.scene.objects : [];
  const objects: SceneObject[] = [];
  let dropped = 0;
  for (const o of rawObjects) {
    if (objects.length >= LIMITS.objects) { dropped++; continue; }
    const s = sanitizeObject(o, seen);
    if (s) objects.push(s); else dropped++;
  }
  const homework = sanitizeHomework(raw.homework);
  if (!objects.some((o) => o.kind !== 'label')) {
    if (!homework) return { ok: false, reason: 'The AI could not build a 3D model for this diagram. Try a clearer photo of a single diagram.' };
    objects.length = 0; // homework without a useful 3D model: the app shows the explanation only
  }

  const steps: Step[] = [];
  for (const s of Array.isArray(raw.steps) ? raw.steps : []) {
    if (!isObj(s)) continue;
    const title = str(s.title, 80).replace(/^(step|stage)\s*\d+\s*[:.\-–—)]\s*/i, ''), text = str(s.text, 700);
    if (!title && !text) continue;
    const focus = (Array.isArray(s.focus) ? s.focus : []).map(ident).filter((f) => seen.has(f)).slice(0, 6);
    steps.push({ title: title || `Step ${steps.length + 1}`, text, focus });
    if (steps.length >= LIMITS.steps) break;
  }
  // Objects can only be revealed at steps that exist.
  for (const o of objects) if (o.step > steps.length) o.step = steps.length;

  const keyTerms = (Array.isArray(raw.keyTerms) ? raw.keyTerms : [])
    .filter(isObj).map((t) => ({ term: str(t.term, 60), meaning: str(t.meaning, 300) }))
    .filter((t) => t.term && t.meaning).slice(0, LIMITS.terms);

  const subject = (SUBJECTS as readonly string[]).includes(raw.subject as string) ? (raw.subject as Subject) : 'other';
  const title = str(raw.title, 80) || 'Science diagram';
  const g = typeof raw.grade === 'number' && Number.isFinite(raw.grade) ? Math.round(raw.grade) : null;
  const explanation: Explanation = {
    title,
    grade: g != null && g >= 1 && g <= 12 ? g : null,
    homework,
    subject,
    topic: str(raw.topic, 80) || title,
    gradeLevel: optStr(raw.gradeLevel, 40),
    summary: str(raw.summary, 600),
    descriptionMarkdown: str(raw.descriptionMarkdown, 5000),
    parts,
    steps,
    keyTerms,
    funFact: optStr(raw.funFact, 300),
    scene: { objects },
    videoQuery: str(raw.videoQuery, 100) || `${title} explained`,
    warnings: (Array.isArray(raw.warnings) ? raw.warnings : []).map((w) => str(w, 300)).filter(Boolean).slice(0, 6),
  };
  return { ok: true, explanation, dropped };
}

function sanitizeHomework(raw: unknown): Homework | null {
  if (!isObj(raw)) return null;
  const question = str(raw.question, 1500);
  const answerMarkdown = str(raw.answerMarkdown, 3000);
  if (!question && !answerMarkdown) return null;
  const checks: Check[] = [];
  for (const c of Array.isArray(raw.checks) ? raw.checks : []) {
    if (!isObj(c) || checks.length >= 6) continue;
    const expression = str(c.expression, 200);
    const claimed = typeof c.claimed === 'number' && Number.isFinite(c.claimed) ? c.claimed : null;
    if (!expression || claimed == null) continue;
    let computed: number | null = null;
    try { computed = evaluate(expression, {}); } catch { computed = null; }
    const ok = computed == null ? null : Math.abs(computed - claimed) <= Math.max(1e-6, Math.abs(computed) * 0.005);
    checks.push({ label: str(c.label, 80) || expression, expression, claimed, computed, ok });
  }
  return {
    question,
    hints: (Array.isArray(raw.hints) ? raw.hints : []).map((h) => str(h, 400)).filter(Boolean).slice(0, 3),
    answerMarkdown,
    checks,
    practice: (Array.isArray(raw.practice) ? raw.practice : []).filter(isObj)
      .map((q) => ({ question: str(q.question, 400), answer: str(q.answer, 400) })).filter((q) => q.question && q.answer).slice(0, 3),
  };
}

export const hasModel = (e: Explanation) => e.scene.objects.some((o) => o.kind !== 'label');
export const maxStep = (e: Explanation) => Math.max(e.steps.length, ...e.scene.objects.map((o) => o.step));
