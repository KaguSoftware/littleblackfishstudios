'use client';

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { lonLat, wrap, type Slot } from './layout';
import type { Navigator } from './navigator';
import type { SphereState } from './SphereCanvas';

const D2R = Math.PI / 180;
const TAU = Math.PI * 2;
const OUTLINE_STEPS = 18; // points per edge of the view outline

interface MinimapProps {
  nav: Navigator;
  slots: Slot[];
  stateRef: MutableRefObject<SphereState>;
  focus: number;
  filter: string;
  title: string;
  label: string;
}

/** Corners of a screen as [lon, lat] pairs, with longitudes unrolled around the screen's own. */
function cornersOf(s: Slot): [number, number][] {
  const hx = s.half[0] * s.scale;
  const hy = s.half[1] * s.scale;
  return (
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const
  ).map(([sx, sy]) => {
    const q = [0, 1, 2].map((k) => s.center[k] + s.right[k] * sx * hx + s.up[k] * sy * hy);
    const { lon, lat } = lonLat(q);
    return [s.lon + wrap(lon - s.lon), lat];
  });
}

/** Unrolled map of the whole sphere: every screen, plus the outline of what you're looking at. Click / drag to jump. */
export default function Minimap({ nav, slots, stateRef, focus, filter, title, label }: MinimapProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef({ focus, filter });
  useEffect(() => {
    live.current = { focus, filter };
  });
  const shapes = useMemo(() => slots.map((s) => ({ pts: cornersOf(s), cap: s.ringInfo.count === 1 })), [slots]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let last = 0;
    let W = 0;
    let H = 0;

    const fit = () => {
      const r = cv.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width;
      H = r.height;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(cv);

    const X = (lon: number) => (lon / TAU + 0.5) * W;
    const Y = (lat: number) => (0.5 - lat / Math.PI) * H;

    /** Fill a polygon of [lon, lat] points, repeated across the map's left/right seam. */
    const poly = (pts: [number, number][]) => {
      for (const off of [-TAU, 0, TAU]) {
        const xs = pts.map((p) => X(p[0] + off));
        if (Math.max(...xs) < 0 || Math.min(...xs) > W) continue;
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(X(p[0] + off), Y(p[1])) : ctx.moveTo(X(p[0] + off), Y(p[1]))));
        ctx.closePath();
        ctx.fill();
      }
    };

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (now - last < 33) return;
      last = now;
      const { focus: f, filter: flt } = live.current;
      ctx.clearRect(0, 0, W, H);

      // parallels / meridians
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.beginPath();
      for (let d = -75; d <= 75; d += 15) {
        ctx.moveTo(0, Y(d * D2R));
        ctx.lineTo(W, Y(d * D2R));
      }
      for (let d = -150; d <= 150; d += 30) {
        ctx.moveTo(X(d * D2R), 0);
        ctx.lineTo(X(d * D2R), H);
      }
      ctx.stroke();

      // the screens
      ctx.fillStyle = '#fff';
      slots.forEach((s, i) => {
        const match = flt === 'all' || s.project.categoryId === flt;
        const hot = i === f || i === stateRef.current.hover;
        ctx.globalAlpha = !match ? 0.08 : hot ? 1 : f >= 0 ? 0.2 : 0.42;
        const shape = shapes[i];
        if (shape.cap) {
          // a pole: the whole strip around the top or bottom edge of the map
          const edge = s.lat > 0 ? 1 : -1;
          const inner = Math.min(...shape.pts.map((p) => p[1] * edge));
          const y0 = Y(edge * (Math.PI / 2));
          const y1 = Y(edge * inner);
          ctx.fillRect(0, Math.min(y0, y1), W, Math.abs(y1 - y0) || 1.5);
        } else {
          poly(shape.pts);
        }
      });
      ctx.globalAlpha = 1;

      // what you're looking at: the outline of the view, which bends and wraps as it nears a pole
      const B = nav.basis();
      const tanV = Math.tan((nav.fov * D2R) / 2);
      const tanH = tanV * nav.aspect;
      const ring: [number, number][] = [];
      const edgeAt = (x: number, y: number) => {
        const d = [0, 1, 2].map((k) => B.f[k] + B.r[k] * x * tanH + B.u[k] * y * tanV);
        const { lon, lat } = lonLat(d);
        ring.push([lon, lat]);
      };
      for (let k = 0; k < OUTLINE_STEPS; k++) edgeAt(-1 + (2 * k) / OUTLINE_STEPS, -1);
      for (let k = 0; k < OUTLINE_STEPS; k++) edgeAt(1, -1 + (2 * k) / OUTLINE_STEPS);
      for (let k = 0; k < OUTLINE_STEPS; k++) edgeAt(1 - (2 * k) / OUTLINE_STEPS, 1);
      for (let k = 0; k < OUTLINE_STEPS; k++) edgeAt(-1, 1 - (2 * k) / OUTLINE_STEPS);
      // unroll longitudes so the outline is one continuous line
      const pts: [number, number][] = [ring[0]];
      for (let i = 1; i < ring.length; i++) pts.push([pts[i - 1][0] + wrap(ring[i][0] - pts[i - 1][0]), ring[i][1]]);
      const closing = wrap(ring[0][0] - pts[pts.length - 1][0]);
      const spin = pts[pts.length - 1][0] + closing - pts[0][0]; // ±2π when the view holds a pole
      if (Math.abs(spin) > Math.PI) {
        const pole = B.f[1] >= 0 ? 1 : -1; // the pole the view is pointing toward
        pts.push([pts[0][0] + spin, ring[0][1]]);
        pts.push([pts[0][0] + spin, pole * (Math.PI / 2)]);
        pts.push([pts[0][0], pole * (Math.PI / 2)]);
      }
      for (const off of [-TAU, 0, TAU]) {
        const xs = pts.map((p) => X(p[0] + off));
        if (Math.max(...xs) < 0 || Math.min(...xs) > W) continue;
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(X(p[0] + off), Y(p[1])) : ctx.moveTo(X(p[0] + off), Y(p[1]))));
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.lineWidth = 1.25;
        ctx.stroke();
      }

      // and the exact middle of the view
      const mid = lonLat(B.f);
      ctx.fillStyle = '#fff';
      for (const off of [-TAU, 0, TAU]) {
        const x = X(mid.lon + off);
        if (x < -3 || x > W + 3) continue;
        ctx.beginPath();
        ctx.arc(x, Y(mid.lat), 2, 0, TAU);
        ctx.fill();
      }
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [nav, slots, stateRef, shapes]);

  // click / drag on the map to jump
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    let active = false;
    const go = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      const fx = (e.clientX - r.left) / r.width;
      const fy = (e.clientY - r.top) / r.height;
      nav.lookAt((fx - 0.5) * TAU, (0.5 - fy) * Math.PI, 7);
    };
    const down = (e: PointerEvent) => {
      active = true;
      cv.setPointerCapture(e.pointerId);
      go(e);
      e.stopPropagation();
    };
    const move = (e: PointerEvent) => {
      if (active) go(e);
    };
    const up = () => {
      active = false;
    };
    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    return () => {
      cv.removeEventListener('pointerdown', down);
      cv.removeEventListener('pointermove', move);
      cv.removeEventListener('pointerup', up);
      cv.removeEventListener('pointercancel', up);
    };
  }, [nav]);

  return (
    <div className="sp-map">
      <div className="sp-map__label">{title}</div>
      <canvas ref={ref} className="sp-map__cv" aria-label={label} />
    </div>
  );
}
