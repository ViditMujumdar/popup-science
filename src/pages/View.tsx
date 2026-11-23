import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hasModel, maxStep, SUBJECT_LABEL, type Explanation } from '../../shared/scene';
import { getExample } from '../../shared/examples';
import { Stage, type StageHandle } from '../components/Stage';
import { Videos } from '../components/Videos';
import { createShare, getShare } from '../lib/api';
import { getCurrent, getRecent } from '../lib/local';
import { md } from '../lib/markdown';
import { Link, useLocation } from '../lib/router';
import { useReducedMotion } from '../lib/hooks';

type Source = { kind: 'example' | 'current' | 'recent' | 'share'; explanation: Explanation; photo?: string | null; lang: string; model?: string | null };
type Tab = 'homework' | 'explain' | 'parts' | 'video' | 'terms';

export default function View({ shareId }: { shareId?: string }) {
  const { search } = useLocation();
  const [src, setSrc] = useState<Source | null>(null);
  const [missing, setMissing] = useState<string | null>(null);

  useEffect(() => {
    setSrc(null); setMissing(null);
    const q = new URLSearchParams(search);
    if (shareId) {
      getShare(shareId).then((r) => setSrc({ kind: 'share', explanation: r.explanation, lang: 'en' }), (e) => setMissing(e.message));
      return;
    }
    const ex = q.get('ex'), r = q.get('r');
    if (ex) { const e = getExample(ex); e ? setSrc({ kind: 'example', explanation: e, lang: 'en' }) : setMissing('That example does not exist.'); return; }
    if (r) { const rec = getRecent().find((x) => x.id === r); rec ? setSrc({ kind: 'recent', explanation: rec.explanation, lang: 'en' }) : setMissing('That pop-up is no longer saved on this device.'); return; }
    const cur = getCurrent();
    cur ? setSrc({ kind: 'current', explanation: cur.explanation, photo: cur.photo, lang: cur.lang, model: cur.model }) : setMissing('No pop-up yet. Snap a diagram first, or open an example.');
  }, [search, shareId]);

  if (missing) return (
    <div className="page narrow stack">
      <h1 className="h2">{missing}</h1>
      <div className="row"><Link href="/new" className="btn btn-primary">📸 Snap a diagram</Link><Link href="/view?ex=lens" className="btn">Open an example</Link></div>
    </div>
  );
  if (!src) return <div className="page"><p className="label">Loading model…</p></div>;
  return <Viewer key={src.explanation.title + src.kind} src={src} />;
}

