'use client';

import { useEffect, useMemo, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, type RootState } from '@react-three/fiber';
import { CONFIG } from './config';
import type { Slot, Vec3 } from './layout';
import type { Navigator } from './navigator';
import { nearestFirst, sharedMediaPool, type MediaPool } from './media';
import type { Atlas } from './labelAtlas';
import { makeTile, type Tile } from './tile';
import { SHELL_VERT, SHELL_FRAG, STAR_VERT, STAR_FRAG } from './shaders';

const D2R = Math.PI / 180;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const damp = (cur: number, target: number, k: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-k * dt));
const dot = (a: ArrayLike<number>, b: ArrayLike<number>) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]];

/**
 * Where a screen's own "up" edge points on the display, as an angle: 0 = straight up, ±90° = sideways
 * (positive leans right), ±180° = upside down. It is the on-screen direction of the screen's up axis
 * at its centre.
 */
function screenAngle(center: Vec3, up: Vec3, B: { f: Vec3; r: Vec3; u: Vec3 }) {
  const z = dot(center, B.f);
  if (z < 0.05) return 0;
  const cx = dot(center, B.r);
  const cy = dot(center, B.u);
  const dx = dot(up, B.r) / z - (cx * dot(up, B.f)) / (z * z);
  const dy = dot(up, B.u) / z - (cy * dot(up, B.f)) / (z * z);
  return Math.atan2(dx, dy);
}

// Alignment: the sphere turns freely, so a screen can come round to lean over or hang upside down.
// Each screen turns in its own plane to cancel that. A small lean is left alone (it is the sphere's
// own curve, and what the front view looks like), anything more is unwound smoothly, and an upside
// down screen ends up the right way up. No screen ever leans more than about 28°, and because the
// unwinding follows the camera smoothly, a screen never whips round.
const LEAN = 40 * D2R; // see keptLean: with this, nothing leans more than about 28°

/** How much lean a screen leaning `angle` (on the display) is left with. Small leans pass through. */
function keptLean(angle: number) {
  return LEAN * Math.tanh(angle / LEAN) * ((1 + Math.cos(angle)) / 2);
}

/**
 * How far to turn a screen in its own plane so that, on the display, it leans by `keptLean` instead
 * of its own lean. Off the middle of the view perspective changes angles, so a turn of x in the
 * screen's plane is not a turn of x on the display: this solves for the exact turn.
 */
function alignTurn(center: Vec3, right: Vec3, up: Vec3, B: { f: Vec3; r: Vec3; u: Vec3 }) {
  const z = dot(center, B.f);
  if (z < 0.05) return 0;
  const cx = dot(center, B.r);
  const cy = dot(center, B.u);
  // where a small step along the screen's up / right axes goes on the display
  const ax = dot(up, B.r) / z - (cx * dot(up, B.f)) / (z * z);
  const ay = dot(up, B.u) / z - (cy * dot(up, B.f)) / (z * z);
  const bx = dot(right, B.r) / z - (cx * dot(right, B.f)) / (z * z);
  const by = dot(right, B.u) / z - (cy * dot(right, B.f)) / (z * z);
  const want = keptLean(Math.atan2(ax, ay));
  const tx = Math.sin(want);
  const ty = Math.cos(want);
  // turned by φ, the up axis shows as cos φ·a − sin φ·b; make that point along (tx, ty)
  let phi = Math.atan2(ax * ty - ay * tx, bx * ty - by * tx);
  const dx = Math.cos(phi) * ax - Math.sin(phi) * bx;
  const dy = Math.cos(phi) * ay - Math.sin(phi) * by;
  if (dx * tx + dy * ty < 0) phi += Math.PI;
  return phi;
}

/** Mutable state the render loop reads every frame (no React re-render per frame). */
export interface SphereState {
  hover: number;
  focus: number;
  dragging: boolean;
  filter: string;
  reducedMotion: boolean;
  /** Returning to the page: skip the screens' fly-in. */
  skipIntro: boolean;
  /** Last mouse position in NDC. The loop re-picks from it every frame, so hover never goes stale while things move. */
  pointer: { active: boolean; x: number; y: number };
}

