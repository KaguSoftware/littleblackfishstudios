'use client';

import { useEffect, useMemo, type RefObject } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, type RootState } from '@react-three/fiber';
import { CONFIG } from './config';
import type { Slot, Vec3 } from './layout';
import { viewBasis } from './navigator';
import { GLOBE, GlobeNav } from './globeNav';
import { nearestFirst, sharedMediaPool, type MediaPool } from './media';
import type { Atlas } from './labelAtlas';
import { makeTile, type Tile } from './tile';
import { GLOBE_CORE_VERT, GLOBE_CORE_FRAG, GLOBE_HALO_VERT, GLOBE_HALO_FRAG, STAR_VERT, STAR_FRAG } from './shaders';

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const damp = (cur: number, target: number, k: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-k * dt));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
/** The globe asks for small posters: its screens are a couple of hundred pixels wide at most. */
const POSTER_WIDTH = 256;
const POSTER_WIDTH_DESKTOP = 640;

/** The first screens to fly in are the ones facing the opening view. */
const INTRO_FROM: Vec3 = (() => {
  const f = viewBasis(0.7, 0.3).f;
  return [f[0], f[1], f[2]];
})();

interface FrameContext {
  nav: GlobeNav;
  slots: Slot[];
  fadeRef: RefObject<HTMLElement | null>;
  onReady?: () => void;
}

/** Everything the loop owns; created once per layout and thrown away with it. */
class GlobeAssets {
  geo: THREE.PlaneGeometry;
  dummy: THREE.DataTexture;
  media: MediaPool;
  tiles: Tile[];
  core: THREE.Mesh;
  halo: THREE.Mesh;
  stars: THREE.Points;
  private posterWidth: number;
  // scratch for turning the camera
  private axes = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private turn = new THREE.Matrix4();
  private want = new Set<unknown>();
  private facing: Float32Array;
  private order: number[] = [];
  private n = 0;
  private t0: number | null = null;
  private lastFade = -1;
  // adaptive resolution
  private acc = 0;
  private frames = 0;
  private cool = 0;

