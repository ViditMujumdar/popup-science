import { Component, lazy, Suspense, type ReactNode } from 'react';
import { Link, useLocation } from './lib/router';
import Landing from './pages/Landing';

const New = lazy(() => import('./pages/New'));
const View = lazy(() => import('./pages/View'));

/** True when a lazily loaded page file is missing, e.g. the app was updated while this tab was open. */
const isStaleBuild = (e: unknown) => /dynamically imported module|Importing a module script failed|error loading dynamically imported|Failed to fetch/i.test(String((e as Error)?.message ?? e));

class Boundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state: { err: Error | null } = { err: null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidCatch(err: Error) {
    console.error(err);
    if (!isStaleBuild(err)) return;
    // The app was updated: reload once to fetch the new files (this tab's pop-up is kept in sessionStorage).
    let last = 0;
    try { last = Number(sessionStorage.getItem('pop:reloaded') || 0); sessionStorage.setItem('pop:reloaded', String(Date.now())); } catch { /* ignore */ }
    if (Date.now() - last > 15_000) location.reload();
  }
  render() {
    const { err } = this.state;
    if (err) return (
      <div className="page narrow stack">
        <h1 className="h2">{isStaleBuild(err) ? 'Pop-Up Science was updated. Reloading…' : 'Something went wrong on this screen.'}</h1>
        <p className="muted">Your latest pop-up is kept in this tab, so reloading will bring it back.</p>
        <div className="row"><button className="btn btn-primary" onClick={() => location.reload()}>Reload</button><a className="btn" href="/">Home</a></div>
        <p className="fine">Details: {String(err.message || err).slice(0, 200)}</p>
      </div>
    );
    return this.props.children;
  }
}

function Routes() {
  const { path } = useLocation();
  let page: ReactNode;
  if (path === '/') page = <Landing />;
  else if (path === '/new') page = <New />;
  else if (path === '/view') page = <View />;
  else if (path.startsWith('/s/')) page = <View shareId={decodeURIComponent(path.slice(3))} />;
  else page = (
    <div className="page narrow stack">
      <span className="label">404</span><h1 className="h2">This page didn’t pop up.</h1>
      <Link href="/" className="btn btn-primary">Go home</Link>
    </div>
  );
  return <Boundary key={path}><Suspense fallback={<div className="page"><p className="label">Loading…</p></div>}>{page}</Suspense></Boundary>;
}

export default function App() {
  return (
    <>
      <a href="#main" className="sr-only">Skip to content</a>
      <header className="topbar">
        <Link href="/" className="brand"><svg viewBox="0 0 64 64" width="26" height="26" aria-hidden="true"><path d="M32 10 52 21v22L32 54 12 43V21z" fill="none" stroke="#d4ff3a" strokeWidth="5" strokeLinejoin="round" /><path d="M12 21l20 11 20-11M32 32v22" fill="none" stroke="#4fe3f0" strokeWidth="4" strokeLinejoin="round" /></svg><span>Pop-Up <em>Science</em></span></Link>
        <nav className="row"><Link href="/view?ex=atom" className="nav-link">Examples</Link><Link href="/new" className="btn btn-sm btn-primary">📸 Snap</Link></nav>
      </header>
      <main id="main"><Routes /></main>
    </>
  );
}