export interface SphereApi {
  stats: { visible: number; partial: number };
  /** Index of the screen under this NDC point, or -1. Uses the pose and sizes of the frame on screen. */
  pick(ndcX: number, ndcY: number): number;
  /** Where a screen's centre is on the stage, in NDC (for debugging and tests). */
  screenOf(i: number): { x: number; y: number; visible: boolean };
}

interface FrameContext {
  nav: Navigator;
  stateRef: MutableRefObject<SphereState>;
  apiRef: MutableRefObject<SphereApi | null>;
  onReady?: () => void;
}

/** Everything the loop owns, created once per layout and thrown away with it. */
class Assets {
  geo: THREE.PlaneGeometry;
  dummy: THREE.DataTexture;
  media: MediaPool;
  tiles: Tile[];
  shell: THREE.Mesh;
  stars: THREE.Points;
  aspect = 16 / 9;
  /** Poster size asked for: the full one. (The globe on the home page only asks for a small one.) */
  private posterWidth = window.matchMedia('(max-width: 760px)').matches ? 828 : 1080;
  // scratch for turning the camera
  private axes = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private turn = new THREE.Matrix4();
  // frame bookkeeping
  private acc = 0;
  private frames = 0;
  private cool = 0;
  private fast = 0;
  private stat = 0;
  private n = 0;
  private t0: number | null = null;
  private want = new Set<unknown>();
  private facing: Float32Array;
  private order: number[] = [];

