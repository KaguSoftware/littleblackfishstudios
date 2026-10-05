import { CONFIG } from './config';
import { wrap, type Slot } from './layout';
import { viewBasis } from './navigator';

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const D2R = Math.PI / 180;

export const GLOBE = {
  fov: 38, // degrees, vertical, at rest
  restPitch: 0.3, // radians: you look down on it a little
  maxPitch: 0.95,
  fill: 0.6, // the globe's diameter, as a fraction of the stage height…
  fillWide: 0.92, // …and of its width, whichever is smaller
  spin: 0.14, // rad/s, when nobody is touching it
  inertia: 2.6,

  // The dive: you fly at the screen facing you, through it, and into the sphere.
  diveSeconds: 1.9,
  diveFov: 84, // the view opens up as you rush in
  diveDist: 10.4, // just outside the screens (they sit at CONFIG.tileRadius)
  lower: 0.035, // the resting globe sits this fraction of the stage height below the middle (the headline is above it)
  fadeFrom: 0.8, // fraction of the dive at which it starts to go black
};

/**
 * The globe on the home page, seen from outside: a plain class like the inside `Navigator`. It
 * owns where the camera is (an orbit around the sphere's centre), drag with inertia, the slow
 * spin, and the dive. The React layer feeds it pointer events and reads the numbers each frame.
 *
 * `yaw` / `pitch` are the same angles as the inside view: they name the point of the sphere that is
 * facing you, so a screen's `lon` / `lat` can be used as they are.
 */
export class GlobeNav {
  reducedMotion: boolean;
  yaw = 0.7;
  pitch = GLOBE.restPitch;
  /** Distance of the camera from the centre of the sphere, and its vertical field of view. */
  dist = 40;
  fov = GLOBE.fov;
  /** 0..1: how black the page has gone. Only moves during the dive. */
  fade = 0;
  /** 0..1 through the dive (0 when not diving). */
  progress = 0;
  /** The screen being dived into (index), or -1. */
  target = -1;
  onDone: (() => void) | null = null;

  dragging = false;
  interacted = false;
  private vYaw = 0;
  private vPitch = 0;
  private last: { x: number; y: number; t: number } | null = null;
  private lastMove = 0;
  /** Radians per pixel at the middle of the globe, as of the last frame. */
  private rpp = 0.004;
  private dive: { t0: number; yaw: number; pitch: number; dist: number; fov: number; done: boolean } | null = null;

  constructor(reducedMotion = false) {
    this.reducedMotion = reducedMotion;
  }

  get diving() {
    return this.dive !== null;
  }

  /** Where the camera sits for the globe to fill its share of a stage of this size. */
  restDist(w: number, h: number) {
    const R = CONFIG.tileRadius;
    const px = Math.min(GLOBE.fill * h, GLOBE.fillWide * w); // diameter on screen
    const tanA = (px * Math.tan((GLOBE.fov * D2R) / 2)) / h; // tan of the globe's angular radius
    return R / Math.sin(Math.atan(tanA));
  }

  // ── pointer ─────────────────────────────────────────────────
  dragStart(x: number, y: number, t: number) {
    if (this.dive) return;
    this.dragging = true;
    this.vYaw = 0;
    this.vPitch = 0;
    this.last = { x, y, t };
    this.lastMove = t;
    this.interacted = true;
  }

  dragMove(x: number, y: number, t: number, spinOnly = false) {
    if (!this.dragging || !this.last) return;
    const dx = x - this.last.x;
    const dy = spinOnly ? 0 : y - this.last.y;
    const dtS = Math.max((t - this.last.t) / 1000, 1 / 240);
    this.last = { x, y, t };
    this.lastMove = t;
    // "grab the globe": the surface under the pointer follows it
    const dYaw = dx * this.rpp;
    const dPitch = dy * this.rpp;
    this.yaw += dYaw;
    this.pitch = clamp(this.pitch + dPitch, -GLOBE.maxPitch, GLOBE.maxPitch);
    this.vYaw += (dYaw / dtS - this.vYaw) * 0.5;
    this.vPitch += (dPitch / dtS - this.vPitch) * 0.5;
  }

  dragEnd(t: number) {
    this.dragging = false;
    if (t - this.lastMove > 90) {
      this.vYaw = 0;
      this.vPitch = 0;
    }
    this.vYaw = clamp(this.vYaw, -7, 7);
    this.vPitch = clamp(this.vPitch, -4, 4);
  }

  /** The screen nearest the middle of the view. */
  facing(slots: Slot[]) {
    const f = viewBasis(this.yaw, this.pitch).f;
    let best = 0;
    let bd = -2;
    for (let i = 0; i < slots.length; i++) {
      const c = slots[i].center;
      const d = f[0] * c[0] + f[1] * c[1] + f[2] * c[2];
      if (d > bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }

  /** Turn to the screen in front and fly through it. */
  enter(slots: Slot[]) {
    if (this.dive || slots.length === 0) return;
    const i = this.facing(slots);
    this.target = i;
    this.dragging = false;
    this.vYaw = 0;
    this.vPitch = 0;
    this.dive = { t0: performance.now(), yaw: this.yaw, pitch: this.pitch, dist: this.dist, fov: this.fov, done: false };
  }

  /** Back to the resting globe (the page was left and came back). */
  reset() {
    this.dive = null;
    this.target = -1;
    this.fade = 0;
    this.progress = 0;
    this.fov = GLOBE.fov;
  }

  // ── per-frame ───────────────────────────────────────────────
  update(dt: number, w: number, h: number, slots: Slot[]) {
    const rest = this.restDist(w, h);
    const d = this.dive;

    if (!d) {
      this.dist = rest;
      this.fov = GLOBE.fov;
      if (!this.dragging) {
        this.yaw += this.vYaw * dt;
        this.pitch = clamp(this.pitch + this.vPitch * dt, -GLOBE.maxPitch, GLOBE.maxPitch);
        const k = Math.exp(-GLOBE.inertia * dt);
        this.vYaw *= k;
        this.vPitch *= k;
        // settle back to the resting tilt, and carry on turning
        this.pitch += (GLOBE.restPitch - this.pitch) * (1 - Math.exp(-1.6 * dt));
        if (!this.reducedMotion) this.yaw += GLOBE.spin * dt;
      }
    } else {
      // by the clock, not by frames: a slow machine gets a choppier dive, not a longer one
      const p = clamp((performance.now() - d.t0) / 1000 / GLOBE.diveSeconds, 0, 1);
      this.progress = p;
      // turn to square up on the screen being dived into
      const s = slots[this.target];
      if (s) {
        const to = { lon: s.lon, lat: s.lat };
        const k = 1 - Math.exp(-6 * dt);
        this.yaw += wrap(to.lon - this.yaw) * k;
        this.pitch += (to.lat - this.pitch) * k;
      }
      // slow to start, then a rush: the distance covered grows faster and faster
      const e = Math.pow(p, 2.5);
      this.dist = d.dist + (GLOBE.diveDist - d.dist) * e;
      this.fov = d.fov + (GLOBE.diveFov - d.fov) * Math.pow(p, 4);
      this.fade = smooth(GLOBE.fadeFrom, 0.985, p);
      if (p >= 1 && !d.done) {
        d.done = true;
        this.onDone?.();
      }
    }

    // pixels → radians at the middle of the globe, for the next drag
    const R = CONFIG.tileRadius;
    this.rpp = (Math.tan((this.fov * D2R) / 2) * (this.dist - R)) / ((h / 2) * R);
  }
}
