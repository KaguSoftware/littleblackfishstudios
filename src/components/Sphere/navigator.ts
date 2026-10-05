import { CONFIG } from './config';
import { wrap } from './layout';
import type { Slot, Vec3 } from './layout';
import type { DragDriver } from './types';

const D2R = Math.PI / 180;
const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

type Spring = [number, number];

// Critically-damped spring (implicit, unconditionally stable).
function spring(x: number, v: number, target: number, omega: number, dt: number): Spring {
  const f = 1 + 2 * dt * omega;
  const oo = omega * omega;
  const hoo = dt * oo;
  const hhoo = dt * hoo;
  const det = 1 / (f + hhoo);
  return [(f * x + dt * v + hhoo * target) * det, (v + hoo * (target - x)) * det];
}

/**
 * Orthonormal view frame for a yaw (turn about the poles) / pitch (tilt up or down) pair, and an
 * optional roll about the line of sight (only the focus view uses one). Neither yaw nor pitch is
 * limited: past ±90° of pitch the view has gone over a pole and is upside down, and the frame stays
 * continuous all the way round.
 */
export function viewBasis(yaw: number, pitch: number, roll = 0) {
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const f: Vec3 = [sy * cp, sp, -cy * cp];
  const r0: Vec3 = [cy, 0, sy];
  const u0: Vec3 = [
    r0[1] * f[2] - r0[2] * f[1],
    r0[2] * f[0] - r0[0] * f[2],
    r0[0] * f[1] - r0[1] * f[0],
  ];
  if (!roll) return { f, r: r0, u: u0 };
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  const r: Vec3 = [r0[0] * cr + u0[0] * sr, r0[1] * cr + u0[1] * sr, r0[2] * cr + u0[2] * sr];
  const u: Vec3 = [u0[0] * cr - r0[0] * sr, u0[1] * cr - r0[1] * sr, u0[2] * cr - r0[2] * sr];
  return { f, r, u };
}

export function baseVFov(aspect: number) {
  const h = (aspect < 1 ? CONFIG.portraitHFovDeg : CONFIG.baseHFovDeg) * D2R;
  const v = (2 * Math.atan(Math.tan(h / 2) / aspect)) / D2R;
  return clamp(v, CONFIG.minVFov, CONFIG.maxVFov);
}

/** The resting view's vertical FOV: `viewZoom` on landscape, the tighter `portraitViewZoom` on phones. */
export function viewFov(aspect: number) {
  return baseVFov(aspect) * (aspect < 1 ? CONFIG.portraitViewZoom : CONFIG.viewZoom);
}

const dot3 = (a: ArrayLike<number>, b: ArrayLike<number>) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * The view (yaw, pitch, roll) that shows a screen level, with its middle at (qx, qy) in tangent
 * units. A view that only turns about two axes can't do this near a pole without tilting the screen,
 * which is what the roll is for. With (qx, qy) = (0, 0) the roll comes out as zero.
 */
export function orientTo(slot: Slot, qx: number, qy: number): [number, number, number] {
  // In the camera's own axes (x right, y up, z backward) the screen's middle is at q,
  // its right-hand edge runs level (e), and its up axis follows from the two (n = e × q).
  const len = Math.hypot(qx, qy, 1);
  const q: Vec3 = [qx / len, qy / len, -1 / len];
  const hn = Math.hypot(q[0], q[2]);
  const e: Vec3 = [-q[2] / hn, 0, q[0] / hn];
  const n: Vec3 = [e[1] * q[2] - e[2] * q[1], e[2] * q[0] - e[0] * q[2], e[0] * q[1] - e[1] * q[0]];
  // the same thing in world axes: where the camera's x, y and z axes point
  const axis = (k: 0 | 1 | 2): Vec3 => [
    slot.right[0] * e[k] + slot.up[0] * n[k] + slot.center[0] * q[k],
    slot.right[1] * e[k] + slot.up[1] * n[k] + slot.center[1] * q[k],
    slot.right[2] * e[k] + slot.up[2] * n[k] + slot.center[2] * q[k],
  ];
  const R = axis(0);
  const back = axis(2);
  const pitch = Math.asin(clamp(-back[1], -1, 1));
  const yaw = Math.hypot(back[0], back[2]) < 1e-6 ? 0 : Math.atan2(-back[0], back[2]);
  const level = viewBasis(yaw, pitch);
  return [yaw, pitch, Math.atan2(dot3(R, level.u), dot3(R, level.r))];
}

export interface SavedView {
  yaw: number;
  pitch: number;
}

interface Seek {
  yaw: number;
  pitch: number;
  omega: number;
}

/**
 * All camera behaviour in one plain class: drag with inertia, idle drift, eased "seek"
 * moves and the focus-on-a-screen view. The React layer only feeds it pointer events and reads
 * yaw / pitch / fov.
 *
 * The screens are fixed to the sphere and the camera turns inside it. `yaw` is the turn about the
 * poles and `pitch` the tilt up or down, and NEITHER is limited: drag up past a pole and the view
 * carries on over the top, upside down, and round again, forever.
 */
