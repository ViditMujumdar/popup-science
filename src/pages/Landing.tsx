import { useMemo, useState } from 'react';
import { Stage } from '../components/Stage';
import { Link } from '../lib/router';
import { EXAMPLE_IDS, EXAMPLE_META, getExample } from '../../shared/examples';
import { getRecent } from '../lib/local';

export default function Landing() {
  const examples = useMemo(() => EXAMPLE_IDS.map((id) => ({ id, ex: getExample(id)!, meta: EXAMPLE_META[id]! })), []);
  const [hero, setHero] = useState('atom');
  const heroEx = useMemo(() => getExample(hero)!, [hero]);
  const recent = useMemo(() => getRecent(), []);

  return (
    <div className="landing">
      <section className="hero">
        <div className="hero-stage" aria-hidden="true"><Stage explanation={heroEx} hero autoRotate labels={false} /></div>
        <div className="hero-copy">
          <span className="chip glow-chip">📸 → 🧊 Homework help · Class 1–12</span>
          <h1 className="display">Stuck on homework?<br /><em>Watch it pop up in 3D.</em></h1>
          <p className="lead">Snap your homework or any textbook diagram, from Class 1 to Class 12. Get hints first, then a step-by-step solution, a 3D model you can spin and explore, and a real video lesson on the topic. It explains things at your class level, in English, Hindi and 6 more languages.</p>
          <div className="row">
            <Link href="/new" className="btn btn-primary btn-lg">📸 Snap my homework</Link>
            <Link href={`/view?ex=${hero}`} className="btn btn-lg">Open this model →</Link>
          </div>
          <div className="row hero-switch" role="group" aria-label="Preview model">
            {examples.map(({ id, meta }) => (
              <button key={id} className={`pill ${hero === id ? 'on' : ''}`} aria-pressed={hero === id} onClick={() => setHero(id)}>{meta.emoji} {meta.short}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="page">
        <div className="steps3">
          {[
            ['1', 'Snap or type', 'A maths sum, a science question or a textbook diagram. Pick your class, from 1 to 12.'],
            ['2', 'Think first', 'Get hints that help you work it out yourself. Then see every step, and the model builds up in 3D as you go.'],
            ['3', 'Understand', 'Get the final answer (with the maths re-checked), a “try one yourself” question and a video lesson.'],
          ].map(([n, t, d]) => (
            <div key={n} className="card glass"><span className="num">{n}</span><h3>{t}</h3><p className="muted">{d}</p></div>
          ))}
        </div>

        <h2 className="h2" style={{ marginTop: 48 }}>Try a ready-made one</h2>
        <p className="muted">These examples were made by hand and work without AI.</p>
        <div className="grid-cards">
          {examples.map(({ id, ex, meta }) => (
            <Link key={id} href={`/view?ex=${id}`} className="card glass example-card">
              <span className="emoji" aria-hidden="true">{meta.emoji}</span>
              <span className="label">{meta.subject}</span>
              <h3>{ex.title}</h3>
              <p className="muted small">{ex.summary}</p>
            </Link>
          ))}
        </div>

        {recent.length > 0 && (
          <>
            <h2 className="h2" style={{ marginTop: 48 }}>Your recent pop-ups</h2>
            <div className="grid-cards">
              {recent.map((r) => (
                <Link key={r.id} href={`/view?r=${r.id}`} className="card glass example-card">
                  <span className="label">{r.explanation.subject} · {new Date(r.at).toLocaleDateString()}</span>
                  <h3>{r.explanation.title}</h3>
                  <p className="muted small">{r.explanation.summary}</p>
                </Link>
              ))}
            </div>
          </>
        )}

        <p className="fine">AI can make mistakes and 3D models are simplified, so check important details with your textbook or teacher. Pop-Up Science helps you learn: read the hints and steps, then write the answer in your own words. Photos are sent to the AI only to explain them and are not stored. No sign-up and no ads.</p>
      </section>
    </div>
  );
}
