/** Real YouTube lessons (YouTube Data API via our server) or, without a key, an honest search link. */
import { useEffect, useState } from 'react';
import { findVideos, type Video } from '../lib/api';

const dur = (s: number | null) => (s == null ? '' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
const views = (n: number | null) => (n == null ? '' : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M views` : n >= 1e3 ? `${Math.round(n / 1e3)}K views` : `${n} views`);

export function Videos({ query, lang }: { query: string; lang: string }) {
  const [q, setQ] = useState(query);
  const [draft, setDraft] = useState(query);
  const [state, setState] = useState<{ loading: boolean; configured?: boolean; videos: Video[]; searchUrl?: string; error?: string }>({ loading: true, videos: [] });
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setState({ loading: true, videos: [] }); setPlaying(null);
    findVideos(q, lang).then(
      (r) => live && setState({ loading: false, configured: r.configured, videos: r.videos, searchUrl: r.searchUrl }),
      (e) => live && setState({ loading: false, videos: [], error: e.message, searchUrl: e.extra?.searchUrl ?? `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}` }),
    );
    return () => { live = false; };
  }, [q, lang]);

  return (
    <div className="stack videos">
      <form className="row" onSubmit={(e) => { e.preventDefault(); const v = draft.trim(); if (v) setQ(v.slice(0, 100)); }}>
        <input className="grow" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="YouTube search" maxLength={100} />
        <button className="btn btn-sm" type="submit">Search</button>
      </form>
      {state.loading && <div className="vid-skel" aria-label="Loading videos" />}
      {!state.loading && state.configured && state.videos.length === 0 && !state.error && <p className="muted">No matching lessons found. Try different words.</p>}
      {state.error && <div className="alert warn">{state.error}</div>}
      {state.videos.map((v) => (
        <article key={v.id} className="vid glass">
          {playing === v.id ? (
            <div className="vid-frame">
              <iframe src={`https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0`} title={v.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
            </div>
          ) : (
            <button className="vid-thumb" onClick={() => setPlaying(v.id)} aria-label={`Play: ${v.title}`}>
              <img src={v.thumbnail} alt="" loading="lazy" />
              <span className="play" aria-hidden="true">▶</span>
              {v.durationSec != null && <span className="dur">{dur(v.durationSec)}</span>}
            </button>
          )}
          <div className="vid-meta">
            <strong>{v.title}</strong>
            <span className="muted small">{v.channel}{v.views != null ? ` · ${views(v.views)}` : ''}{v.trusted ? ' · ' : ''}{v.trusted && <span className="tag ok">Education channel</span>}</span>
            <a className="small" href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer">Open on YouTube ↗</a>
          </div>
        </article>
      ))}
      {!state.loading && (state.configured === false || state.error) && state.searchUrl && (
        <a className="btn btn-primary yt-btn" href={state.searchUrl} target="_blank" rel="noopener noreferrer">▶ Watch lessons on YouTube: “{q}” ↗</a>
      )}
      {!state.loading && state.configured === false && <p className="fine">Matching videos can play right here once the site owner adds a free YouTube API key. Until then, this button opens YouTube’s own search results for this topic.</p>}
      {state.videos.length > 0 && <p className="fine">Real videos found with YouTube search. They are made by their creators, not by Pop-Up Science.</p>}
    </div>
  );
}
