'use client';

import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { DragDriver } from './types';

interface DragHintProps {
  /** Camera controls. The ghost finger performs real drags through it, so the sphere follows 1:1. */
  driver: DragDriver;
  /** The stage element; only its clientWidth/clientHeight are read. */
  stageRef: RefObject<HTMLElement | null>;
  /** Set to true (synchronously) by the parent on the first real touch. From then on this never touches `driver` again. */
  cancelRef: RefObject<boolean>;
  /** false fades the hint out (CSS); the parent unmounts it later. */
  visible: boolean;
  label: string;
  reducedMotion: boolean;
}

/* ── choreography ──────────────────────────────────────────────────────────
   One loop, timings in ms. `poseAt` is a pure function of time: where the
   finger is, how visible it is and whether it is pressed. The frame loop only
   samples it, so nothing here lives in React state. */

const IDLE = 700; // nothing on screen
const APPEAR = 280; // the finger fades in on its start point
const HOVER = 100; // ...and waits a beat
const PRESS = 110; // touches down without moving yet
const DRAG = 900; // the drag itself
const LIFT = 360; // fades out after letting go
const FLICK = 10; // px the lifted finger keeps drifting

const TOUCH = APPEAR + HOVER;
const MOVE = TOUCH + PRESS;
const RELEASE = MOVE + DRAG;

interface Stroke {
  /** Start point, as a fraction of the stage. */
  x: number;
  y: number;
  /** Travel, as a fraction of the stage width / height. */
  dx: number;
  dy: number;
  /** Quiet time after the release (the finger fades out inside it). */
  rest: number;
}

const STROKES: readonly Stroke[] = [
  { x: 0.7, y: 0.52, dx: -0.34, dy: 0, rest: 500 }, // left
  { x: 0.3, y: 0.52, dx: 0.34, dy: 0, rest: 500 }, // right
  { x: 0.5, y: 0.66, dx: 0, dy: -0.22, rest: 500 }, // up
  { x: 0.5, y: 0.36, dx: 0, dy: 0.22, rest: 900 }, // down
];

const CYCLE = IDLE + STROKES.reduce((sum, s) => sum + RELEASE + s.rest, 0);

/** Ghost dots behind the finger: how far behind (ms), peak opacity and size (x the 12px dot). */
const TRAIL_LAG = [90, 180, 270] as const;
const TRAIL_ALPHA = [0.5, 0.3, 0.16] as const;
const TRAIL_SCALE = [0.75, 0.55, 0.4] as const;
/** Separation (px) at which a trail dot is fully shown; a finger standing still shows none. */
const TRAIL_SPREAD = 14;

