import { useEffect, useRef, useState } from 'react';
import { LANGUAGES, type LanguageCode } from '../../shared/scene';
import { ApiError, explain, getHealth, type Health } from '../lib/api';
import { prepareImage } from '../lib/image';
import { addRecent, setCurrent } from '../lib/local';
import { Link, navigate } from '../lib/router';

const load = (k: string, d: string) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const save = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

export default function New() {
  const [health, setHealth] = useState<Health | null | 'down'>(null);
  const [photo, setPhoto] = useState<{ blob: Blob; dataUrl: string } | null>(null);
  const [note, setNote] = useState('');
  const [grade, setGrade] = useState<number | null>(() => { const g = Number(load('pop:grade', '')); return g >= 1 && g <= 12 ? g : null; });
  const [lang, setLang] = useState<LanguageCode>(() => load('pop:lang', 'en') as LanguageCode);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const pick = useRef<HTMLInputElement>(null);
  const cam = useRef<HTMLInputElement>(null);

  useEffect(() => { getHealth().then(setHealth, () => setHealth('down')); }, []);
  useEffect(() => { import('./View').catch(() => {}); }, []); // preload the result page so it opens instantly
  useEffect(() => {
    if (!busy) return;
    const t0 = Date.now(); setElapsed(0);
    const id = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(id);
  }, [busy]);
  useEffect(() => () => abort.current?.abort(), []);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    try { const p = await prepareImage(f); setPhoto({ blob: p.blob, dataUrl: p.dataUrl }); }
    catch (e) { setError((e as Error).message); }
  };

  const ready = Boolean(photo || note.trim().length >= 3);
  const go = async () => {
    if (!ready || busy) return;
    setBusy(true); setError(null);
    save('pop:lang', lang); if (grade) save('pop:grade', String(grade));
    const ctl = new AbortController(); abort.current = ctl;
    const timer = setTimeout(() => ctl.abort(new DOMException('timeout', 'TimeoutError')), 150_000);
    try {
      const r = await explain(photo?.blob ?? null, note, lang, grade, ctl.signal);
      setCurrent({ explanation: r.explanation, photo: photo?.dataUrl ?? null, lang: r.lang, model: r.model });
      addRecent(r.explanation);
      navigate('/view');
    } catch (e) {
      const err = e as ApiError;
      if (err.code !== 'aborted') setError(ctl.signal.reason?.name === 'TimeoutError' ? 'The AI took too long (over 2½ minutes). Please try again.' : err.message || 'Something went wrong.');
    } finally {
      clearTimeout(timer); setBusy(false); abort.current = null;
    }
  };

  const aiDown = health === 'down' ? 'The server cannot be reached right now.' : health && !health.ai.configured ? 'AI is not set up on this server yet (the owner needs to add a Gemini key). You can still explore the example models.' : null;

  return (
    <div className="page narrow">
      <span className="label">Homework helper · Class 1–12</span>
      <h1 className="h1">What are you stuck on?</h1>
      <p className="muted">Snap your homework or a textbook diagram, or type the question. You’ll get hints first, then the full solution, a 3D model whenever a picture helps, and a video lesson.</p>

      {aiDown && <div className="alert warn" role="status">{aiDown} <Link href="/view?ex=fractions">Open an example →</Link></div>}

      <div className="field" style={{ marginTop: 18 }}>
        <span className="label">Your class</span>
        <div className="grade-row" role="radiogroup" aria-label="Your class">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
            <button key={g} type="button" role="radio" aria-checked={grade === g} className={`grade-chip ${grade === g ? 'on' : ''}`} onClick={() => setGrade(g)} disabled={busy}>{g}</button>
          ))}
        </div>
        {!grade && <span className="small muted">Pick your class so the explanation fits you.</span>}
      </div>

      <div className={`dropzone glass ${photo ? 'has' : ''} ${busy ? 'scanning' : ''}`}
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}>
        {photo ? (
          <div className="preview">
            <img src={photo.dataUrl} alt="Your homework photo" />
            {busy && <div className="scanline" aria-hidden="true" />}
          </div>
        ) : (
          <div className="stack center" style={{ padding: '28px 12px 8px' }}>
            <div className="big-emoji" aria-hidden="true">📚</div>
            <p style={{ margin: 0 }}><strong>Take a photo of your homework or diagram</strong></p>
            <p className="muted small" style={{ margin: 0 }}>One question or diagram per photo, flat and well lit</p>
          </div>
        )}
        <div className="row center" style={{ padding: 12 }}>
          <button className="btn" type="button" onClick={() => cam.current?.click()} disabled={busy}>📷 Camera</button>
          <button className="btn" type="button" onClick={() => pick.current?.click()} disabled={busy}>🖼️ {photo ? 'Change photo' : 'Choose photo'}</button>
          {photo && <button className="btn" type="button" onClick={() => setPhoto(null)} disabled={busy}>✕ Remove</button>}
          <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
          <input ref={pick} type="file" accept="image/jpeg,image/png,image/webp,image/*" hidden data-testid="file" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
      </div>

      <label className="field">
        <span className="label">{photo ? 'Anything to add? (optional)' : '…or type your question'}</span>
        <textarea value={note} maxLength={1500} rows={photo ? 2 : 4} onChange={(e) => setNote(e.target.value)} disabled={busy}
          placeholder={photo ? 'e.g. only question 3, or “explain the heart diagram”' : 'e.g. Riya ate 3/8 of a chocolate bar and Aman ate 1/4. How much is left?'} />
      </label>

      <label className="field" style={{ marginTop: 12, maxWidth: 320 }}>
        <span className="label">Explain in</span>
        <select value={lang} onChange={(e) => setLang(e.target.value as LanguageCode)} disabled={busy}>
          {Object.entries(LANGUAGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>

      {error && <div className="alert error" role="alert">{error}</div>}

      <div className="row" style={{ marginTop: 18 }}>
        <button className="btn btn-primary btn-lg" onClick={go} disabled={!ready || busy || !!aiDown}>
          {busy ? `Working on it… ${elapsed}s` : '✨ Help me understand'}
        </button>
        {busy && <button className="btn" onClick={() => abort.current?.abort()}>Cancel</button>}
      </div>
      {busy && <p className="muted small" role="status">The AI is reading your homework, working out the solution and building a 3D model. This usually takes 20–90 seconds.</p>}
      <p className="fine">Pop-Up Science helps you learn. Read the hints and steps, then write the answer in your own words.</p>
    </div>
  );
}