export class Navigator implements DragDriver {
  reducedMotion: boolean;
  rtl: boolean;
  aspect = 16 / 9;
  yaw: number;
  pitch: number;
  /** Roll about the line of sight. Zero except while a screen is open. */
  roll = 0;
  fov: number;
  vYaw = 0;
  vPitch = 0;
  vFov = 0;
  sYaw = 0;
  sPitch = 0;
  sRoll = 0;
  dragging = false;
  idle = 0;
  focus: Slot | null = null;
  seek: Seek | null;
  interacted = false;
  private _last: { x: number; y: number; t: number } | null = null;
  private _lastMove = 0;

  constructor({
    reducedMotion = false,
    rtl = false,
    restore = null,
    enter = null,
  }: { reducedMotion?: boolean; rtl?: boolean; restore?: SavedView | null; enter?: SavedView | null } = {}) {
    this.reducedMotion = reducedMotion;
    this.rtl = rtl;
    if (enter) {
      // Arriving from the globe on the home page: you are now inside, facing the way you were
      // diving. The view starts wider than the resting one and settles, while the screens fly in.
      this.yaw = enter.yaw;
      this.pitch = enter.pitch;
      this.fov = viewFov(this.aspect) * (reducedMotion ? 1 : 1.35);
      this.seek = null;
    } else if (restore) {
      // Coming back to the page: land exactly where you left, no fly-in.
      this.yaw = restore.yaw;
      this.pitch = restore.pitch;
      this.fov = viewFov(this.aspect);
      this.seek = null;
    } else {
      // Fly in: start turned away and wider than the resting view, then settle on the front.
      this.yaw = reducedMotion ? 0 : -0.95;
      this.pitch = reducedMotion ? 0 : 0.32;
      this.fov = viewFov(this.aspect) * (reducedMotion ? 1 : 1.2);
      this.seek = reducedMotion ? null : { yaw: 0, pitch: 0, omega: 2.3 };
    }
  }

  /** What to remember so the view can be restored later. */
  get view(): SavedView {
    return { yaw: wrap(this.yaw), pitch: wrap(this.pitch) };
  }

  /** The camera's axes right now. */
  basis() {
    return viewBasis(this.yaw, this.pitch, this.roll);
  }

  /** +1 while the view is the right way up, -1 once it has gone over a pole. Sideways turns flip with it. */
  private get side() {
    return Math.cos(this.pitch) < 0 ? -1 : 1;
  }

  poke() {
    this.idle = 0;
  }

  // ── pointer drag ────────────────────────────────────────────
  dragStart(x: number, y: number, t: number) {
    this.dragging = true;
    this.seek = null;
    this.vYaw = 0;
    this.vPitch = 0;
    this._last = { x, y, t };
    this._lastMove = t;
    this.idle = 0;
    this.interacted = true;
  }

  dragMove(x: number, y: number, t: number, viewH: number) {
    if (!this.dragging || !this._last) return;
    const dx = x - this._last.x;
    const dy = y - this._last.y;
    const dtS = Math.max((t - this._last.t) / 1000, 1 / 240);
    this._last = { x, y, t };
    this._lastMove = t;
    // "grab the sphere": the surface under your finger follows it (exact at the middle of the view).
    const rpp = (2 * Math.tan((this.fov * D2R) / 2)) / viewH;
    // Turning about the poles moves the middle of the view by only cos(pitch), so sideways drags
    // speed up toward the poles (capped), and reverse once the view is upside down.
    const gain = this.side * Math.max(Math.abs(Math.cos(this.pitch)), CONFIG.poleGain);
    const dYaw = -(dx * rpp) / gain;
    const dPitch = dy * rpp;
    this.yaw += dYaw;
    this.pitch += dPitch;
    this.vYaw += (dYaw / dtS - this.vYaw) * 0.5;
    this.vPitch += (dPitch / dtS - this.vPitch) * 0.5;
    this.idle = 0;
  }

  dragEnd(t: number) {
    this.dragging = false;
    if (t - this._lastMove > 90) {
      this.vYaw = 0;
      this.vPitch = 0;
    }
    this.vYaw = clamp(this.vYaw, -8, 8);
    this.vPitch = clamp(this.vPitch, -6, 6);
  }

  /** Turn by a step the way it reads on screen (right = look right), whichever way up the view is. */
  nudge(dYaw: number, dPitch: number) {
    if (this.focus) return;
    const base = this.seek || { yaw: this.yaw, pitch: this.pitch };
    const side = Math.cos(base.pitch) < 0 ? -1 : 1;
    this.seek = { yaw: base.yaw + dYaw * side, pitch: base.pitch + dPitch, omega: 7 };
    this.vYaw = 0;
    this.vPitch = 0;
    this.idle = 0;
    this.interacted = true;
  }