interface Pose {
  x: number;
  y: number;
  opacity: number;
  down: boolean;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (u: number) => u * u * (3 - 2 * u);

/* Ease in and out, but let go before the ease-out has finished: the finger lifts
   at roughly 40% of its peak speed, so the sphere coasts a little afterwards. */
const EASE_END = 0.88;
const EASE_NORM = smooth(EASE_END);
const travel = (u: number) => smooth(EASE_END * u) / EASE_NORM;

function poseAt(time: number, w: number, h: number, out: Pose): Pose {
  out.opacity = 0;
  out.down = false;
  let t = ((time % CYCLE) + CYCLE) % CYCLE;
  if (t < IDLE) return out;
  t -= IDLE;

  for (const s of STROKES) {
    const length = RELEASE + s.rest;
    if (t >= length) {
      t -= length;
      continue;
    }
    const tx = s.dx * w;
    const ty = s.dy * h;
    const k = t < MOVE ? 0 : travel(clamp01((t - MOVE) / DRAG));
    let x = s.x * w + tx * k;
    let y = s.y * h + ty * k;
    if (t > RELEASE) {
      const f = 1 - Math.pow(1 - clamp01((t - RELEASE) / LIFT), 3);
      const len = Math.hypot(tx, ty) || 1;
      x += (tx / len) * FLICK * f;
      y += (ty / len) * FLICK * f;
    }
    out.x = x;
    out.y = y;
    out.down = t >= TOUCH && t < RELEASE;
    if (t < APPEAR) {
      const u = t / APPEAR;
      out.opacity = 1 - (1 - u) * (1 - u);
    } else if (t < RELEASE) {
      out.opacity = 1;
    } else {
      out.opacity = 1 - smooth(clamp01((t - RELEASE) / LIFT));
    }
    return out;
  }
  return out;
}

function Chevron({ end = false }: { end?: boolean }) {
  return (
    <svg
      className={'sp-drag__chev' + (end ? ' sp-drag__chev--end' : '')}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={end ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7'} />
    </svg>
  );
}

export default function DragHint({
  driver,
  stageRef,
  cancelRef,
  visible,
  label,
  reducedMotion,
}: DragHintProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const fingerRef = useRef<HTMLDivElement>(null);
  const trailRefs = useRef<(HTMLSpanElement | null)[]>([]);

  // Always talk to the newest driver without restarting the loop when its identity changes.
  const driverRef = useRef(driver);
  useEffect(() => {
    driverRef.current = driver;
  }, [driver]);

  useEffect(() => {
    // Reduced motion: no choreography and the driver is never touched; the caption stays on screen.
    if (!visible || reducedMotion) return;
    const root = rootRef.current;
    const finger = fingerRef.current;
    if (!root || !finger) return;
    const trails = trailRefs.current;

    const pose: Pose = { x: 0, y: 0, opacity: 0, down: false };
    const tail: Pose = { x: 0, y: 0, opacity: 0, down: false };
    let raf = 0;
    let clock = 0; // animation time; advanced by clamped frame deltas, so a background tab just pauses it
    let last = performance.now();
    let down = false; // a synthetic drag is in progress: dragStart sent, dragEnd not yet
    let shown = false;

    // Read through a function so the cleanup below sees the live flag, not a stale copy.
    const cancelled = () => cancelRef.current;

    const hide = () => {
      finger.style.opacity = '0';
      for (const el of trails) if (el) el.style.opacity = '0';
      finger.classList.remove('is-down');
    };

    const letGo = (t: number) => {
      down = false;
      finger.classList.remove('is-down');
      driverRef.current.dragEnd(t);
    };

    const frame = () => {
      if (cancelled()) {
        // A real touch took over: its drag owns the camera, so the driver is off limits from here on
        // (even dragEnd would end the user's own drag).
        down = false;
        hide();
        root.classList.add('is-gone');
        return;
      }
      raf = requestAnimationFrame(frame);

      const now = performance.now();
      clock += Math.min(now - last, 50);
      last = now;

      const stage = stageRef.current;
      const w = stage ? stage.clientWidth : 0;
      const h = stage ? stage.clientHeight : 0;
      if (!w || !h) {
        if (down) letGo(now);
        return;
      }

      poseAt(clock, w, h, pose);

      // Drive the camera with exactly the position the finger is drawn at.
      const d = driverRef.current;
      if (pose.down) {
        if (down) {
          d.dragMove(pose.x, pose.y, now, h);
        } else {
          down = true;
          finger.classList.add('is-down');
          d.dragStart(pose.x, pose.y, now);
        }
      } else if (down) {
        // Let go while still moving, right after the last move, so the sphere coasts.
        d.dragMove(pose.x, pose.y, now, h);
        letGo(performance.now());
      }

      const visibleNow = pose.opacity > 0.001;
      if (!visibleNow && !shown) return; // hidden and already drawn hidden
      shown = visibleNow;

      finger.style.transform = `translate3d(${pose.x.toFixed(1)}px, ${pose.y.toFixed(1)}px, 0)`;
      finger.style.opacity = pose.opacity.toFixed(3);

      for (let i = 0; i < TRAIL_LAG.length; i++) {
        const el = trails[i];
        if (!el) continue;
        poseAt(clock - TRAIL_LAG[i], w, h, tail);
        const spread = clamp01(Math.hypot(pose.x - tail.x, pose.y - tail.y) / TRAIL_SPREAD);
        const alpha = Math.min(tail.opacity, pose.opacity) * TRAIL_ALPHA[i] * spread;
        el.style.transform = `translate3d(${tail.x.toFixed(1)}px, ${tail.y.toFixed(1)}px, 0) scale(${TRAIL_SCALE[i]})`;
        el.style.opacity = alpha.toFixed(3);
      }
    };

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      // Unmounted (or hidden) in the middle of our own drag: release it. Never after a real touch took over.
      if (down && !cancelled()) letGo(performance.now());
      hide();
    };
  }, [visible, reducedMotion, stageRef, cancelRef]);

  return (
    <div
      ref={rootRef}
      className={'sp-drag' + (visible ? '' : ' is-gone') + (reducedMotion ? ' is-still' : '')}
      aria-hidden="true"
    >
      {TRAIL_LAG.map((lag, i) => (
        <span
          key={lag}
          ref={(el) => {
            trailRefs.current[i] = el;
          }}
          className="sp-drag__trail"
        />
      ))}
      <div ref={fingerRef} className="sp-drag__finger" />
      <div className="sp-drag__label">
        <Chevron />
        <span dir="auto">{label}</span>
        <Chevron end />
      </div>
    </div>
  );
}
