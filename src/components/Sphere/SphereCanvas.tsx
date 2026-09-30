'use client';

import { useEffect, useMemo, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, type RootState } from '@react-three/fiber';
import { CONFIG } from './config';
import type { Slot } from './layout';
import type { Navigator } from './navigator';
import { MediaPool } from './media';
import type { Atlas } from './labelAtlas';
import { SCREEN_VERT, SCREEN_FRAG, SHELL_VERT, SHELL_FRAG, STAR_VERT, STAR_FRAG } from './shaders';

const D2R = Math.PI / 180;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const damp = (cur: number, target: number, k: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-k * dt));
const dot = (a: ArrayLike<number>, b: ArrayLike<number>) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]];

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
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

interface Tile {
  slot: Slot;
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  u: Record<string, THREE.IUniform>;
  loop: number;
  hover: number;
  focus: number;
  dim: number;
  introDelay: number;
  /** Scale the screen is drawn at this frame (1 = its full size). Hit-testing uses the same number. */
  drawn: number;
}

function makeTile(slot: Slot, atlas: Atlas, dummy: THREE.Texture, geo: THREE.BufferGeometry, rtl: boolean): Tile {
  const p = slot.project;
  const [c0, c1, c2] = p.palette.map(hexToRgb);
  const loops = CONFIG.loopSeconds;
  const loop = loops[slot.projectIndex % loops.length];
  const cell = atlas.cell(slot.projectIndex);
  const u: Record<string, THREE.IUniform> = {
    uCenter: { value: new THREE.Vector3(...slot.center) },
    uRight: { value: new THREE.Vector3(...slot.right) },
    uUp: { value: new THREE.Vector3(...slot.up) },
    uHalf: { value: new THREE.Vector2(...slot.half) },
    uRadius: { value: CONFIG.tileRadius },
    uScale: { value: 1 },
    uPhase: { value: 0 },
    uScene: { value: p.scene },
    uC0: { value: new THREE.Vector3(...c0) },
    uC1: { value: new THREE.Vector3(...c1) },
    uC2: { value: new THREE.Vector3(...c2) },
    uAspect: { value: CONFIG.aspect },
    uHover: { value: 0 },
    uFocus: { value: 0 },
    uDim: { value: 0 },
    uIntro: { value: 0 },
    uEdge: { value: 1 },
    uColor: { value: 0 },
    uRtl: { value: rtl ? 1 : 0 },
    uTime: { value: 0 },
    uAtlas: { value: atlas.texture },
    uLabel: { value: new THREE.Vector4(cell.col, cell.row, atlas.cols, atlas.rows) },
    uLabelAspect: { value: atlas.aspect },
    uMap: { value: dummy },
    uVideo: { value: 0 },
    uVideoAspect: { value: 16 / 9 },
  };
  const material = new THREE.ShaderMaterial({
    vertexShader: SCREEN_VERT,
    fragmentShader: SCREEN_FRAG,
    uniforms: u,
    transparent: true,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  mesh.visible = false;
  const ang = Math.acos(clamp(-slot.center[2], -1, 1)); // distance from the opening view
  return { slot, mesh, material, u, loop, hover: 0, focus: 0, dim: 0, introDelay: 0.2 + ang * 0.55 + slot.seed * 0.18, drawn: 0 };
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

  constructor(slots: Slot[], atlas: Atlas, rtl: boolean) {
    this.geo = new THREE.PlaneGeometry(1, 1, 28, 16);
    this.dummy = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    this.dummy.needsUpdate = true;
    this.media = new MediaPool(window.matchMedia('(max-width: 760px)').matches ? 828 : 1080);
    this.tiles = slots.map((s) => makeTile(s, atlas, this.dummy, this.geo, rtl));

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
      const x = dot(d, s.right) * k;
      const y = dot(d, s.up) * k;
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

      u.uCenter.value.set(slot.center[0], slot.center[1], slot.center[2]);
      u.uRight.value.set(slot.right[0], slot.right[1], slot.right[2]);
      u.uUp.value.set(slot.up[0], slot.up[1], slot.up[2]);
      u.uPhase.value = ((time + slot.seed * t.loop) % t.loop) / t.loop;
      u.uTime.value = time;
      u.uHover.value = t.hover;
      u.uFocus.value = t.focus;
      u.uDim.value = t.dim;
      u.uIntro.value = e;
      u.uColor.value = CONFIG.posterColor === 'always' ? 1 : CONFIG.posterColor === 'focus' ? t.focus : 0;
      t.drawn = slot.scale * (1 + 0.055 * t.hover + 0.02 * t.focus) * (0.88 + 0.12 * e);
      u.uScale.value = t.drawn;
      u.uRadius.value = CONFIG.tileRadius * (1 - 0.02 * t.hover - 0.012 * t.focus) * (1 + (1 - e) * 0.05);

      // poster or clip, if this project has one
      const item = this.media.get(slot.project);
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

  dispose() {
    this.geo.dispose();
    this.dummy.dispose();
    this.media.dispose();
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
  stateRef: MutableRefObject<SphereState>;
  apiRef: MutableRefObject<SphereApi | null>;
  onReady?: () => void;
}

function World({ nav, slots, atlas, rtl, stateRef, apiRef, onReady }: WorldProps) {
  const assets = useMemo(() => new Assets(slots, atlas, rtl), [slots, atlas, rtl]);
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
