/** React wrapper around the 3D engine. Pauses when off-screen or the tab is hidden. */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Explanation } from '../../shared/scene';
import { PopEngine, webglAvailable } from '../three/engine';
import { useInView, usePageVisible, useReducedMotion } from '../lib/hooks';

export interface StageHandle { snapshot(title: string): string | null; focus(parts: string[] | null): void; resetView(): void }
interface Props {
  explanation: Explanation;
  step?: number;
  explode?: number;
  autoRotate?: boolean;
  labels?: boolean;
  highlight?: string[] | null;
  onSelect?: (part: string | null) => void;
  hero?: boolean;
  className?: string;
}

const lowPower = () => {
  const q = new URLSearchParams(location.search);
  if (q.has('lowpower')) return true;
  return (navigator.hardwareConcurrency || 8) <= 4;
};

export const Stage = forwardRef<StageHandle, Props>(function Stage({ explanation, step = 99, explode = 0, autoRotate = true, labels = true, highlight = null, onSelect, hero, className }, ref) {
  const [hostRef, inView] = useInView<HTMLDivElement>();
  const pageVisible = usePageVisible();
  const reduced = useReducedMotion();
  const engine = useRef<PopEngine | null>(null);
  const [failed, setFailed] = useState(false);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (!webglAvailable()) { setFailed(true); return; }
    let e: PopEngine;
    try { e = new PopEngine(host, { onSelect: (p) => selectRef.current?.(p), reducedMotion: reduced, lowPower: lowPower(), hero }); }
    catch { setFailed(true); return; }
    engine.current = e;
    return () => { e.dispose(); engine.current = null; };
  }, [reduced, hero]);

  useEffect(() => { engine.current?.load(explanation); }, [explanation, reduced, hero]);
  useEffect(() => { engine.current?.setStep(step); }, [step, explanation, reduced]);
  useEffect(() => { engine.current?.setExplode(explode); }, [explode, reduced]);
  useEffect(() => { engine.current?.setAutoRotate(autoRotate && !reduced); }, [autoRotate, reduced]);
  useEffect(() => { engine.current?.setLabels(labels); }, [labels, reduced]);
  useEffect(() => { engine.current?.setHighlight(highlight); }, [highlight?.join('|'), explanation, reduced]);
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    if (inView && pageVisible) e.start(); else e.stop();
  }, [inView, pageVisible, reduced, hero]);

  useImperativeHandle(ref, () => ({
    snapshot: (title) => engine.current?.snapshot(title) ?? null,
    focus: (parts) => engine.current?.focus(parts),
    resetView: () => engine.current?.resetView(),
  }), []);

  return (
    <div ref={hostRef} className={`stage ${className ?? ''}`} data-testid="stage">
      {failed && (
        <div className="stage-fallback">
          <p><strong>3D isn’t available in this browser.</strong></p>
          <p className="muted">WebGL is turned off or not supported. The explanation, parts and videos below still work.</p>
        </div>
      )}
    </div>
  );
});
