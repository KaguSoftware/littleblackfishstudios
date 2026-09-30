'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import './sphere.css';
import SphereCanvas, { type SphereApi, type SphereState } from './SphereCanvas';
import { Navigator, type SavedView } from './navigator';
import { buildSlots, neighbour, lonLat, type Slot } from './layout';
import { buildLabelAtlas, type Atlas } from './labelAtlas';
import { SPHERE_COPY } from './copy';
import { CONFIG } from './config';
import Minimap from './Minimap';
import Panel from './Panel';
import DragHint from './DragHint';
import { ALL_ID, type SphereCategory, type SphereLocale, type SphereProject } from './types';

export interface SpherePortfolioProps {
  projects: SphereProject[];
  categories: SphereCategory[];
  locale: SphereLocale;
}

const R2D = 180 / Math.PI;
const STORE = 'sphere:view';

type Saved = SavedView & { filter: string };

/** Where you were, if you are coming back to the page (e.g. with the Back button). */
function readSaved(): Saved | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(STORE) ?? 'null');
    if (v && [v.yaw, v.pitch, v.zoom].every((n) => typeof n === 'number' && Number.isFinite(n))) return v;
  } catch {
    /* no storage, or junk in it */
  }
  return null;
}

const pad = (n: number, l = 3) => String(Math.abs(Math.round(n))).padStart(l, '0');
const sgn = (n: number) => (n < 0 ? '−' : '+');