function Viewer({ src }: { src: Source }) {
  const ex = src.explanation;
  const steps = useMemo(() => maxStep(ex), [ex]);
  const stage = useRef<StageHandle>(null);
  const reduced = useReducedMotion();
  const [step, setStep] = useState(steps);
  const [playing, setPlaying] = useState(false);
  const [explode, setExplode] = useState(0);
  const [rotate, setRotate] = useState(true);
  const [labels, setLabels] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(ex.homework ? 'homework' : 'explain');
  const model = useMemo(() => hasModel(ex), [ex]);
  const hw = ex.homework;
  const [hints, setHints] = useState(0);
  const [showSteps, setShowSteps] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [practiceOpen, setPracticeOpen] = useState<number[]>([]);
  const [share, setShare] = useState<{ busy: boolean; url?: string; error?: string }>({ busy: false });
  const [full, setFull] = useState(false);
  const stageWrap = useRef<HTMLDivElement>(null);

  const partName = (id: string) => ex.parts.find((p) => p.id === id)?.name ?? id;
  const sel = selected ? ex.parts.find((p) => p.id === selected) : null;
  const [guided, setGuided] = useState(false); // dim everything except the current step's parts
  const stepFocus = guided && step >= 1 && step <= ex.steps.length ? ex.steps[step - 1]?.focus ?? null : null;
  const highlight = selected ? [selected] : stepFocus;

  // play through the steps
  useEffect(() => {
    if (!playing) return;
    if (step >= steps) { setPlaying(false); return; }
    const id = setTimeout(() => setStep((s) => s + 1), reduced ? 600 : 2600);
    return () => clearTimeout(id);
  }, [playing, step, steps, reduced]);

  const select = useCallback((p: string | null) => {
    setSelected(p);
    if (p) { stage.current?.focus([p]); setTab('parts'); requestAnimationFrame(() => document.getElementById(`part-${p}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })); }
  }, []);

  const goStep = (k: number) => {
    setPlaying(false); setSelected(null); setStep(k); setGuided(k > 0);
    const f = ex.steps[k - 1]?.focus;
    stage.current?.focus(f && f.length ? f : null);
  };

  const doShare = async () => {
    setShare({ busy: true });
    try {
      const r = await createShare(ex);
      setShare({ busy: false, url: r.url });
      if (navigator.share) navigator.share({ title: ex.title, text: `${ex.title}: see it in 3D`, url: r.url }).catch(() => {});
      else navigator.clipboard?.writeText(r.url).catch(() => {});
    } catch (e) { setShare({ busy: false, error: (e as Error).message }); }
  };

  const snap = () => {
    const url = stage.current?.snapshot(ex.title);
    if (!url) return;
    const a = document.createElement('a'); a.href = url; a.download = `${ex.title.replace(/[^\w]+/g, '-').toLowerCase()}-3d.png`; a.click();
  };

  const toggleFull = () => {
    const el = stageWrap.current; if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => setFull((f) => !f));
    else setFull((f) => !f);
  };

  const walk = ex.steps.length > 0 ? (
              <ol className="walk">
                {ex.steps.map((s, i) => (
                  <li key={i} className={step === i + 1 ? 'on' : ''}>
                    <button className="walk-btn" onClick={() => goStep(i + 1)}>
                      <span className="num">{i + 1}</span>
                      <span><strong>{s.title}</strong><span className="muted small block">{s.text}</span>
                        {s.focus.length > 0 && <span className="focus-tags">{s.focus.map((f) => <span key={f} className="tag">{partName(f)}</span>)}</span>}</span>
                    </button>
                  </li>
                ))}
              </ol>
            
  ) : null;

  return (
    <div className={`viewer ${model ? '' : 'no-model'}`}>
      {model && <div ref={stageWrap} className={`stage-wrap ${full ? 'pseudo-full' : ''}`}>
        <Stage ref={stage} explanation={ex} step={step} explode={explode} autoRotate={rotate && !selected} labels={labels} highlight={highlight} onSelect={select} />
        <div className="stage-top">
          <span className="chip subject" data-occlude>{SUBJECT_LABEL[ex.subject] ?? ex.subject}{ex.grade ? ` · Class ${ex.grade}` : ''}</span>
          <div className="tools" data-occlude>
            <button className={`icon-btn ${rotate ? 'on' : ''}`} onClick={() => setRotate((r) => !r)} aria-pressed={rotate} title="Auto-rotate" aria-label="Auto-rotate">⟳</button>
            <button className={`icon-btn ${labels ? 'on' : ''}`} onClick={() => setLabels((l) => !l)} aria-pressed={labels} title="Labels" aria-label="Show labels">Aa</button>
            <button className="icon-btn" onClick={() => { setSelected(null); setGuided(false); stage.current?.resetView(); }} title="Reset view" aria-label="Reset view">⌖</button>
            <button className="icon-btn" onClick={snap} title="Save picture" aria-label="Save picture">📸</button>
            <button className="icon-btn" onClick={toggleFull} title="Full screen" aria-label="Full screen">⛶</button>
          </div>
        </div>
        {sel && (
          <div className="sel-card glass" role="status">
            <div className="row between"><strong>{sel.name}</strong><button className="icon-btn sm" onClick={() => { setSelected(null); stage.current?.focus(null); }} aria-label="Close">✕</button></div>
            <p className="small">{sel.description}</p>
          </div>
        )}
        <div className="stage-bottom glass" data-occlude>
          <label className="explode">
            <span className="label">Explode</span>
            <input type="range" min={0} max={1} step={0.01} value={explode} onChange={(e) => setExplode(+e.target.value)} aria-label="Explode the model apart" />
          </label>
          {steps > 0 && (
            <div className="row steps-row" role="group" aria-label="Build step">
              <button className="btn btn-sm btn-primary" onClick={() => { setSelected(null); setGuided(true); if (step >= steps) setStep(0); setPlaying((p) => !p); }}>
                {playing ? '❚❚' : step >= steps ? '▶ Build' : '▶'}
              </button>
              {Array.from({ length: steps + 1 }, (_, k) => (
                <button key={k} className={`step-dot ${k === step ? 'on' : ''}`} aria-pressed={k === step} onClick={() => goStep(k)} title={k === 0 ? 'Start' : ex.steps[k - 1]?.title}>{k === 0 ? '0' : k}</button>
              ))}
            </div>
          )}
        </div>
        {step > 0 && step <= ex.steps.length && (playing || step < steps) && (
          <div className="step-caption glass" aria-live="polite"><span className="label">Step {step}</span> {ex.steps[step - 1]!.title}</div>
        )}
      </div>}

      <aside className="panel">
        <header className="panel-head">
          {!model && <span className="chip subject" style={{ justifySelf: 'start' }}>{SUBJECT_LABEL[ex.subject] ?? ex.subject}{ex.grade ? ` · Class ${ex.grade}` : ''}</span>}
          <h1 className="h2">{ex.title}</h1>
          <p className="muted">{ex.topic}{ex.gradeLevel ? ` · ${ex.gradeLevel}` : ''}</p>
          <div className="row">
            <button className="btn btn-sm" onClick={doShare} disabled={share.busy}>{share.busy ? 'Creating link…' : '🔗 Share'}</button>
            <Link href="/new" className="btn btn-sm">＋ New question</Link>
          </div>
          {share.url && <p className="small">Link ready: <a href={share.url}>{share.url}</a></p>}
          {share.error && <p className="small error-text">{share.error}</p>}
        </header>

        <nav className="tabs" role="tablist">
          {([...(hw ? ['homework'] : []), 'explain', ...(ex.parts.length ? ['parts'] : []), 'video', 'terms'] as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
              {t === 'homework' ? '✏️ Homework' : t === 'explain' ? (hw ? '📖 Learn' : 'Explain') : t === 'parts' ? `Parts (${ex.parts.length})` : t === 'video' ? '▶ Video' : 'Key terms'}
            </button>
          ))}
        </nav>

        {tab === 'homework' && hw && (
          <div className="stack">
            <div className="question-card glass">
              <span className="label">Question</span>
              <p>{hw.question || ex.summary}</p>
            </div>
            {hw.hints.length > 0 && (
              <div className="stack" style={{ gap: 8 }}>
                {hw.hints.slice(0, hints).map((h, i) => <div key={i} className="hint"><span className="label">💡 Hint {i + 1}</span> {h}</div>)}
                {hints < hw.hints.length && !showSteps && (
                  <button className="btn" onClick={() => setHints((n) => n + 1)}>💡 {hints === 0 ? 'Give me a hint' : 'Another hint'} ({hints}/{hw.hints.length})</button>
                )}
              </div>
            )}
            {!showSteps ? (
              <button className="btn btn-primary" onClick={() => { setShowSteps(true); setHints(hw.hints.length); if (model) goStep(1); }}>🪜 Show me how to solve it</button>
            ) : (
              <>
                <span className="label">Step-by-step solution{model ? ' · tap a step to see it in 3D' : ''}</span>
                {walk}
                {!showAnswer ? (
                  <button className="btn btn-primary" onClick={() => setShowAnswer(true)}>✅ Show the final answer</button>
                ) : (
                  <div className="answer-card">
                    <span className="label">Final answer</span>
                    <div className="prose" dangerouslySetInnerHTML={{ __html: md(hw.answerMarkdown) }} />
                    {hw.checks.length > 0 && (
                      <ul className="checks">
                        {hw.checks.map((k, i) => (
                          <li key={i} className={k.ok === false ? 'bad' : k.ok ? 'good' : ''}>
                            {k.ok ? '✔︎' : k.ok === false ? '⚠︎' : '•'} <strong>{k.label}</strong>: {k.expression} = {k.computed != null ? +k.computed.toPrecision(8) : '?'}
                            {k.ok === false && <span className="block small">The AI said {k.claimed}. Please check this step carefully.</span>}
                          </li>
                        ))}
                        <li className="fine">Numbers re-calculated by Pop-Up Science’s own calculator.</li>
                      </ul>
                    )}
                  </div>
                )}
              </>
            )}
            {showAnswer && hw.practice.length > 0 && (
              <div className="stack" style={{ gap: 8 }}>
                <span className="label">🎯 Try one yourself</span>
                {hw.practice.map((q, i) => (
                  <div key={i} className="practice glass">
                    <p style={{ margin: 0 }}>{q.question}</p>
                    {practiceOpen.includes(i)
                      ? <p className="small" style={{ margin: '8px 0 0' }}><strong>Answer:</strong> {q.answer}</p>
                      : <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => setPracticeOpen((o) => [...o, i])}>Check my answer</button>}
                  </div>
                ))}
              </div>
            )}
            {ex.warnings.length > 0 && <div className="alert warn"><strong>Notes:</strong><ul>{ex.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></div>}
            <p className="fine">Understand each step, then write the answer in your own words. AI can make mistakes. Check with your textbook or teacher.</p>
          </div>
        )}

        {tab === 'explain' && (
          <div className="stack">
            <p className="lead-sm">{ex.summary}</p>
            {!hw && walk}
            <div className="prose" dangerouslySetInnerHTML={{ __html: md(ex.descriptionMarkdown) }} />
            {ex.funFact && <div className="funfact"><span className="label">Did you know?</span> {ex.funFact}</div>}
            <button className="btn video-teaser" onClick={() => setTab('video')}>▶ Watch a video lesson on this topic</button>
            {src.photo && (
              <details className="photo-cmp"><summary>Compare with your photo</summary><img src={src.photo} alt="Your original photo" /></details>
            )}
            {ex.warnings.length > 0 && <div className="alert warn"><strong>Notes from the AI:</strong><ul>{ex.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></div>}
            <p className="fine">{src.kind === 'example' ? 'Example model made by hand.' : `Explanation${model ? ' and 3D model' : ''} by AI${src.model ? ` (${src.model})` : ''}, built by Pop-Up Science.`} {model ? 'Models are simplified, not to scale. ' : ''}AI can make mistakes.</p>
          </div>
        )}

        {tab === 'parts' && (
          <ul className="parts">
            {ex.parts.length === 0 && <li className="muted">No labelled parts.</li>}
            {ex.parts.map((p) => (
              <li key={p.id} id={`part-${p.id}`}>
                <button className={`part ${selected === p.id ? 'on' : ''}`} onClick={() => select(selected === p.id ? null : p.id)} aria-pressed={selected === p.id}>
                  <strong>{p.name}</strong><span className="muted small">{p.description}</span>
                </button>
              </li>
            ))}
            <li className="fine">Tip: tap a part here or on the model to highlight it.</li>
          </ul>
        )}

        {tab === 'video' && <Videos query={ex.videoQuery} lang={src.lang} />}

        {tab === 'terms' && (
          <dl className="terms">
            {ex.keyTerms.map((t, i) => <div key={i}><dt>{t.term}</dt><dd className="muted">{t.meaning}</dd></div>)}
            {ex.keyTerms.length === 0 && <p className="muted">No key terms.</p>}
          </dl>
        )}
      </aside>
    </div>
  );
}
