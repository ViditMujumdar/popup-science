import { describe, it, expect } from 'vitest';
import { sanitizeExplanation, color, maxStep, LIMITS } from '../shared/scene';
import { EXAMPLE_IDS, getExample } from '../shared/examples';
import { HEART } from '../scripts/mock-upstream.mjs';

describe('scene sanitizer', () => {
  it('keeps valid objects and drops invalid ones', () => {
    const s = sanitizeExplanation(HEART);
    expect(s.ok).toBe(true);
    if (!s.ok) return;
    const kinds = s.explanation.scene.objects.map((o) => o.kind);
    expect(kinds).toEqual(['sphere', 'sphere', 'tube']); // arrow with 1 number and "teapot" dropped
    expect(s.dropped).toBe(2);
    expect(s.explanation.scene.objects[1]!.color).toBe('#ff5a5a'); // named colour mapped
    expect(s.explanation.scene.objects[2]!.step).toBe(2);
  });
  it('clamps coordinates, sizes, counts and steps', () => {
    const s = sanitizeExplanation({ title: 'x', parts: [], steps: [{ title: 'a', text: 'b', focus: null }], objects: [
      { kind: 'box', position: [999, -999, NaN], size: [500, -1], color: '#ABC', step: 99, count: 1e9, opacity: 5, speed: 100 },
      { kind: 'particles', position: [0, 0, 0], count: 1e6, color: 'nope' },
    ] });
    expect(s.ok).toBe(true); if (!s.ok) return;
    const [box, parts] = s.explanation.scene.objects;
    expect(box!.position).toEqual([LIMITS.coord, -LIMITS.coord, 0]);
    expect(box!.size).toEqual([10, 0.02]);
    expect(box!.color).toBe('#aabbcc');
    expect(box!.step).toBe(1); // only 1 step exists
    expect(box!.opacity).toBe(1);
    expect(box!.speed).toBe(3);
    expect(parts!.count).toBe(LIMITS.particles);
    expect(parts!.color).toBe('#4fe3f0');
  });
  it('limits path points and rejects paths with fewer than two points', () => {
    const pts = Array.from({ length: 600 }, (_, i) => i % 7);
    const s = sanitizeExplanation({ title: 't', objects: [{ kind: 'tube', points: pts, color: '#fff' }, { kind: 'line', points: [0, 0, 0, 1], color: '#fff' }] });
    expect(s.ok).toBe(true); if (!s.ok) return;
    expect(s.explanation.scene.objects).toHaveLength(1);
    expect(s.explanation.scene.objects[0]!.points.length).toBe(LIMITS.points * 3);
  });
  it('unknown part references are cleared and step focus is filtered', () => {
    const s = sanitizeExplanation({ title: 't', parts: [{ id: 'Lens One', name: 'Lens', description: '' }], steps: [{ title: 's', text: 't', focus: ['lens-one', 'ghost'] }],
      objects: [{ kind: 'sphere', part: 'ghost', color: '#fff' }, { kind: 'sphere', part: 'Lens One', color: '#fff' }] });
    expect(s.ok).toBe(true); if (!s.ok) return;
    expect(s.explanation.parts[0]!.id).toBe('lens-one');
    expect(s.explanation.scene.objects.map((o) => o.part)).toEqual([null, 'lens-one']);
    expect(s.explanation.steps[0]!.focus).toEqual(['lens-one']);
  });
  it('reports not-understood input and empty scenes', () => {
    expect(sanitizeExplanation({ understood: false, notUnderstoodReason: 'A selfie, not a diagram.' })).toEqual({ ok: false, reason: 'A selfie, not a diagram.' });
    expect(sanitizeExplanation({ title: 't', objects: [{ kind: 'label', label: 'only text', color: '#fff' }] }).ok).toBe(false);
    expect(sanitizeExplanation('nope').ok).toBe(false);
  });
  it('strips control characters and caps text', () => {
    const s = sanitizeExplanation({ title: 'A\u0000B'.padEnd(500, 'x'), objects: [{ kind: 'box', color: '#fff', label: 'L'.repeat(100) }] });
    expect(s.ok).toBe(true); if (!s.ok) return;
    expect(s.explanation.title.startsWith('AB')).toBe(true);
    expect(s.explanation.title.length).toBe(80);
    expect(s.explanation.scene.objects[0]!.label!.length).toBe(40);
  });
  it('removes redundant "Step 1:" prefixes from step titles', () => {
    const s = sanitizeExplanation({ title: 't', steps: [{ title: 'Step 1: Evaporation', text: 'x', focus: null }, { title: 'Stage 2 - Rain', text: 'y', focus: null }], objects: [{ kind: 'box', color: '#fff' }] });
    expect(s.ok && s.explanation.steps.map((x) => x.title)).toEqual(['Evaporation', 'Rain']);
  });
  it('colour parsing', () => { expect(color('#FF00aa')).toBe('#ff00aa'); expect(color('javascript:alert(1)')).toBe('#4fe3f0'); });
});

