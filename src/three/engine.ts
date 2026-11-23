/**
 * Pop-Up Science 3D engine. Builds a scene ONLY from sanitized primitive descriptions
 * (shared/scene.ts); nothing from the AI is executed or injected as markup.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Explanation, SceneObject } from '../../shared/scene';

const DEG = Math.PI / 180;
const AXIS = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) } as const;
const UP = new THREE.Vector3(0, 1, 0);
const BASE_PAIRS: [string, string][] = [['#ff5a5a', '#ffd23f'], ['#3ddc84', '#4f8cff'], ['#ffd23f', '#ff5a5a'], ['#4f8cff', '#3ddc84']];
const easeOutBack = (x: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

interface Built {
  o: SceneObject;
  holder: THREE.Group; // position (+ explode, orbit, bob)
  rot: THREE.Group; // static rotation + reveal scale
  spin: THREE.Group; // spin / pulse
  materials: THREE.Material[];
  baseOpacity: number[];
  pickables: THREE.Object3D[];
  path?: THREE.Curve<THREE.Vector3>;
  pathGeo?: THREE.BufferGeometry[];
  beads?: { mesh: THREE.InstancedMesh; u: Float32Array; length: number };
  particles?: { geo: THREE.BufferGeometry; base: Float32Array; vel: Float32Array; spread: THREE.Vector3 };
  label?: CSS2DObject;
  basePos: THREE.Vector3;
  centroid: THREE.Vector3;
  reveal: number; // 0..1
  phase: number;
}

export interface EngineOptions {
  onSelect?: (part: string | null) => void;
  reducedMotion?: boolean;
  /** Smaller pixel ratio and no bloom (weak phones / headless). */
  lowPower?: boolean;
  /** Static hero mode: no labels, no picking. */
  hero?: boolean;
}

