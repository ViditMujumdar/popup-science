/**
 * Safe arithmetic for AI-proposed formulas.
 *
 * The model may only propose formulas as plain expressions like
 *   "2*pi*sqrt(L/g)"  or  "v0^2*sin(2*theta_deg*pi/180)/g"
 * This module tokenises and parses them itself (no eval, no Function, no code execution),
 * allows only + - * / ^ ( ) numbers, known variables, and a fixed list of math functions.
 */

const FUNCS: Record<string, { n: number; f: (...a: number[]) => number }> = {
  sqrt: { n: 1, f: Math.sqrt }, cbrt: { n: 1, f: Math.cbrt }, abs: { n: 1, f: Math.abs },
  sin: { n: 1, f: Math.sin }, cos: { n: 1, f: Math.cos }, tan: { n: 1, f: Math.tan },
  asin: { n: 1, f: Math.asin }, acos: { n: 1, f: Math.acos }, atan: { n: 1, f: Math.atan },
  ln: { n: 1, f: Math.log }, log: { n: 1, f: Math.log10 }, log10: { n: 1, f: Math.log10 }, log2: { n: 1, f: Math.log2 },
  exp: { n: 1, f: Math.exp }, floor: { n: 1, f: Math.floor }, ceil: { n: 1, f: Math.ceil }, round: { n: 1, f: Math.round },
  min: { n: 2, f: Math.min }, max: { n: 2, f: Math.max }, atan2: { n: 2, f: Math.atan2 }, pow: { n: 2, f: Math.pow },
};
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E };
export const ALLOWED_FUNCTIONS = Object.keys(FUNCS);
const IDENT = /^[A-Za-z_][A-Za-z0-9_]{0,31}$/;
export const isIdent = (s: string) => IDENT.test(s) && !(s in FUNCS);

type Tok = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string };
type Node =
  | { k: 'num'; v: number }
  | { k: 'var'; name: string }
  | { k: 'neg'; a: Node }
  | { k: 'bin'; op: string; a: Node; b: Node }
  | { k: 'call'; fn: string; args: Node[] };

export class ExprError extends Error {}

function tokenize(src: string): Tok[] {
  if (src.length > 400) throw new ExprError('Expression is too long.');
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) { i++; continue; }
    const num = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i));
    if (num) { out.push({ t: 'num', v: Number(num[0]) }); i += num[0].length; continue; }
    const id = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
    if (id) { out.push({ t: 'id', v: id[0] }); i += id[0].length; continue; }
    if (src.startsWith('**', i)) { out.push({ t: 'op', v: '^' }); i += 2; continue; }
    if ('+-*/^(),×·÷−'.includes(c)) { out.push({ t: 'op', v: c === '×' || c === '·' ? '*' : c === '÷' ? '/' : c === '−' ? '-' : c }); i++; continue; }
    throw new ExprError(`Unexpected character "${c}".`);
  }
  return out;
}

export function parse(src: string): Node {
  const toks = tokenize(src);
  let p = 0, depth = 0;
  const peek = () => toks[p];
  const eat = (v?: string) => { const t = toks[p]; if (!t || (v && !(t.t === 'op' && t.v === v))) throw new ExprError(v ? `Expected "${v}".` : 'Unexpected end of expression.'); p++; return t; };
  const guard = () => { if (++depth > 60) throw new ExprError('Expression is nested too deeply.'); };
  const expr = (): Node => { guard(); let a = term(); while (peek()?.t === 'op' && ['+', '-'].includes(peek()!.v as string)) { const op = (eat() as { v: string }).v; a = { k: 'bin', op, a, b: term() }; } depth--; return a; };
  const term = (): Node => { let a = unary(); while (peek()?.t === 'op' && ['*', '/'].includes(peek()!.v as string)) { const op = (eat() as { v: string }).v; a = { k: 'bin', op, a, b: unary() }; } return a; };
  const unary = (): Node => { if (peek()?.t === 'op' && peek()!.v === '-') { eat(); return { k: 'neg', a: unary() }; } if (peek()?.t === 'op' && peek()!.v === '+') { eat(); return unary(); } return power(); };
  const power = (): Node => { const a = primary(); if (peek()?.t === 'op' && peek()!.v === '^') { eat(); return { k: 'bin', op: '^', a, b: unary() }; } return a; };
  const primary = (): Node => {
    const t = eat();
    if (t.t === 'num') return { k: 'num', v: t.v };
    if (t.t === 'id') {
      if (peek()?.t === 'op' && peek()!.v === '(') {
        const fn = FUNCS[t.v];
        if (!fn) throw new ExprError(`Unknown function "${t.v}".`);
        eat('('); const args: Node[] = [];
        if (!(peek()?.t === 'op' && peek()!.v === ')')) { args.push(expr()); while (peek()?.t === 'op' && peek()!.v === ',') { eat(','); args.push(expr()); } }
        eat(')');
        if (args.length !== fn.n) throw new ExprError(`${t.v}() takes ${fn.n} argument${fn.n > 1 ? 's' : ''}.`);
        return { k: 'call', fn: t.v, args };
      }
      return { k: 'var', name: t.v };
    }
    if (t.v === '(') { const e = expr(); eat(')'); return e; }
    throw new ExprError(`Unexpected "${t.v}".`);
  };
  const tree = expr();
  if (p !== toks.length) throw new ExprError('Unexpected text after the expression.');
  return tree;
}

/** Variable names used by an expression (excluding constants pi and e unless defined). */
export function variables(src: string): string[] {
  const out = new Set<string>();
  const walk = (n: Node) => { if (n.k === 'var') out.add(n.name); else if (n.k === 'neg') walk(n.a); else if (n.k === 'bin') { walk(n.a); walk(n.b); } else if (n.k === 'call') n.args.forEach(walk); };
  walk(parse(src));
  return [...out];
}

export function evaluate(src: string, env: Record<string, number>): number {
  const ev = (n: Node): number => {
    switch (n.k) {
      case 'num': return n.v;
      case 'var': {
        if (Object.prototype.hasOwnProperty.call(env, n.name)) return env[n.name]!;
        if (n.name in CONSTS) return CONSTS[n.name]!;
        throw new ExprError(`Unknown value "${n.name}".`);
      }
      case 'neg': return -ev(n.a);
      case 'bin': {
        const a = ev(n.a), b = ev(n.b);
        return n.op === '+' ? a + b : n.op === '-' ? a - b : n.op === '*' ? a * b : n.op === '/' ? a / b : Math.pow(a, b);
      }
      case 'call': return FUNCS[n.fn]!.f(...n.args.map(ev));
    }
  };
  const v = ev(parse(src));
  if (!Number.isFinite(v)) throw new ExprError('The result is not a finite number for these values.');
  return v;
}

/* ---------------- running an AI solution plan ---------------- */