export default function SpherePortfolio({ projects: all, categories, locale }: SpherePortfolioProps) {
  const copy = SPHERE_COPY[locale];
  const rtl = locale === 'fa';
  const router = useRouter();
  const projects = useMemo(() => all.slice(0, CONFIG.maxProjects), [all]);
  const layout = useMemo(() => buildSlots(projects), [projects]);
  const { slots } = layout;

  const saved = useMemo(() => readSaved(), []);
  const reducedMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const coarse = useMemo(() => window.matchMedia('(pointer: coarse)').matches, []);
  const nav = useMemo(() => new Navigator({ reducedMotion, rtl, restore: saved }), [reducedMotion, rtl, saved]);
  const startFilter = saved && categories.some((c) => c.id === saved.filter) ? saved.filter : ALL_ID;

  const stateRef = useRef<SphereState>({
    hover: -1,
    focus: -1,
    dragging: false,
    filter: startFilter,
    reducedMotion,
    skipIntro: !!saved,
    pointer: { active: false, x: 0, y: 0 },
  });
  const apiRef = useRef<SphereApi | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const cursorLabelRef = useRef<HTMLSpanElement>(null);
  const readoutRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const dragCancel = useRef(false);

  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [ready, setReady] = useState(false);
  const [focus, setFocus] = useState(-1);
  const [shown, setShown] = useState<Slot | null>(null);
  const [filter, setFilterState] = useState(startFilter);
  const [hint, setHint] = useState<'off' | 'on' | 'out'>('off');

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let live = true;
    buildLabelAtlas(projects, root, rtl)
      .then((a) => live && setAtlas(a))
      .catch((e) => console.error('[sphere] label atlas failed', e));
    return () => {
      live = false;
    };
  }, [projects, rtl]);

  // ── actions ────────────────────────────────────────────────
  const focusSlot = useCallback(
    (i: number) => {
      if (i < 0 || i >= slots.length) return;
      stateRef.current.focus = i;
      nav.focusOn(slots[i]);
      setShown(slots[i]);
      setFocus(i);
      router.prefetch(slots[i].project.href);
    },
    [nav, slots, router],
  );

  const clearFocus = useCallback(() => {
    stateRef.current.focus = -1;
    nav.clearFocus();
    setFocus(-1);
  }, [nav]);

  /** The screen nearest the middle of the view that passes `predicate`. */
  const nearestSlot = useCallback(
    (predicate: (s: Slot) => boolean) => {
      const f = nav.basis().f;
      let best = -1;
      let bd = -2;
      slots.forEach((s, i) => {
        if (!predicate(s)) return;
        const d = f[0] * s.center[0] + f[1] * s.center[1] + f[2] * s.center[2];
        if (d > bd) {
          bd = d;
          best = i;
        }
      });
      return best;
    },
    [nav, slots],
  );

  const setFilter = useCallback(
    (f: string) => {
      stateRef.current.filter = f;
      setFilterState(f);
      if (stateRef.current.focus >= 0) clearFocus();
      if (f !== ALL_ID) {
        const i = nearestSlot((s) => s.project.categoryId === f);
        if (i >= 0) nav.lookAt(slots[i].lon, slots[i].lat, 4);
      }
    },
    [clearFocus, nav, nearestSlot, slots],
  );

  const openProject = useCallback(
    (pi: number) => {
      const i = nearestSlot((s) => s.projectIndex === pi);
      if (i >= 0) focusSlot(i);
    },
    [focusSlot, nearestSlot],
  );

  /** Previous / next project in list order (within the active filter), flying to its nearest screen. */
  const gotoProject = useCallback(
    (delta: number) => {
      const f = stateRef.current.filter;
      const order = projects.map((_, i) => i).filter((i) => f === ALL_ID || projects[i].categoryId === f);
      if (!order.length) return;
      const cur = order.indexOf(shown?.projectIndex ?? -1);
      const at = cur < 0 ? (delta > 0 ? -1 : 0) : cur;
      openProject(order[(at + delta + order.length) % order.length]);
    },
    [openProject, projects, shown],
  );

  const step = useCallback(
    (dx: number, dy: number) => {
      const cur = stateRef.current.focus;
      if (cur < 0) return;
      focusSlot(neighbour(layout, slots, cur, dx, dy));
    },
    [focusSlot, layout, slots],
  );

  const dismissHint = useCallback(() => {
    dragCancel.current = true; // synchronously: the demo must not touch the camera again
    setHint((h) => (h === 'on' ? 'out' : h));
  }, []);

  // ── pointer / wheel / keyboard on the stage ────────────────
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !atlas) return;
    const st = stateRef.current;
    const pointers = new Map<number, { x: number; y: number }>();
    let down: { x: number; y: number; moved: boolean; pick: number } | null = null;
    let pinch: { d0: number; z0: number } | null = null;
    const cursor = { x: -100, y: -100, tx: -100, ty: -100, raf: 0, mouse: true, mode: '' };

    const ndc = (x: number, y: number): [number, number] => {
      const r = el.getBoundingClientRect();
      return [((x - r.left) / r.width) * 2 - 1, -(((y - r.top) / r.height) * 2 - 1)];
    };
    const pick = (x: number, y: number) => {
      const api = apiRef.current;
      if (!api) return -1;
      const [nx, ny] = ndc(x, y);
      return api.pick(nx, ny);
    };

    /** Press / tap: open the screen that was under the pointer when it went down, i.e. the highlighted one. */
    const activate = (i: number) => {
      if (i >= 0) {
        if (i === st.focus) router.push(slots[i].project.href);
        else focusSlot(i);
      } else if (st.focus >= 0) clearFocus();
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dismissHint();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* pointer already gone */
      }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      el.focus({ preventScroll: true });
      cursor.mouse = e.pointerType === 'mouse';
      if (pointers.size === 1) {
        const i = pick(e.clientX, e.clientY);
        down = { x: e.clientX, y: e.clientY, moved: false, pick: i };
        if (!cursor.mouse) st.hover = i; // touch: light up the screen under the finger
        nav.dragStart(e.clientX, e.clientY, performance.now());
      } else if (pointers.size === 2) {
        nav.dragEnd(performance.now());
        st.dragging = false;
        st.hover = -1;
        down = null;
        const [a, b] = [...pointers.values()];
        pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: nav.zoomTarget };
      }
    };

    const onMove = (e: PointerEvent) => {
      cursor.tx = e.clientX;
      cursor.ty = e.clientY;
      if (e.pointerType === 'mouse') {
        cursor.mouse = true;
        const [nx, ny] = ndc(e.clientX, e.clientY);
        st.pointer.active = true;
        st.pointer.x = nx;
        st.pointer.y = ny;
      }
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        nav.setZoom(pinch.z0 * (pinch.d0 / (Math.hypot(a.x - b.x, a.y - b.y) || 1)));
        return;
      }
      if (down) {
        if (!down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) {
          down.moved = true;
          st.dragging = true;
          st.hover = -1;
          if (st.focus >= 0) {
            clearFocus();
            nav.dragStart(e.clientX, e.clientY, performance.now());
          }
          hintRef.current?.classList.add('is-gone');
        }
        if (down.moved) nav.dragMove(e.clientX, e.clientY, performance.now(), el.getBoundingClientRect().height);
      }
    };

    const onUp = (e: PointerEvent) => {
      const had = pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (!had || !down) {
        if (!pointers.size) {
          nav.dragEnd(performance.now());
          st.dragging = false;
          if (!cursor.mouse) st.hover = -1;
        }
        return;
      }
      const wasClick = !down.moved;
      const target = down.pick;
      nav.dragEnd(performance.now());
      st.dragging = false;
      down = null;
      if (!cursor.mouse) st.hover = -1;
      if (wasClick) activate(target);
    };

    const onLeave = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      st.pointer.active = false;
      st.hover = -1;
      cursor.tx = -100;
      cursor.ty = -100;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      nav.wheel(dy);
      hintRef.current?.classList.add('is-gone');
    };

    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      if (k === 'Escape' && st.focus >= 0) {
        clearFocus();
        e.preventDefault();
        return;
      }
      if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown') {
        e.preventDefault();
        const dx = k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : 0;
        const dy = k === 'ArrowDown' ? 1 : k === 'ArrowUp' ? -1 : 0;
        if (st.focus >= 0) step(dx, dy);
        else nav.nudge(dx * 0.42, -dy * 0.3);
        return;
      }
      if (k === 'Enter') {
        if (st.focus >= 0) {
          e.preventDefault();
          router.push(slots[st.focus].project.href);
        } else {
          const i = st.hover >= 0 ? st.hover : nearestSlot(() => true);
          if (i >= 0) {
            e.preventDefault();
            focusSlot(i);
          }
        }
        return;
      }
      if (k === '+' || k === '=') nav.setZoom(nav.zoomTarget * 0.85);
      if (k === '-' || k === '_') nav.setZoom(nav.zoomTarget / 0.85);
    };

    const LABEL: Record<string, string> = { tile: copy.open, view: copy.view, back: copy.back };
    const CURSOR: Record<string, string> = { idle: 'grab', tile: 'pointer', view: 'pointer', back: 'zoom-out', drag: 'grabbing' };
    const loop = () => {
      cursor.x += (cursor.tx - cursor.x) * 0.22;
      cursor.y += (cursor.ty - cursor.y) * 0.22;
      const c = cursorRef.current;
      if (c) {
        const r = el.getBoundingClientRect();
        c.style.transform = `translate3d(${cursor.x - r.left}px, ${cursor.y - r.top}px, 0)`;
        c.style.opacity = cursor.tx < 0 ? '0' : '1';
        // the halo and the pointer always describe the screen that is highlighted right now
        const i = st.hover;
        const mode = !cursor.mouse
          ? 'idle'
          : st.dragging
            ? 'drag'
            : i >= 0
              ? i === st.focus
                ? 'view'
                : 'tile'
              : st.focus >= 0
                ? 'back'
                : 'idle';
        if (mode !== cursor.mode) {
          cursor.mode = mode;
          c.dataset.mode = mode;
          if (cursorLabelRef.current) cursorLabelRef.current.textContent = LABEL[mode] ?? '';
          if (cursor.mouse) el.style.cursor = CURSOR[mode];
        }
      }
      cursor.raf = requestAnimationFrame(loop);
    };
    cursor.raf = requestAnimationFrame(loop);

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(cursor.raf);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('keydown', onKey);
    };
  }, [atlas, nav, slots, router, copy, focusSlot, clearFocus, step, nearestSlot, dismissHint]);

  // ── phones: show the ghost finger once the intro has settled ───────────
  useEffect(() => {
    if (!ready || !coarse || saved) return;
    const t = window.setTimeout(() => {
      if (nav.interacted) return;
      dragCancel.current = false;
      setHint('on');
    }, 2600);
    return () => window.clearTimeout(t);
  }, [ready, coarse, saved, nav]);

  useEffect(() => {
    if (hint !== 'out') return;
    const t = window.setTimeout(() => setHint('off'), 700);
    return () => window.clearTimeout(t);
  }, [hint]);

  // live coordinate readout (written straight to the DOM)
  useEffect(() => {
    const id = setInterval(() => {
      const r = readoutRef.current;
      if (!r) return;
      const here = lonLat(nav.basis().f);
      const lon = here.lon * R2D;
      const lat = here.lat * R2D;
      const n = apiRef.current ? apiRef.current.stats.visible : 0;
      r.textContent = `LON ${sgn(lon)}${pad(lon)}°  LAT ${sgn(lat)}${pad(lat, 2)}°  ·  ${n} ${copy.inView}`;
    }, 120);
    return () => clearInterval(id);
  }, [nav, copy]);

  // remember the view, so Back from a project lands where you left
  useEffect(() => {
    const save = () => {
      try {
        sessionStorage.setItem(STORE, JSON.stringify({ ...nav.view, filter: stateRef.current.filter }));
      } catch {
        /* storage unavailable */
      }
    };
    window.addEventListener('pagehide', save);
    return () => {
      window.removeEventListener('pagehide', save);
      save();
    };
  }, [nav]);

  // tiny debugging hook, only with ?debug in the URL
  useEffect(() => {
    if (!/[?&]debug\b/.test(window.location.search)) return undefined;
    const dbg = {
      get yaw() {
        return nav.yaw;
      },
      get pitch() {
        return nav.pitch;
      },
      get fov() {
        return nav.fov;
      },
      get stats() {
        return apiRef.current ? { ...apiRef.current.stats } : null;
      },
      get hover() {
        return stateRef.current.hover;
      },
      get focus() {
        return stateRef.current.focus;
      },
      get filter() {
        return stateRef.current.filter;
      },
      slots: slots.length,
      projectOf: (i: number) => slots[i]?.project.id ?? null,
      slotInfo: (i: number) => ({ project: slots[i].project.id, ring: slots[i].ring, col: slots[i].col, lat: slots[i].lat, scale: slots[i].scale }),
      screenOf: (i: number) => apiRef.current?.screenOf(i) ?? null,
      pickAt(x: number, y: number) {
        const r = stageRef.current?.getBoundingClientRect();
        if (!r || !apiRef.current) return -1;
        return apiRef.current.pick(((x - r.left) / r.width) * 2 - 1, -(((y - r.top) / r.height) * 2 - 1));
      },
      focusSlot,
      clearFocus,
      nav,
    };
    (window as unknown as { __SPHERE__?: typeof dbg }).__SPHERE__ = dbg;
    return () => {
      const w = window as unknown as { __SPHERE__?: typeof dbg };
      if (w.__SPHERE__ === dbg) delete w.__SPHERE__;
    };
  }, [nav, slots, focusSlot, clearFocus]);

  if (projects.length === 0) return null;

  const fmt = (n: number) => (rtl ? n.toLocaleString('fa-IR') : String(n).padStart(2, '0'));
  const chips = [{ id: ALL_ID, label: copy.all }, ...categories];

  return (
    <section ref={rootRef} className="sp-root" dir={rtl ? 'rtl' : 'ltr'} lang={locale} data-focus={focus >= 0 ? 'true' : 'false'}>
      <div ref={stageRef} className="sp-stage" tabIndex={0} role="application" aria-label={copy.stageLabel}>
        {atlas && (
          <SphereCanvas
            nav={nav}
            slots={slots}
            atlas={atlas}
            rtl={rtl}
            stateRef={stateRef}
            apiRef={apiRef}
            onReady={() => setReady(true)}
          />
        )}
        <div className="sp-vignette" aria-hidden="true" />
        <div ref={cursorRef} className="sp-cursor" data-mode="idle" aria-hidden="true">
          <span className="sp-cursor__dot" />
          <span ref={cursorLabelRef} className="sp-cursor__label" />
        </div>
      </div>

      {hint !== 'off' && (
        <DragHint
          driver={nav}
          stageRef={stageRef}
          cancelRef={dragCancel}
          visible={hint === 'on'}
          label={copy.dragHint}
          reducedMotion={reducedMotion}
        />
      )}

      <header className="sp-top" data-ui>
        <div className="sp-brand">
          <svg className="sp-mark" viewBox="0 0 32 32" aria-hidden="true">
            <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <ellipse cx="16" cy="16" rx="14" ry="5.5" fill="none" stroke="currentColor" strokeWidth="1" opacity=".55" />
            <ellipse cx="16" cy="16" rx="5.5" ry="14" fill="none" stroke="currentColor" strokeWidth="1" opacity=".55" />
            <circle cx="16" cy="16" r="2.4" fill="currentColor" />
          </svg>
          <div>
            <div className="sp-kicker">{copy.kicker}</div>
            <h1 className="sp-title">
              {copy.title}
              <sup>{fmt(projects.length)}</sup>
            </h1>
          </div>
        </div>
        <nav className="sp-filters" aria-label={copy.filterLabel}>
          {chips.map((c) => (
            <button key={c.id} type="button" className="sp-chip" aria-pressed={filter === c.id} onClick={() => setFilter(c.id)}>
              {c.label}
            </button>
          ))}
        </nav>
      </header>

      <footer className="sp-bottom" data-ui>
        <Minimap
          nav={nav}
          slots={slots}
          stateRef={stateRef}
          focus={focus}
          filter={filter}
          title={copy.map}
          label={copy.mapLabel}
        />
        <div className="sp-info">
          <div ref={hintRef} className="sp-hint">
            <span className="sp-hint__fine">
              {copy.hintFine.map(([lead, rest], i) => (
                <span key={lead}>
                  {i > 0 && ' · '}
                  <b>{lead}</b> {rest}
                </span>
              ))}
            </span>
            <span className="sp-hint__touch">
              {copy.hintTouch.map(([lead, rest], i) => (
                <span key={lead}>
                  {i > 0 && ' · '}
                  <b>{lead}</b> {rest}
                </span>
              ))}
            </span>
          </div>
          <div ref={readoutRef} className="sp-readout" dir="ltr" aria-hidden="true" />
        </div>
      </footer>

      <Panel
        project={shown?.project ?? null}
        index={shown?.projectIndex ?? 0}
        total={projects.length}
        open={focus >= 0}
        rtl={rtl}
        copy={copy}
        onClose={clearFocus}
        onPrev={() => gotoProject(-1)}
        onNext={() => gotoProject(1)}
      />

      {/* keyboard / screen-reader route to every project */}
      <ul className="sp-sr" aria-label={copy.allProjects}>
        {projects.map((p, i) => (
          <li key={p.id}>
            <button type="button" onClick={() => openProject(i)}>
              {p.title}
              {p.category ? `, ${p.category}` : ''}
            </button>
          </li>
        ))}
      </ul>

      <div className={'sp-loader' + (ready ? ' is-done' : '')} aria-hidden={ready}>
        <div className="sp-loader__ring" />
        <span>{copy.loader}</span>
      </div>
    </section>
  );
}