  constructor(slots: Slot[], atlas: Atlas, rtl: boolean, introFrom?: Vec3) {
    this.geo = new THREE.PlaneGeometry(1, 1, 28, 16);
    this.dummy = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    this.dummy.needsUpdate = true;
    // One pool for the whole session: the home page's globe already loaded these posters.
    this.media = sharedMediaPool();
    this.tiles = slots.map((s) => makeTile(s, atlas, this.dummy, this.geo, rtl, introFrom));
    this.facing = new Float32Array(slots.length);
    // Arriving through the globe, the sphere is already round you: the screens fly in faster.
    if (introFrom) this.tiles.forEach((t) => (t.introDelay *= 0.45));

    this.shell = new THREE.Mesh(
      new THREE.SphereGeometry(CONFIG.shellRadius, 64, 48),
      new THREE.ShaderMaterial({
        vertexShader: SHELL_VERT,
        fragmentShader: SHELL_FRAG,
        uniforms: { uTime: { value: 0 } },
        side: THREE.BackSide,
        depthWrite: false,
      }),
    );
    this.shell.frustumCulled = false;
    this.shell.renderOrder = -10;

    const N = 900;
    const pos = new Float32Array(N * 3);
    const sizes = new Float32Array(N);
    const phase = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const z = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - z * z);
      pos[i * 3] = Math.cos(a) * r * CONFIG.starRadius;
      pos[i * 3 + 1] = z * CONFIG.starRadius;
      pos[i * 3 + 2] = Math.sin(a) * r * CONFIG.starRadius;
      sizes[i] = 1.4 + Math.pow(Math.random(), 5) * 4.5;
      phase[i] = Math.random();
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    sg.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    this.stars = new THREE.Points(
      sg,
      new THREE.ShaderMaterial({
        vertexShader: STAR_VERT,
        fragmentShader: STAR_FRAG,
        uniforms: { uTime: { value: 0 }, uPx: { value: 1 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -5;
  }

  /** The screen under a point on the stage: same pose, same sizes as the frame being shown. */
  pick(nav: Navigator, filter: string, ndcX: number, ndcY: number) {
    const tanV = Math.tan((nav.fov * D2R) / 2);
    const tanH = tanV * this.aspect;
    const B = nav.basis();
    let d: [number, number, number] = [
      B.f[0] + B.r[0] * ndcX * tanH + B.u[0] * ndcY * tanV,
      B.f[1] + B.r[1] * ndcX * tanH + B.u[1] * ndcY * tanV,
      B.f[2] + B.r[2] * ndcX * tanH + B.u[2] * ndcY * tanV,
    ];
    const l = Math.hypot(d[0], d[1], d[2]);
    d = [d[0] / l, d[1] / l, d[2] / l];
    for (const t of this.tiles) {
      if (t.drawn <= 0.02) continue;
      const s = t.slot;
      if (filter !== 'all' && s.project.categoryId !== filter) continue;
      const c = dot(d, s.center);
      if (c < 0.6) continue;
      const k = 1 / c;
      const x = dot(d, t.right) * k;
      const y = dot(d, t.up) * k;
      if (Math.abs(x) <= s.half[0] * t.drawn && Math.abs(y) <= s.half[1] * t.drawn) return s.index;
    }
    return -1;
  }

  /** One frame: move the camera, pose and size every screen, refresh hover, feed the media pool. */
  frame(state: RootState, delta: number, ctx: FrameContext) {
    const { nav, stateRef, apiRef, onReady } = ctx;
    // hold the intro until the first frames (shader compile) are behind us
    this.n++;
    if (this.n === 3) {
      this.t0 = state.clock.elapsedTime;
      onReady?.();
    }
    const dt = this.n < 3 ? 0 : Math.min(delta, 0.05);
    const time = this.t0 == null ? 0 : state.clock.elapsedTime - this.t0;
    const st = stateRef.current;
    const aspect = state.size.width / state.size.height;
    this.aspect = aspect;

    nav.update(dt, aspect);
    const cam = state.camera as THREE.PerspectiveCamera;
    cam.fov = nav.fov;
    cam.aspect = aspect;
    cam.updateProjectionMatrix();

    // The screens are fixed to the sphere; the camera turns inside it, over the poles and on.
    const B = nav.basis();
    this.axes[0].set(B.r[0], B.r[1], B.r[2]);
    this.axes[1].set(B.u[0], B.u[1], B.u[2]);
    this.axes[2].set(-B.f[0], -B.f[1], -B.f[2]);
    cam.quaternion.setFromRotationMatrix(this.turn.makeBasis(this.axes[0], this.axes[1], this.axes[2]));
    const tanV = Math.tan((nav.fov * D2R) / 2);
    const tanH = tanV * aspect;
    const viewRadius = Math.min(Math.atan(Math.hypot(tanV, tanH)) + 0.32, 2.7);
    const cosView = Math.cos(viewRadius);
    const filter = st.filter;
    const instant = st.reducedMotion || st.skipIntro;
    const doStats = (this.stat = (this.stat + 1) % 6) === 0;
    this.want.clear();
    let full = 0;
    let partial = 0;

    const shellU = (this.shell.material as THREE.ShaderMaterial).uniforms;
    shellU.uTime.value = time;
    const starU = (this.stars.material as THREE.ShaderMaterial).uniforms;
    starU.uTime.value = time;
    starU.uPx.value = state.gl.getPixelRatio();

    // Posters: the screens nearest the middle of the view get theirs first (a few fetches run at once).
    for (let i = 0; i < this.tiles.length; i++) this.facing[i] = dot(B.f, this.tiles[i].slot.center);
    nearestFirst(this.facing, cosView, this.order);
    for (const i of this.order) this.media.get(this.tiles[i].slot.project, this.posterWidth);

    // Hover is re-picked here, every frame, from the last mouse position: however the view moves
    // (drift, inertia, zoom, flying to a screen) the highlighted screen is always the one under the cursor,
    // and it is exactly the one a click will open.
    const pt = st.pointer;
    if (pt.active && !st.dragging) st.hover = this.pick(nav, filter, pt.x, pt.y);

    for (let i = 0; i < this.tiles.length; i++) {
      const t = this.tiles[i];
      const { slot, u } = t;
      const hoverT = st.hover === i && !st.dragging ? 1 : 0;
      const focusT = st.focus === i ? 1 : 0;
      let dimT = st.focus >= 0 && st.focus !== i ? 0.78 : 0;
      if (filter !== 'all' && slot.project.categoryId !== filter) dimT = Math.max(dimT, 1);
      t.hover = damp(t.hover, hoverT, 12, dt);
      t.focus = damp(t.focus, focusT, 6, dt);
      t.dim = damp(t.dim, dimT, 6, dt);

      const vis = dot(B.f, slot.center) > cosView;
      t.mesh.visible = vis;
      if (!vis) {
        t.drawn = 0;
        continue;
      }

      let e = instant ? 1 : clamp((time - t.introDelay) / 1.0, 0, 1);
      e = 1 - Math.pow(1 - e, 3);

      // Align. Whichever way the view is turned, a screen turns in its own plane so it reads (nearly)
      // level. It is a plain function of how the screen sits on the display right now, so it never
      // lags behind the camera, even mid-flight. Turned part way, a screen shrinks a little so it
      // stays clear of its neighbours.
      t.turn = alignTurn(slot.center, slot.right, slot.up, B);
      const ct = Math.cos(t.turn);
      const st2 = Math.sin(t.turn);
      for (let k = 0; k < 3; k++) {
        t.right[k] = slot.right[k] * ct + slot.up[k] * st2;
        t.up[k] = slot.up[k] * ct - slot.right[k] * st2;
      }
      const ws = CONFIG.tileWidthDeg * slot.scale;
      const hs = ws / CONFIG.aspect;
      const sa = Math.abs(st2);
      const ca = Math.abs(ct);
      const room = Math.min(1, (CONFIG.rowStepDeg - 0.5) / (sa * ws + ca * hs), (ws + CONFIG.gapDeg * 0.8) / (ca * ws + sa * hs));

      u.uCenter.value.set(slot.center[0], slot.center[1], slot.center[2]);
      u.uRight.value.set(t.right[0], t.right[1], t.right[2]);
      u.uUp.value.set(t.up[0], t.up[1], t.up[2]);
      u.uPhase.value = ((time + slot.seed * t.loop) % t.loop) / t.loop;
      u.uTime.value = time;
      u.uHover.value = t.hover;
      u.uFocus.value = t.focus;
      u.uDim.value = t.dim;
      u.uIntro.value = e;
      u.uColor.value = CONFIG.posterColor === 'always' ? 1 : CONFIG.posterColor === 'focus' ? t.focus : 0;
      t.drawn = slot.scale * (1 + 0.055 * t.hover + 0.02 * t.focus) * (0.88 + 0.12 * e) * room;
      u.uScale.value = t.drawn;
      u.uRadius.value = CONFIG.tileRadius * (1 - 0.02 * t.hover - 0.012 * t.focus) * (1 + (1 - e) * 0.05);

      // poster or clip, if this project has one
      const item = this.media.get(slot.project, this.posterWidth);
      if (item) {
        this.want.add(item);
        const ready = this.media.isReady(item);
        if (ready && item.texture) {
          u.uMap.value = item.texture;
          u.uVideoAspect.value = item.aspect;
        }
        u.uVideo.value = damp(u.uVideo.value, ready ? 1 : 0, 6, dt);
      }

      if (doStats) {
        let inside = 0;
        const hx = slot.half[0] * slot.scale;
        const hy = slot.half[1] * slot.scale;
        for (const [sx, sy] of CORNERS) {
          const q = [
            slot.center[0] + slot.right[0] * sx * hx + slot.up[0] * sy * hy,
            slot.center[1] + slot.right[1] * sx * hx + slot.up[1] * sy * hy,
            slot.center[2] + slot.right[2] * sx * hx + slot.up[2] * sy * hy,
          ];
          const z = dot(q, B.f);
          if (z <= 0) continue;
          const x = dot(q, B.r) / z / tanH;
          const y = dot(q, B.u) / z / tanV;
          if (Math.abs(x) <= 1 && Math.abs(y) <= 1) inside++;
        }
        if (inside >= 4) full++;
        if (inside > 0) partial++;
      }
    }

    this.media.items.forEach((it) => this.media.setVisible(it, this.want.has(it)));

    const api = apiRef.current;
    if (doStats && api) {
      api.stats.visible = full;
      api.stats.partial = partial;
    }

    // adaptive resolution: trade pixels for frame rate on weak GPUs
    this.acc += delta;
    this.frames++;
    if (this.cool > 0) this.cool--;
    if (this.frames >= 40) {
      const avg = this.acc / this.frames;
      const dpr = state.viewport.dpr;
      if (avg > 1 / 38 && dpr > 1 && this.cool === 0) {
        state.setDpr(Math.max(1, dpr - 0.25));
        this.cool = 80;
      } else if (avg < 1 / 56 && dpr < Math.min(window.devicePixelRatio || 1, 1.75) && this.cool === 0) {
        if (++this.fast > 3) {
          state.setDpr(Math.min(1.75, dpr + 0.25));
          this.cool = 120;
          this.fast = 0;
        }
      } else this.fast = 0;
      this.acc = 0;
      this.frames = 0;
    }
  }

  /** For tests and debugging: of the screens on the display, how far the most tilted one leans from upright. */
  alignStats(nav: Navigator) {
    const B = nav.basis();
    const tanV = Math.tan((nav.fov * D2R) / 2);
    const tanH = tanV * this.aspect;
    let shown = 0;
    let turned = 0;
    let worst = 0;
    for (const t of this.tiles) {
      if (t.drawn <= 0.02) continue;
      const z = dot(t.slot.center, B.f);
      if (z <= 0.05) continue;
      if (Math.abs(dot(t.slot.center, B.r) / z / tanH) > 1 || Math.abs(dot(t.slot.center, B.u) / z / tanV) > 1) continue;
      shown++;
      if (Math.abs(t.turn) > Math.PI / 2) turned++;
      worst = Math.max(worst, Math.abs(screenAngle(t.slot.center, t.up, B)));
    }
    return { shown, turned, worstDeg: Math.round(worst / D2R) };
  }

  dispose() {
    this.geo.dispose();
    this.dummy.dispose();
    // The pool outlives this canvas (the posters stay decoded for the next one); just stop the clips.
    this.media.pauseAll();
    this.tiles.forEach((t) => t.material.dispose());
    this.shell.geometry.dispose();
    (this.shell.material as THREE.Material).dispose();
    this.stars.geometry.dispose();
    (this.stars.material as THREE.Material).dispose();
  }
}

interface WorldProps {
  nav: Navigator;
  slots: Slot[];
  atlas: Atlas;
  rtl: boolean;
  /** Direction the screens fly in from. Default: the opening view. */
  introFrom?: Vec3;
  stateRef: MutableRefObject<SphereState>;
  apiRef: MutableRefObject<SphereApi | null>;
  onReady?: () => void;
}

function World({ nav, slots, atlas, rtl, introFrom, stateRef, apiRef, onReady }: WorldProps) {
  const assets = useMemo(() => new Assets(slots, atlas, rtl, introFrom), [slots, atlas, rtl, introFrom]);
  useEffect(() => () => assets.dispose(), [assets]);

  // imperative API for the DOM layer (hit-testing, stats)
  useEffect(() => {
    const api: SphereApi = {
      stats: { visible: 0, partial: 0 },
      pick: (x, y) => assets.pick(nav, stateRef.current.filter, x, y),
      screenOf(i) {
        const s = slots[i];
        const B = nav.basis();
        const z = dot(s.center, B.f);
        const tanV = Math.tan((nav.fov * D2R) / 2);
        const tanH = tanV * assets.aspect;
        return { x: dot(s.center, B.r) / z / tanH, y: dot(s.center, B.u) / z / tanV, visible: z > 0 };
      },
    };
    apiRef.current = api;
    return () => {
      if (apiRef.current === api) apiRef.current = null;
    };
  }, [assets, nav, slots, stateRef, apiRef]);

  // with ?debug in the URL: how far the most tilted screen on the display leans from upright
  useEffect(() => {
    if (!/[?&]debug\b/.test(window.location.search)) return undefined;
    const w = window as unknown as { __SPHERE_ALIGN__?: () => unknown };
    const fn = () => assets.alignStats(nav);
    w.__SPHERE_ALIGN__ = fn;
    return () => {
      if (w.__SPHERE_ALIGN__ === fn) delete w.__SPHERE_ALIGN__;
    };
  }, [assets, nav]);

  useFrame((state, delta) => assets.frame(state, delta, { nav, stateRef, apiRef, onReady }));

  return (
    <>
      <primitive object={assets.shell} />
      <primitive object={assets.stars} />
      {assets.tiles.map((t) => (
        <primitive key={t.slot.index} object={t.mesh} />
      ))}
    </>
  );
}

export default function SphereCanvas(props: WorldProps) {
  return (
    <Canvas
      flat
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      // R3F parks its default camera at z = 5. It must sit at the exact centre: the screens are a gnomonic
      // patch seen from there, and hit-testing assumes it. Off-centre, hover and click land on other screens.
      camera={{ fov: 70, near: 0.05, far: 40, position: [0, 0, 0] }}
      onCreated={({ gl }) => {
        gl.setClearColor('#000000');
      }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <World {...props} />
    </Canvas>
  );
}