describe('homework', () => {
  const base = { title: 'Sum', objects: [], steps: [{ title: 'Add', text: '2+2', focus: null }] };
  it('allows homework without a 3D model and re-computes numeric claims', () => {
    const s = sanitizeExplanation({ ...base, grade: 3, homework: { question: 'What is 12 × 4 + 7?', hints: ['Multiply first', 'Then add', 'x', 'extra hint dropped'], answerMarkdown: '**55**',
      checks: [{ label: 'Answer', expression: '12*4 + 7', claimed: 55 }, { label: 'Wrong', expression: '12*4', claimed: 50 }, { label: 'Bad expr', expression: 'alert(1)', claimed: 1 }], practice: [{ question: 'q', answer: 'a' }] } });
    expect(s.ok).toBe(true); if (!s.ok) return;
    const h = s.explanation.homework!;
    expect(s.explanation.scene.objects).toHaveLength(0);
    expect(s.explanation.grade).toBe(3);
    expect(h.hints).toHaveLength(3);
    expect(h.checks.map((c) => [c.computed, c.ok])).toEqual([[55, true], [48, false], [null, null]]);
  });
  it('still requires a model when there is no homework', () => { expect(sanitizeExplanation(base).ok).toBe(false); });
  it('rejects out-of-range grades', () => {
    const s = sanitizeExplanation({ ...base, grade: 40, homework: { question: 'q', answerMarkdown: 'a' } });
    expect(s.ok && s.explanation.grade).toBe(null);
  });
});

describe('examples', () => {
  it.each(EXAMPLE_IDS)('%s is valid and fully kept', (id) => {
    const e = getExample(id)!;
    expect(e.scene.objects.length).toBeGreaterThan(5);
    expect(e.steps.length).toBeGreaterThanOrEqual(3);
    expect(maxStep(e)).toBe(e.steps.length);
    for (const o of e.scene.objects) if (o.part) expect(e.parts.some((p) => p.id === o.part)).toBe(true);
  });
  it('homework examples have correct, verified answers', () => {
    for (const id of ['fractions', 'cuboid']) {
      const h = getExample(id)!.homework!;
      expect(h.checks.length).toBeGreaterThan(0);
      for (const c of h.checks) expect(c.ok).toBe(true);
      expect(h.hints.length).toBe(3);
    }
  });
  it('lens rays obey the thin-lens geometry (f = 2, object at 2F → image at 2F, inverted)', () => {
    const e = getExample('lens')!;
    const rays = e.scene.objects.filter((o) => o.part === 'rays');
    // every ray passes through the image tip (4, -1.2) or its extension
    for (const r of rays) {
      const p = r.points; let ok = false;
      for (let i = 0; i + 5 < p.length; i += 3) {
        const [x1, y1, x2, y2] = [p[i]!, p[i + 1]!, p[i + 3]!, p[i + 4]!];
        if (x1 <= 4 && x2 >= 4) ok = Math.abs(y1 + ((4 - x1) * (y2 - y1)) / (x2 - x1) - -1.2) < 1e-9;
      }
      expect(ok).toBe(true);
    }
  });
});
