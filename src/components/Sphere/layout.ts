import { CONFIG } from './config';
import type { SphereProject } from './types';

const D2R = Math.PI / 180;
const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export type Vec3 = [number, number, number];

/** Longitude folded into [-π, π). */
export const wrap = (a: number) => {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
};

/**
 * The direction at a longitude / latitude, and a screen's own axes there: `right` runs east along
 * the ring, `up` runs north toward the pole. Longitude 0 faces -z; the camera starts looking there.
 */
export function frameAt(lon: number, lat: number): { center: Vec3; right: Vec3; up: Vec3 } {
  const cl = Math.cos(lat);
  const sl = Math.sin(lat);
  const cL = Math.cos(lon);
  const sL = Math.sin(lon);
  return {
    center: [sL * cl, sl, -cL * cl],
    right: [cL, 0, sL],
    up: [-sL * sl, cl, cL * sl],
  };
}

/** Longitude / latitude of a direction. */
export function lonLat(d: ArrayLike<number>) {
  return { lon: Math.atan2(d[0], -d[2]), lat: Math.asin(clamp(d[1], -1, 1)) };
}

/** One latitude ring of screens. Slots are numbered ring by ring, south to north. */
export interface Ring {
  start: number;
  count: number;
  lat: number;
  /** How big its screens are drawn, as a fraction of full size. */
  scale: number;
}

/** One screen. Everything here is fixed: the camera does all the turning. */
export interface Slot {
  index: number;
  ring: number;
  col: number;
  lon: number;
  lat: number;
  center: Vec3;
  right: Vec3;
  up: Vec3;
  /** Half extents of the screen at full size, on its tangent plane. */
  half: [number, number];
  /** Fraction of full size it is drawn at: 1 on most rings, less toward the poles. */
  scale: number;
  seed: number;
  projectIndex: number;
  project: SphereProject;
  ringInfo: Ring;
}

export interface Layout {
  slots: Slot[];
  rings: Ring[];
  tile: { W: number; H: number; half: [number, number] };
}

// Deterministic PRNG so the layout is identical on every load.
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(x: number) {
  const s = Math.sin(x) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Hand out projects to screens so repeats are as far apart as possible (simulated annealing on a
 * "same project, close together" energy, measured as the angle between the screens on the sphere).
 */
function assignProjects(slots: Slot[], count: number): number[] {
  const n = slots.length;
  const rnd = mulberry32(1337);
  const p = new Array<number>(n);
  const order = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  order.forEach((slotIdx, k) => {
    p[slotIdx] = k % count;
  });
  if (count < 2) return p;

  const sigma2 = 2 * 0.62 * 0.62;
  const W = Array.from({ length: n }, () => new Float32Array(n));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const a = slots[i].center;
      const b = slots[j].center;
      const ang = Math.acos(clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1));
      W[i][j] = Math.exp(-(ang * ang) / sigma2);
    }
  }
  const contrib = (i: number, proj: number, skip: number) => {
    let e = 0;
    for (let j = 0; j < n; j++) if (j !== i && j !== skip && p[j] === proj) e += W[i][j];
    return e;
  };
  const iters = 24000;
  for (let it = 0; it < iters; it++) {
    const i = Math.floor(rnd() * n);
    const j = Math.floor(rnd() * n);
    if (i === j || p[i] === p[j]) continue;
    const before = contrib(i, p[i], -1) + contrib(j, p[j], -1);
    const after = contrib(i, p[j], j) + contrib(j, p[i], i);
    const d = after - before;
    const T = 0.6 * (1 - it / iters) + 0.005;
    if (d < 0 || rnd() < Math.exp(-d / T)) {
      const t = p[i];
      p[i] = p[j];
      p[j] = t;
    }
  }
  return p;
}

/**
 * Screens shrink a little on the outer rings. A screen's edges are straight lines on its tangent
 * plane, so their ends swing toward the equator, and on the outer rings that would meet the screens
 * of the ring below.
 */
export function ringScale(latDeg: number) {
  return 1 - 0.22 * smooth(40, 75, Math.abs(latDeg));
}

/** How many screens fit round a ring at this latitude. */
export function ringCount(latDeg: number, scale: number) {
  if (Math.abs(latDeg) >= 90) return 1;
  const pitch = CONFIG.tileWidthDeg * scale + CONFIG.gapDeg;
  return Math.max(1, Math.floor((360 * Math.cos(latDeg * D2R)) / pitch));
}

/** Latitudes of the rings, south pole first. */
function ringLats() {
  const out = [-90];
  for (let l = -CONFIG.maxLatDeg; l <= CONFIG.maxLatDeg + 1e-6; l += CONFIG.rowStepDeg) out.push(l);
  out.push(90);
  return out;
}

/**
 * Lay the screens out over the whole sphere: rings of latitude, every other ring shifted half a
 * step, a single small screen on each pole. Each slot is one screen: a unit centre direction plus a
 * tangent frame (right/up). The vertex shader builds a gnomonic patch from it, which looks
 * perfectly flat from the middle.
 */
export function buildSlots(projects: SphereProject[]): Layout {
  const W = CONFIG.tileWidthDeg * D2R;
  const H = W / CONFIG.aspect;
  const half: [number, number] = [Math.tan(W / 2), Math.tan(H / 2)];
  const slots: Slot[] = [];
  const rings: Ring[] = [];

  ringLats().forEach((latDeg, r) => {
    const pole = Math.abs(latDeg) >= 90;
    const scale = pole ? CONFIG.poleScale : ringScale(latDeg);
    const count = ringCount(latDeg, scale);
    const lat = latDeg * D2R;
    const step = TAU / count;
    const stagger = pole ? 0 : Math.abs(Math.round(latDeg / CONFIG.rowStepDeg)) % 2; // 0 on the equator
    const start = slots.length;
    const ring: Ring = { start, count, lat, scale };
    for (let k = 0; k < count; k++) {
      const lon = pole ? 0 : wrap(k * step + stagger * 0.5 * step);
      const { center, right, up } = frameAt(lon, lat);
      const index = slots.length;
      slots.push({
        index,
        ring: r,
        col: k,
        lon,
        lat,
        center,
        right,
        up,
        half,
        scale,
        seed: hash(index * 12.9898 + 4.1414),
        projectIndex: 0,
        project: projects[0],
        ringInfo: ring,
      });
    }
    rings.push(ring);
  });

  if (projects.length > 0) {
    const assign = assignProjects(slots, projects.length);
    slots.forEach((s, i) => {
      s.projectIndex = assign[i];
      s.project = projects[assign[i]];
    });
  }
  return { slots, rings, tile: { W, H, half } };
}

/**
 * Keyboard neighbour for an upright view: dx steps along the ring, dy steps north (-1, up the
 * screen) or south (+1). Past a pole it carries on down the far side.
 */
export function neighbour(layout: Layout, slots: Slot[], from: number, dx: number, dy: number) {
  const s = slots[from];
  if (dx) {
    const { start, count } = s.ringInfo;
    return count === 1 ? from : start + ((s.col + dx + count) % count);
  }
  if (dy) {
    const n = layout.rings.length;
    let r = s.ring + (dy < 0 ? 1 : -1);
    let lon = s.lon;
    if (r >= n) {
      r = n - 2;
      lon += Math.PI;
    } else if (r < 0) {
      r = 1;
      lon += Math.PI;
    }
    const t = layout.rings[r];
    let best = t.start;
    let bd = Infinity;
    for (let i = t.start; i < t.start + t.count; i++) {
      const d = Math.abs(wrap(slots[i].lon - lon));
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }
  return from;
}