  constructor(slots: Slot[], atlas: Atlas, rtl: boolean) {
    this.facing = new Float32Array(slots.length);
    // Coarser curve than the inside view: these screens are small.
    this.geo = new THREE.PlaneGeometry(1, 1, 16, 10);
    this.dummy = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    this.dummy.needsUpdate = true;
    this.media = sharedMediaPool();
    this.posterWidth = window.matchMedia('(max-width: 760px)').matches ? POSTER_WIDTH : POSTER_WIDTH_DESKTOP;
    this.tiles = slots.map((s) => {
      const t = makeTile(s, atlas, this.dummy, this.geo, rtl, INTRO_FROM);
      t.u.uFlip.value = 1; // seen from outside, the pictures would be mirrored
      t.u.uColor.value = 1;
      return t;
    });

    // The ball the screens sit on: opaque, so the far side is hidden.
    this.core = new THREE.Mesh(
      new THREE.SphereGeometry(CONFIG.tileRadius * 0.985, 64, 48),
      new THREE.ShaderMaterial({
        vertexShader: GLOBE_CORE_VERT,
        fragmentShader: GLOBE_CORE_FRAG,
        uniforms: { uTime: { value: 0 } },
      }),
    );
    this.core.frustumCulled = false;
    this.core.renderOrder = -10;

    this.halo = new THREE.Mesh(
      new THREE.SphereGeometry(CONFIG.tileRadius * 1.3, 48, 32),
      new THREE.ShaderMaterial({
        vertexShader: GLOBE_HALO_VERT,
        fragmentShader: GLOBE_HALO_FRAG,
        uniforms: { uStrength: { value: 0.36 } },
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.halo.frustumCulled = false;
    this.halo.renderOrder = 0;

    // far-off dust, so the turning has something to turn against
    const N = 420;
    const pos = new Float32Array(N * 3);
    const sizes = new Float32Array(N);
    const phase = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const z = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - z * z);
      const radius = 140;
      pos[i * 3] = Math.cos(a) * r * radius;
      pos[i * 3 + 1] = z * radius;
      pos[i * 3 + 2] = Math.sin(a) * r * radius;
      sizes[i] = 1.2 + Math.pow(Math.random(), 5) * 3.6;
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
    this.stars.renderOrder = -20;
  }

  frame(state: RootState, delta: number, ctx: FrameContext) {
    const { nav, slots, fadeRef, onReady } = ctx;
    // hold the intro until the first frames (shader compile) are behind us
    this.n++;
    if (this.n === 3) {
      this.t0 = state.clock.elapsedTime;
      onReady?.();
    }
    const dt = this.n < 3 ? 0 : Math.min(delta, 0.05);
    const time = this.t0 == null ? 0 : state.clock.elapsedTime - this.t0;
    const { width: W, height: H } = state.size;

    nav.update(dt, W, H, slots);

    // The camera orbits the middle of the sphere, looking at it. Its axes are the inside view's,
    // turned about the up axis: it looks the opposite way (-f), so its right-hand side is -r.
    const cam = state.camera as THREE.PerspectiveCamera;
    const B = viewBasis(nav.yaw, nav.pitch);
    cam.fov = nav.fov;
    cam.aspect = W / H;
    cam.position.set(B.f[0] * nav.dist, B.f[1] * nav.dist, B.f[2] * nav.dist);
    this.axes[0].set(-B.r[0], -B.r[1], -B.r[2]);
    this.axes[1].set(B.u[0], B.u[1], B.u[2]);
    this.axes[2].set(B.f[0], B.f[1], B.f[2]);
    cam.quaternion.setFromRotationMatrix(this.turn.makeBasis(this.axes[0], this.axes[1], this.axes[2]));
    // The globe rests a little below the middle (the headline is above it) and centres as you dive in.
    cam.setViewOffset(W, H, 0, -GLOBE.lower * H * (1 - nav.progress), W, H);
    cam.updateProjectionMatrix();

    (this.core.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
    const starU = (this.stars.material as THREE.ShaderMaterial).uniforms;
    starU.uTime.value = time;
    starU.uPx.value = state.gl.getPixelRatio();
    // the glow thins out as you close in
    (this.halo.material as THREE.ShaderMaterial).uniforms.uStrength.value = 0.36 * (1 - nav.fade);

    // Only screens that can be seen are drawn: those within the horizon as seen from here (plus half
    // a screen), which is about half the sphere at rest and a small patch while diving.
    const R = CONFIG.tileRadius;
    const horizon = Math.acos(clamp(R / nav.dist, 0, 1));
    const cut = Math.cos(Math.min(horizon + 0.3, Math.PI));
    const instant = nav.reducedMotion;
    this.want.clear();

    // Posters: the screens facing you get theirs first (a few fetches run at once).
    for (let i = 0; i < this.tiles.length; i++) {
      const c = this.tiles[i].slot.center;
      this.facing[i] = c[0] * B.f[0] + c[1] * B.f[1] + c[2] * B.f[2];
    }
    nearestFirst(this.facing, cut, this.order);
    for (const i of this.order) this.media.get(this.tiles[i].slot.project, this.posterWidth);

    for (let i = 0; i < this.tiles.length; i++) {
      const t = this.tiles[i];
      const { slot, u } = t;
      const facing = slot.center[0] * B.f[0] + slot.center[1] * B.f[1] + slot.center[2] * B.f[2];
      const vis = facing > cut;
      t.mesh.visible = vis;
      if (!vis) continue;

      let e = instant ? 1 : clamp((time - t.introDelay) / 1.0, 0, 1);
      e = 1 - Math.pow(1 - e, 3);
      t.hover = damp(t.hover, nav.target === i ? 1 : 0, 5, dt);

      u.uPhase.value = ((time + slot.seed * t.loop) % t.loop) / t.loop;
      u.uTime.value = time;
      u.uHover.value = t.hover;
      u.uIntro.value = e;
      // screens turning away from you fade into the ball instead of being squashed against its edge
      u.uEdge.value = smooth(0.1, 0.45, facing);
      u.uScale.value = slot.scale * 0.98 * (0.86 + 0.14 * e) * (1 + 0.06 * t.hover);
      u.uRadius.value = R * (1 + (1 - e) * 0.06);

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
    }
    this.media.items.forEach((it) => this.media.setVisible(it, this.want.has(it)));

    // the page goes black as the dive ends (written straight to the DOM, no React render per frame)
    if (nav.fade !== this.lastFade) {
      this.lastFade = nav.fade;
      const el = fadeRef.current;
      if (el) el.style.opacity = String(nav.fade);
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
      }
      this.acc = 0;
      this.frames = 0;
    }
  }

  dispose() {
    this.geo.dispose();
    this.dummy.dispose();
    // The pool outlives this canvas: the posters stay decoded for the projects page.
    this.media.pauseAll();
    this.tiles.forEach((t) => t.material.dispose());
    this.core.geometry.dispose();
    (this.core.material as THREE.Material).dispose();
    this.halo.geometry.dispose();
    (this.halo.material as THREE.Material).dispose();
    this.stars.geometry.dispose();
    (this.stars.material as THREE.Material).dispose();
  }
}

interface WorldProps {
  nav: GlobeNav;
  slots: Slot[];
  atlas: Atlas;
  rtl: boolean;
  fadeRef: RefObject<HTMLElement | null>;
  onReady?: () => void;
}

function World({ nav, slots, atlas, rtl, fadeRef, onReady }: WorldProps) {
  const assets = useMemo(() => new GlobeAssets(slots, atlas, rtl), [slots, atlas, rtl]);
  useEffect(() => () => assets.dispose(), [assets]);

  useFrame((state, delta) => assets.frame(state, delta, { nav, slots, fadeRef, onReady }));

  return (
    <>
      <primitive object={assets.stars} />
      <primitive object={assets.core} />
      <primitive object={assets.halo} />
      {assets.tiles.map((t) => (
        <primitive key={t.slot.index} object={t.mesh} />
      ))}
    </>
  );
}

interface GlobeCanvasProps extends WorldProps {
  /** false while the globe is scrolled out of view: the render loop stops. */
  active: boolean;
}

export default function GlobeCanvas({ active, ...props }: GlobeCanvasProps) {
  return (
    <Canvas
      flat
      frameloop={active ? 'always' : 'never'}
      dpr={[1, 1.6]}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      camera={{ fov: 38, near: 0.1, far: 400, position: [0, 0, 40] }}
      onCreated={({ gl }) => {
        gl.setClearColor('#000000');
      }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <World {...props} />
    </Canvas>
  );
}