  /** Turn to face a longitude / latitude, the right way up, by the shortest way round. */
  lookAt(yaw: number, pitch: number, omega = 6) {
    if (this.focus) this.focus = null;
    this.seek = {
      yaw: this.yaw + wrap(yaw - this.yaw),
      pitch: this.pitch + wrap(pitch - this.pitch),
      omega,
    };
    this.vYaw = 0;
    this.vPitch = 0;
    this.idle = 0;
    this.interacted = true;
  }

  // ── focus view ──────────────────────────────────────────────
  focusOn(slot: Slot) {
    this.focus = slot;
    this.seek = null;
    this.vYaw = 0;
    this.vPitch = 0;
    this.idle = 0;
    this.interacted = true;
  }

  clearFocus() {
    if (!this.focus) return;
    this.focus = null;
    this.idle = 0;
  }

  focusTarget(slot: Slot) {
    const aspect = this.aspect;
    const hx = slot.half[0] * slot.scale;
    const hy = slot.half[1] * slot.scale;
    const wide = aspect > 1.05;
    const tanV = Math.max(hy / CONFIG.focusFill, hx / (aspect * (wide ? 0.5 : 0.86)));
    const fov = clamp((2 * Math.atan(tanV)) / D2R, 10, 95);
    const tanH = tanV * aspect;
    // wide: the screen sits to one side and the detail panel takes the other (mirrored for RTL).
    // tall: the screen sits high and the sheet takes the bottom.
    const [yaw, pitch, roll] = wide
      ? orientTo(slot, (this.rtl ? 1 : -1) * 0.27 * tanH, 0)
      : orientTo(slot, 0, 0.27 * tanV);
    return { yaw, pitch, roll, fov };
  }

  // ── per-frame ───────────────────────────────────────────────
  update(dtRaw: number, aspect: number) {
    const dt = Math.min(dtRaw, 0.05);
    this.aspect = aspect;
    let fovTarget = clamp(viewFov(aspect), 28, 112);
    let omegaFov = 8;

    if (this.focus) {
      const t = this.focusTarget(this.focus);
      fovTarget = t.fov;
      omegaFov = 6;
      [this.yaw, this.sYaw] = spring(this.yaw, this.sYaw, this.yaw + wrap(t.yaw - this.yaw), 6.5, dt);
      [this.pitch, this.sPitch] = spring(
        this.pitch,
        this.sPitch,
        this.pitch + wrap(t.pitch - this.pitch),
        6.5,
        dt,
      );
      [this.roll, this.sRoll] = spring(this.roll, this.sRoll, this.roll + wrap(t.roll - this.roll), 6.5, dt);
    } else if (this.dragging) {
      this.sYaw = 0;
      this.sPitch = 0;
    } else if (this.seek) {
      const s = this.seek;
      [this.yaw, this.sYaw] = spring(this.yaw, this.sYaw, s.yaw, s.omega, dt);
      [this.pitch, this.sPitch] = spring(this.pitch, this.sPitch, s.pitch, s.omega, dt);
      if (
        Math.abs(this.yaw - s.yaw) < 0.002 &&
        Math.abs(this.pitch - s.pitch) < 0.002 &&
        Math.abs(this.sYaw) < 0.01
      ) {
        this.seek = null;
      }
    } else {
      this.sYaw = 0;
      this.sPitch = 0;
      this.yaw += this.vYaw * dt;
      this.pitch += this.vPitch * dt;
      const k = Math.exp(-CONFIG.inertia * dt);
      this.vYaw *= k;
      this.vPitch *= k;
      if (Math.abs(this.vYaw) < 0.0005) this.vYaw = 0;
      if (Math.abs(this.vPitch) < 0.0005) this.vPitch = 0;
      // slow drift when nobody is touching it
      this.idle += dt;
      if (!this.reducedMotion && this.idle > CONFIG.autoRotateAfter) {
        const ramp = clamp((this.idle - CONFIG.autoRotateAfter) / 2.5, 0, 1);
        this.yaw += this.side * CONFIG.autoRotateSpeed * ramp * dt;
      }
    }

    // out of the focus view the horizon goes back to level
    if (!this.focus) {
      [this.roll, this.sRoll] = spring(this.roll, this.sRoll, this.roll - wrap(this.roll), this.dragging ? 14 : 6, dt);
    }

    [this.fov, this.vFov] = spring(this.fov, this.vFov, fovTarget, omegaFov, dt);
    this.recentre();
  }

  /** Keep the numbers small after a lot of spinning. Targets move with them so nothing jumps. */
  private recentre() {
    if (Math.abs(this.yaw) > Math.PI * 4) {
      const k = Math.round(this.yaw / TAU) * TAU;
      this.yaw -= k;
      if (this.seek) this.seek.yaw -= k;
    }
    if (Math.abs(this.pitch) > Math.PI * 4) {
      const k = Math.round(this.pitch / TAU) * TAU;
      this.pitch -= k;
      if (this.seek) this.seek.pitch -= k;
    }
    if (Math.abs(this.roll) > Math.PI * 4) this.roll -= Math.round(this.roll / TAU) * TAU;
  }
}