export class PopEngine {
  readonly renderer: THREE.WebGLRenderer;
  private labelRenderer: CSS2DRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 1, 0.05, 400);
  private controls: OrbitControls;
  private composer: EffectComposer | null = null;
  private content = new THREE.Group();
  private built: Built[] = [];
  private last = 0;
  private frameNo = 0;
  private t = 0;
  private step = Number.POSITIVE_INFINITY;
  private explode = 0;
  private explodeShown = 0;
  private highlight: Set<string> | null = null;
  private center = new THREE.Vector3();
  private fly: { t: number; dur: number; fromPos: THREE.Vector3; toPos: THREE.Vector3; fromTgt: THREE.Vector3; toTgt: THREE.Vector3 } | null = null;
  private running = false;
  private ro: ResizeObserver;
  private disposed = false;
  private home = { pos: new THREE.Vector3(), tgt: new THREE.Vector3() };
  private ground: THREE.Group = new THREE.Group();
  private stars: THREE.Points;
  private down: { x: number; y: number } | null = null;
  private raycaster = new THREE.Raycaster();
  labelsOn = true;

  constructor(private host: HTMLElement, private opts: EngineOptions = {}) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.lowPower ? 1.25 : 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.className = 'pop-canvas';
    host.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.className = 'pop-labels';
    host.appendChild(this.labelRenderer.domElement);

    this.scene.background = new THREE.Color('#060912');
    this.scene.fog = new THREE.FogExp2('#060912', 0.018);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environmentIntensity = 0.55;

    this.scene.add(new THREE.HemisphereLight('#bcd7ff', '#1a1030', 0.9));
    const key = new THREE.DirectionalLight('#ffffff', 1.25); key.position.set(4, 8, 6); this.scene.add(key);
    const rimA = new THREE.PointLight('#4fe3f0', 30, 30); rimA.position.set(-7, 3, -5); this.scene.add(rimA);
    const rimB = new THREE.PointLight('#ff4fd8', 24, 30); rimB.position.set(7, -2, -6); this.scene.add(rimB);

    this.stars = this.makeStars();
    this.scene.add(this.stars, this.ground, this.content);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.autoRotate = !opts.reducedMotion;
    this.controls.autoRotateSpeed = opts.hero ? 0.9 : 0.6;
    this.controls.minDistance = 1.2;
    this.controls.maxDistance = 40;
    this.controls.addEventListener('start', () => { this.fly = null; });
    if (opts.hero) { this.controls.enableZoom = false; this.controls.enablePan = false; }

    if (!opts.lowPower) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.75, 0.5, 0.9));
      this.composer.addPass(new OutputPass());
    }

    const el = this.renderer.domElement;
    if (!opts.hero) {
      el.addEventListener('pointerdown', this.onDown);
      el.addEventListener('pointerup', this.onUp);
    }
    el.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.stop(); host.dataset.lost = '1'; });

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
  }

  // ------------------------------------------------------------------ public API
  load(ex: Explanation) {
    this.clear();
    const objs = ex.scene.objects;
    for (const o of objs) {
      try { this.built.push(this.build(o)); } catch (e) { console.warn('skipped object', o.kind, e); }
    }
    const box = new THREE.Box3();
    for (const b of this.built) if (b.o.kind !== 'label') box.expandByObject(b.holder);
    if (box.isEmpty()) box.setFromCenterAndSize(new THREE.Vector3(), new THREE.Vector3(4, 4, 4));
    box.getCenter(this.center);
    for (const b of this.built) b.label && (b.label.element.style.opacity = '1');
    this.makeGround(box);
    this.frame(box);
    this.camera.position.copy(this.home.pos);
    this.controls.target.copy(this.home.tgt);
    this.controls.update();
    this.applyHighlight();
    this.render(0);
  }

  setStep(step: number) {
    this.step = step;
    for (const b of this.built) if (b.o.step > step) b.reveal = 0;
  }
  setExplode(f: number) { this.explode = Math.min(1, Math.max(0, f)); }
  setAutoRotate(on: boolean) { this.controls.autoRotate = on; }
  setLabels(on: boolean) { this.labelsOn = on; this.labelRenderer.domElement.style.display = on ? '' : 'none'; }

  /** Highlight parts (dim everything else). null = no highlight. */
  setHighlight(parts: string[] | null) {
    this.highlight = parts && parts.length ? new Set(parts) : null;
    this.applyHighlight();
  }

  /** Fly the camera to frame the given parts (or the whole model). */
  focus(parts: string[] | null) {
    const box = new THREE.Box3();
    for (const b of this.built) {
      if (parts && (!b.o.part || !parts.includes(b.o.part))) continue;
      if (b.o.kind === 'label' || !b.holder.visible) continue;
      box.expandByObject(b.holder);
    }
    if (box.isEmpty() || !parts) { this.flyTo(this.home.pos, this.home.tgt); return; }
    const c = box.getCenter(new THREE.Vector3());
    const r = Math.max(0.8, box.getSize(new THREE.Vector3()).length() / 2);
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    const dist = Math.max(2.4, (r / Math.sin((this.camera.fov * DEG) / 2)) * 1.1);
    this.flyTo(c.clone().add(dir.multiplyScalar(dist)), c);
  }
  resetView() { this.flyTo(this.home.pos, this.home.tgt); }

  start() {
    if (this.running || this.disposed) return;
    this.running = true;
    this.last = performance.now();
    this.renderer.setAnimationLoop((now: number) => { const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000)); this.last = now; this.render(dt); });
  }
  stop() { this.running = false; this.renderer.setAnimationLoop(null); }

  /** PNG of the current view (with labels baked in as text). */
  snapshot(title: string): string {
    this.render(0);
    const src = this.renderer.domElement;
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const g = c.getContext('2d')!;
    g.drawImage(src, 0, 0);
    const s = c.width / this.host.clientWidth;
    g.font = `600 ${Math.round(13 * s)}px Inter, system-ui, sans-serif`;
    g.textAlign = 'center';
    if (this.labelsOn) for (const b of this.built) {
      if (!b.label || !b.holder.visible || b.label.element.style.display === 'none') continue;
      const p = new THREE.Vector3(); b.label.getWorldPosition(p); p.project(this.camera);
      if (p.z < -1 || p.z > 1) continue;
      const x = (p.x * 0.5 + 0.5) * c.width, y = (-p.y * 0.5 + 0.5) * c.height;
      const text = b.label.element.textContent ?? '';
      const w = g.measureText(text).width + 14 * s;
      g.fillStyle = 'rgba(6,9,18,0.72)'; g.fillRect(x - w / 2, y - 12 * s, w, 22 * s);
      g.fillStyle = '#f4f1e8'; g.fillText(text, x, y + 4 * s);
    }
    g.textAlign = 'left';
    g.font = `400 ${Math.round(22 * s)}px "Instrument Serif", Georgia, serif`;
    g.fillStyle = '#f4f1e8'; g.fillText(title, 16 * s, 34 * s);
    g.font = `600 ${Math.round(11 * s)}px Inter, system-ui, sans-serif`;
    g.fillStyle = '#d4ff3a'; g.fillText('POP-UP SCIENCE', 16 * s, c.height - 16 * s);
    return c.toDataURL('image/png');
  }

  dispose() {
    this.disposed = true;
    this.stop();
    this.ro.disconnect();
    this.clear();
    this.controls.dispose();
    this.composer?.dispose();
    this.stars.geometry.dispose(); (this.stars.material as THREE.Material).dispose();
    this.scene.environment?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labelRenderer.domElement.remove();
  }

  // ------------------------------------------------------------------ internals
  private resize() {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.labelRenderer.setSize(w, h);
    this.composer?.setSize(w, h);
    if (!this.running) this.render(0);
  }

  private frame(box: THREE.Box3) {
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const r = Math.max(1.5, sphere.radius);
    const vfov = this.camera.fov * DEG;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    const fov = Math.min(vfov, hfov);
    const dist = (r / Math.sin(fov / 2)) * (this.opts.hero ? (this.camera.aspect < 1 ? 0.72 : 0.85) : this.camera.aspect < 1 ? 1.12 : 0.9);
    const dir = new THREE.Vector3(0.42, 0.32, 1).normalize();
    this.home.tgt.copy(sphere.center);
    this.home.pos.copy(sphere.center).add(dir.multiplyScalar(dist));
  }

  private flyTo(pos: THREE.Vector3, tgt: THREE.Vector3) {
    this.fly = { t: 0, dur: this.opts.reducedMotion ? 0.01 : 0.9, fromPos: this.camera.position.clone(), toPos: pos.clone(), fromTgt: this.controls.target.clone(), toTgt: tgt.clone() };
  }

  private onDown = (e: PointerEvent) => { this.down = { x: e.clientX, y: e.clientY }; };
  private onUp = (e: PointerEvent) => {
    if (!this.down) return;
    const moved = Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y);
    this.down = null;
    if (moved > 6) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const targets = this.built.filter((b) => b.holder.visible && b.o.part).flatMap((b) => b.pickables);
    const hit = this.raycaster.intersectObjects(targets, false)[0];
    this.opts.onSelect?.((hit?.object.userData.part as string | undefined) ?? null);
  };

  private applyHighlight() {
    for (const b of this.built) {
      const on = !this.highlight || (b.o.part != null && this.highlight.has(b.o.part));
      b.materials.forEach((m, i) => {
        const base = b.baseOpacity[i]!;
        const target = on ? base : Math.min(base, 0.12);
        m.opacity = target;
        m.transparent = target < 0.999 || (m as any).userData?.alwaysTransparent;
        m.depthWrite = target >= 0.999;
        m.needsUpdate = true;
      });
      if (b.label) b.label.element.classList.toggle('dim', !on);
    }
  }

  private clear() {
    for (const b of this.built) {
      b.holder.traverse((n) => {
        const m = n as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (n instanceof CSS2DObject) n.element.remove();
      });
      b.materials.forEach((m) => m.dispose());
    }
    this.built = [];
    this.content.clear();
    this.ground.traverse((n) => { const m = n as THREE.Mesh; m.geometry?.dispose(); (m.material as THREE.Material | undefined)?.dispose?.(); });
    this.ground.clear();
  }

  private material(o: SceneObject, basic = false): THREE.Material {
    const c = new THREE.Color(o.color);
    const transparent = o.opacity < 0.999;
    if (basic) return new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(o.glow ? 2.2 : 1.25), transparent, opacity: o.opacity, toneMapped: !o.glow });
    const m = new THREE.MeshPhysicalMaterial({
      color: c, roughness: transparent ? 0.08 : 0.38, metalness: 0.12, clearcoat: 0.7, clearcoatRoughness: 0.25,
      emissive: c, emissiveIntensity: o.glow ? 2.4 : 0.06, transparent, opacity: o.opacity, depthWrite: !transparent,
      side: o.kind === 'plane' || transparent ? THREE.DoubleSide : THREE.FrontSide,
    });
    return m;
  }

  private pathCurve(o: SceneObject, straight: boolean): THREE.Curve<THREE.Vector3> {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i + 2 < o.points.length; i += 3) {
      const v = new THREE.Vector3(o.points[i], o.points[i + 1], o.points[i + 2]);
      if (!pts.length || pts[pts.length - 1]!.distanceTo(v) > 1e-4) pts.push(v);
    }
    if (pts.length < 2) throw new Error('degenerate path');
    if (!straight && pts.length > 2) return new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const cp = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 0; i + 1 < pts.length; i++) cp.add(new THREE.LineCurve3(pts[i]!, pts[i + 1]!));
    return cp;
  }

  private build(o: SceneObject): Built {
    const holder = new THREE.Group(), rot = new THREE.Group(), spin = new THREE.Group();
    holder.add(rot); rot.add(spin);
    const b: Built = { o, holder, rot, spin, materials: [], baseOpacity: [], pickables: [], basePos: new THREE.Vector3(...o.position), centroid: new THREE.Vector3(...o.position), reveal: o.step === 0 ? 1 : 0, phase: Math.random() * Math.PI * 2 };
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D = spin) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData.part = o.part;
      parent.add(mesh);
      b.pickables.push(mesh);
      return mesh;
    };
    const s = (i: number, d: number) => o.size[i] ?? d;
    const isPath = o.kind === 'arrow' || o.kind === 'tube' || o.kind === 'line';

    if (!isPath) {
      holder.position.copy(b.basePos);
      rot.rotation.set(o.rotation[0] * DEG, o.rotation[1] * DEG, o.rotation[2] * DEG);
    }

    let mat: THREE.Material | null = null;
    switch (o.kind) {
      case 'box': {
        const w = s(0, 1), h = s(1, w), d = s(2, w);
        mat = this.material(o);
        add(new RoundedBoxGeometry(w, h, d, 3, Math.min(w, h, d) * 0.12), mat);
        break;
      }
      case 'sphere': {
        mat = this.material(o);
        const m = add(new THREE.SphereGeometry(1, 48, 32), mat);
        const rx = s(0, 0.5);
        m.scale.set(rx, s(1, rx), s(2, rx));
        break;
      }
      case 'cylinder': {
        mat = this.material(o);
        add(new THREE.CylinderGeometry(s(2, s(0, 0.4)), s(0, 0.4), s(1, 1), 48), mat);
        break;
      }
      case 'cone': mat = this.material(o); add(new THREE.ConeGeometry(s(0, 0.4), s(1, 1), 48), mat); break;
      case 'torus': mat = this.material(o); add(new THREE.TorusGeometry(s(0, 1), Math.min(s(1, 0.08), s(0, 1) * 0.6), 20, 120), mat); break;
      case 'plane': mat = this.material(o); add(new THREE.PlaneGeometry(s(0, 2), s(1, s(0, 2))), mat); break;
      case 'helix': {
        const r = s(0, 0.6), h = s(1, 3), turns = Math.min(12, Math.max(0.5, s(2, 3)));
        const strand = (phase: number) => {
          const pts: THREE.Vector3[] = [];
          const n = Math.ceil(turns * 24);
          for (let i = 0; i <= n; i++) { const t = i / n, a = t * turns * Math.PI * 2 + phase; pts.push(new THREE.Vector3(Math.cos(a) * r, -h / 2 + t * h, Math.sin(a) * r)); }
          return new THREE.CatmullRomCurve3(pts);
        };
        const thick = Math.max(0.025, r * (o.double ? 0.09 : 0.08));
        mat = this.material(o);
        const c1 = strand(0);
        add(new THREE.TubeGeometry(c1, Math.ceil(turns * 48), thick, 10, false), mat);
        b.path = c1;
        if (o.double) {
          add(new THREE.TubeGeometry(strand(Math.PI), Math.ceil(turns * 48), thick, 10, false), mat);
          const rungs = Math.min(60, Math.round(turns * 10));
          const geo = new THREE.CylinderGeometry(thick * 0.55, thick * 0.55, 1, 8);
          const rm = new THREE.MeshPhysicalMaterial({ roughness: 0.4, clearcoat: 0.6, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.05 });
          const inst = new THREE.InstancedMesh(geo, rm, rungs * 2);
          const tmp = new THREE.Object3D(), col = new THREE.Color();
          for (let i = 0; i < rungs; i++) {
            const t = (i + 0.5) / rungs, a = t * turns * Math.PI * 2, y = -h / 2 + t * h;
            const p1 = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), p2 = new THREE.Vector3(-p1.x, y, -p1.z);
            const mid = new THREE.Vector3(0, y, 0);
            const pair = BASE_PAIRS[(i * 7 + (i >> 1)) % BASE_PAIRS.length]!;
            [[p1, mid, pair[0]], [mid, p2, pair[1]]].forEach(([a1, a2, cc], k) => {
              const A = a1 as THREE.Vector3, B = a2 as THREE.Vector3;
              const dir = B.clone().sub(A);
              tmp.position.copy(A).add(B).multiplyScalar(0.5);
              tmp.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
              tmp.scale.set(1, dir.length(), 1);
              tmp.updateMatrix();
              inst.setMatrixAt(i * 2 + k, tmp.matrix);
              inst.setColorAt(i * 2 + k, col.set(cc as string));
            });
          }
          inst.userData.part = o.part;
          spin.add(inst); b.pickables.push(inst); b.materials.push(rm); b.baseOpacity.push(1);
        }
        break;
      }
      case 'particles': {
        const n = o.count;
        const sx = s(0, 2) / 2, sy = s(1, s(0, 2)) / 2, sz = s(2, s(0, 2)) / 2;
        const pos = new Float32Array(n * 3), vel = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
          // uniform-ish inside an ellipsoid
          let x = 0, y = 0, z = 0;
          do { x = Math.random() * 2 - 1; y = Math.random() * 2 - 1; z = Math.random() * 2 - 1; } while (x * x + y * y + z * z > 1);
          pos.set([x * sx, y * sy, z * sz], i * 3);
          vel.set([(Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6], i * 3);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const pm = new THREE.PointsMaterial({ color: new THREE.Color(o.color).multiplyScalar(1.6), size: 0.13, map: dotTexture(), transparent: true, opacity: o.opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
        (pm.userData as any).alwaysTransparent = true;
        const pts = new THREE.Points(geo, pm);
        pts.userData.part = o.part;
        spin.add(pts);
        b.materials.push(pm); b.baseOpacity.push(o.opacity);
        b.particles = { geo, base: pos.slice(), vel, spread: new THREE.Vector3(sx, sy, sz) };
        break;
      }
      case 'label': break;
      case 'line': case 'tube': case 'arrow': {
        const straight = o.kind !== 'tube';
        const curve = this.pathCurve(o, straight);
        const len = curve.getLength();
        b.path = curve;
        const thick = o.kind === 'line' ? Math.min(0.06, s(0, 0.022)) : Math.min(0.4, s(0, 0.05));
        // thick flowing tubes are see-through so the moving beads stay visible inside (e.g. blood in a vessel)
        const seeThrough = o.kind === 'tube' && o.animation === 'flow' && thick > 0.07 && !this.opts.reducedMotion;
        mat = this.material(seeThrough ? { ...o, opacity: Math.min(o.opacity, 0.45) } : o, o.kind === 'line');
        b.pathGeo = [];
        let shaftCurve = curve;
        if (o.kind === 'arrow') {
          // shorten the last segment to make room for the head
          const pts: THREE.Vector3[] = [];
          for (let i = 0; i + 2 < o.points.length; i += 3) pts.push(new THREE.Vector3(o.points[i], o.points[i + 1], o.points[i + 2]));
          const end = pts[pts.length - 1]!, prev = pts[pts.length - 2]!;
          const dir = end.clone().sub(prev).normalize();
          const headLen = Math.min(end.distanceTo(prev) * 0.5, thick * 5.5);
          const shaftEnd = end.clone().sub(dir.clone().multiplyScalar(headLen));
          const cp = new THREE.CurvePath<THREE.Vector3>();
          for (let i = 0; i + 2 < pts.length; i++) cp.add(new THREE.LineCurve3(pts[i]!, pts[i + 1]!));
          cp.add(new THREE.LineCurve3(prev, shaftEnd));
          shaftCurve = cp;
          const head = add(new THREE.ConeGeometry(thick * 2.6, headLen, 24), mat, spin);
          head.position.copy(shaftEnd).add(dir.clone().multiplyScalar(headLen / 2));
          head.quaternion.setFromUnitVectors(UP, dir);
          head.name = 'head';
        }
        const segs = Math.min(400, Math.max(24, Math.ceil(len * 24)));
        const tube = new THREE.TubeGeometry(shaftCurve, segs, thick, o.kind === 'line' ? 6 : 12, false);
        add(tube, mat);
        b.pathGeo.push(tube);
        b.centroid = curve.getPointAt(0.5);
        if (o.animation === 'flow' && !this.opts.reducedMotion) this.addBeads(b, curve, len, thick);
        break;
      }
    }
    if (o.kind === 'helix' && o.animation === 'flow' && b.path && !this.opts.reducedMotion) this.addBeads(b, b.path, b.path.getLength(), 0.05);
    if (mat) { b.materials.unshift(mat); b.baseOpacity.unshift(mat.opacity); }

    // label
    if (o.label && !this.opts.hero) {
      const div = document.createElement('button');
      div.type = 'button';
      div.className = 'pop-label' + (o.kind === 'label' ? ' free' : '');
      div.textContent = o.label; // textContent: never HTML
      div.style.setProperty('--c', o.color);
      if (o.part) div.addEventListener('click', (e) => { e.stopPropagation(); this.opts.onSelect?.(o.part); });
      else div.tabIndex = -1;
      const lbl = new CSS2DObject(div);
      if (o.kind === 'label') lbl.position.set(0, 0, 0);
      else if (isPath) {
        const mid = b.path!.getPointAt(o.kind === 'line' ? 0.82 : 0.5);
        lbl.position.copy(mid).add(new THREE.Vector3(0, 0.28, 0));
      } else {
        rot.updateMatrixWorld(true);
        const bb = new THREE.Box3().setFromObject(rot);
        if (!bb.isEmpty()) lbl.position.set((bb.min.x + bb.max.x) / 2, bb.max.y + 0.25, (bb.min.z + bb.max.z) / 2);
      }
      lbl.center.set(0.5, 1);
      holder.add(lbl);
      b.label = lbl;
    }
    this.content.add(holder);
    return b;
  }

  private addBeads(b: Built, curve: THREE.Curve<THREE.Vector3>, len: number, thick: number) {
    const n = Math.round(Math.min(26, Math.max(4, len * 2.2)));
    const geo = new THREE.SphereGeometry(Math.min(0.11, Math.max(0.045, thick * 1.5)), 12, 8);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(b.o.color).lerp(new THREE.Color('#ffffff'), 0.4).multiplyScalar(1.7), toneMapped: false });
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    const u = new Float32Array(n);
    for (let i = 0; i < n; i++) u[i] = i / n;
    b.spin.add(mesh);
    b.materials.push(mat); b.baseOpacity.push(1);
    b.beads = { mesh, u, length: len };
  }

  private makeStars() {
    const n = 1400, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(40 + Math.random() * 60);
      pos.set([v.x, v.y, v.z], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ color: '#9fb4ff', size: 0.35, map: dotTexture(), transparent: true, opacity: 0.8, depthWrite: false, fog: false }));
  }

  private makeGround(box: THREE.Box3) {
    const size = box.getSize(new THREE.Vector3());
    const r = Math.max(3, Math.hypot(size.x, size.z) * 0.75);
    const y = box.min.y - 0.35;
    const grid = new THREE.PolarGridHelper(r, 12, 6, 96, '#2a4a6a', '#1a2a40');
    (grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = 0.55;
    grid.position.set(this.center.x, y, this.center.z);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(r * 1.05, 64), new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.rotation.x = -Math.PI / 2; glow.position.set(this.center.x, y - 0.01, this.center.z);
    this.ground.add(glow, grid);
  }

  private render(dt: number) {
    const motion = this.opts.reducedMotion ? 0 : 1;
    this.t += dt * motion;
    const t = this.t;
    this.explodeShown += (this.explode - this.explodeShown) * Math.min(1, dt * 8 || 1);

    for (const b of this.built) {
      const o = b.o;
      const visible = o.step <= this.step;
      b.holder.visible = visible;
      if (!visible) continue;
      if (b.reveal < 1) b.reveal = dt === 0 && !this.running ? 1 : Math.min(1, b.reveal + dt / 0.75);
      const r = b.reveal;

      // position: base → orbit → bob → explode
      const p = b.basePos.clone();
      if (o.animation === 'orbit' && o.kind !== 'line' && o.kind !== 'tube' && o.kind !== 'arrow') {
        const c = new THREE.Vector3(...o.center);
        p.sub(c).applyAxisAngle(AXIS[o.axis], t * o.speed * 0.9).add(c);
      }
      if (o.animation === 'bob') p.addScaledVector(AXIS[o.axis], Math.sin(t * o.speed * 2.4 + b.phase) * 0.18);
      const isPath = o.kind === 'line' || o.kind === 'tube' || o.kind === 'arrow';
      const offset = b.centroid.clone().sub(this.center).multiplyScalar(this.explodeShown * 0.9);
      if (o.animation === 'orbit') offset.copy(b.basePos.clone().sub(this.center).multiplyScalar(this.explodeShown * 0.9));
      if (isPath) b.holder.position.copy(offset); else b.holder.position.copy(p.add(offset));

      // spin / pulse
      if (o.animation === 'spin') b.spin.rotation[o.axis] = t * o.speed * 1.1;
      const pulse = o.animation === 'pulse' ? 1 + Math.sin(t * o.speed * 4 + b.phase) * 0.07 : 1;
      if (isPath && b.pathGeo) {
        for (const g of b.pathGeo) { const n = g.index ? g.index.count : 0; g.setDrawRange(0, r >= 1 ? Infinity : Math.floor((n * easeInOut(r)) / 6) * 6); }
        b.spin.children.forEach((c) => { if (c.name === 'head') c.visible = r >= 0.98; });
      } else {
        b.rot.scale.setScalar(Math.max(0.001, (r >= 1 ? 1 : easeOutBack(r)) * pulse));
      }

      if (b.beads) {
        const { mesh, u, length } = b.beads;
        const m = new THREE.Matrix4();
        const dv = (dt * o.speed * 1.4) / Math.max(0.5, length);
        for (let i = 0; i < u.length; i++) {
          u[i] = (u[i]! + dv) % 1;
          const pt = b.path!.getPointAt(u[i]!);
          m.makeTranslation(pt.x, pt.y, pt.z);
          mesh.setMatrixAt(i, m);
        }
        mesh.instanceMatrix.needsUpdate = true;
        mesh.visible = r >= 0.98;
      }
      if (b.particles && o.animation === 'jitter' && dt > 0) {
        const { geo, base, vel, spread } = b.particles;
        const arr = geo.attributes.position!.array as Float32Array;
        for (let i = 0; i < arr.length; i += 3) {
          for (let k = 0; k < 3; k++) {
            vel[i + k] = vel[i + k]! * 0.96 + (Math.random() - 0.5) * 0.25 * o.speed;
            arr[i + k] = arr[i + k]! + vel[i + k]! * dt;
          }
          const ex = arr[i]! / spread.x, ey = arr[i + 1]! / spread.y, ez = arr[i + 2]! / spread.z;
          if (ex * ex + ey * ey + ez * ez > 1) { arr[i] = base[i]!; arr[i + 1] = base[i + 1]!; arr[i + 2] = base[i + 2]!; }
        }
        geo.attributes.position!.needsUpdate = true;
      }
      if (b.label) b.label.element.style.opacity = r > 0.6 ? '' : '0';
    }

    this.stars.rotation.y += dt * 0.004;
    if (this.fly) {
      this.fly.t += dt / this.fly.dur;
      const k = easeInOut(Math.min(1, this.fly.t));
      this.camera.position.lerpVectors(this.fly.fromPos, this.fly.toPos, k);
      this.controls.target.lerpVectors(this.fly.fromTgt, this.fly.toTgt, k);
      if (this.fly.t >= 1) this.fly = null;
    }
    this.controls.update(dt || undefined);
    if (this.composer) this.composer.render(dt); else this.renderer.render(this.scene, this.camera);
    if (!this.opts.hero) {
      this.labelRenderer.render(this.scene, this.camera);
      if (this.labelsOn && (this.frameNo++ % 8 === 0 || dt === 0)) this.declutter();
    }
  }

  /** Hide labels that overlap a more important one (highlighted parts first, then scene order). */
  private declutter() {
    const items = this.built.filter((b) => b.label && b.holder.visible && b.label.element.style.display !== 'none');
    const pri = (b: Built) => (this.highlight && b.o.part && this.highlight.has(b.o.part) ? 0 : 1);
    items.sort((a, b) => pri(a) - pri(b));
    // UI overlays (toolbar, step bar) count as occupied so labels never hide under them
    const placed: DOMRect[] = [...this.host.parentElement?.querySelectorAll('[data-occlude]') ?? []].map((e) => e.getBoundingClientRect());
    for (const b of items) {
      const el = b.label!.element;
      const r = el.getBoundingClientRect();
      const hit = placed.some((p) => r.left < p.right - 2 && r.right > p.left + 2 && r.top < p.bottom - 2 && r.bottom > p.top + 2);
      el.classList.toggle('clash', hit);
      if (!hit) placed.push(r);
    }
  }
}

let _dot: THREE.Texture | null = null;
function dotTexture() {
  if (_dot) return _dot;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,0.6)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  _dot = new THREE.CanvasTexture(c); _dot.colorSpace = THREE.SRGBColorSpace;
  return _dot;
}
let _glow: THREE.Texture | null = null;
function glowTexture() {
  if (_glow) return _glow;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(79,227,240,0.28)'); grd.addColorStop(0.5, 'rgba(120,80,255,0.10)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  _glow = new THREE.CanvasTexture(c); _glow.colorSpace = THREE.SRGBColorSpace;
  return _glow;
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}
