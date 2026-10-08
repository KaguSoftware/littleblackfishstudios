'use client';

/* eslint-disable react-hooks/immutability, react-hooks/set-state-in-effect --
   this component drives an imperative WebGL engine (GlobeNav) and pointer-gesture closures; the
   React Compiler purity rules do not model that, and the mutations are intentional. */

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { MouseEvent, RefObject } from 'react';
import { ArrowRight } from 'lucide-react';
import { GLOBE_COPY } from './copy';
import { CONFIG } from './config';
import { GlobeNav } from './globeNav';
import { getAtlas, getLayout } from './cache';
import { writeEntry } from './entry';
import { detectWebGL } from './webgl';
import type { Atlas } from './labelAtlas';
import type { SphereLocale, SphereProject } from './types';

// WebGL only, and only worth downloading once the visitor is close to it: the hero is the first
// thing on the page, and none of this (three.js included) should compete with it.
const GlobeCanvas = dynamic(() => import('./GlobeCanvas'), { ssr: false });

// Nothing ever changes, so there is nothing to subscribe to; the server render assumes support.
const subscribe = () => () => {};
const getServerSnapshot = () => true;

/** Safety net: if the render loop is stalled, the dive still ends. */
const DIVE_TIMEOUT_MS = 3200;

interface HomeGlobeProps {
  projects: SphereProject[];
  locale: SphereLocale;
}

/** Keeps `flag` true from the moment the element comes within `margin` of the viewport. */
function useNear(ref: RefObject<Element | null>, margin: string) {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return undefined;
    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && setNear(true), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, margin, near]);
  return near;
}

/** True while the element is on screen (within `margin`); the globe stops drawing when it isn't. */
function useOnScreen(ref: RefObject<Element | null>, margin: string) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([entry]) => setOn(entry.isIntersecting), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, margin]);
  return on;
}

export default function HomeGlobe({ projects: all, locale }: HomeGlobeProps) {
  const copy = GLOBE_COPY[locale];
  const rtl = locale === 'fa';
  const href = `/${locale}/projects`;
  const router = useRouter();
  const pathname = usePathname();
  const projects = useMemo(() => all.slice(0, CONFIG.maxProjects), [all]);

  const hasWebGL = useSyncExternalStore(subscribe, detectWebGL, getServerSnapshot);
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const near = useNear(sectionRef, '900px 0px');
  const onScreen = useOnScreen(sectionRef, '80px 0px');
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [ready, setReady] = useState(false);
  const [entering, setEntering] = useState(false);
  const nav = useMemo(() => new GlobeNav(), []);

  // The layout (a lot of swapping to keep repeats apart) is built when the globe is about to be
  // needed, not on page load, and the projects page reuses it.
  const layout = useMemo(() => (near && hasWebGL && projects.length ? getLayout(projects, rtl) : null), [near, hasWebGL, projects, rtl]);

  useEffect(() => {
    nav.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, [nav]);

  // Everything the dive leads into is warmed up while the visitor is still reading: the page
  // (its data), the engine's code, the label texture, and the small posters the globe loads.
  useEffect(() => {
    if (!near || !hasWebGL) return;
    router.prefetch(href);
    void import('./SpherePortfolio');
  }, [near, hasWebGL, router, href]);

  useEffect(() => {
    const root = sectionRef.current;
    if (!near || !hasWebGL || !root || projects.length === 0) return undefined;
    let live = true;
    getAtlas(projects, root, rtl)
      .then((a) => live && setAtlas(a))
      .catch((e) => console.error('[globe] label atlas failed', e));
    return () => {
      live = false;
    };
  }, [near, hasWebGL, projects, rtl]);

  // tiny debugging hook, only with ?debug in the URL
  useEffect(() => {
    if (!/[?&]debug\b/.test(window.location.search)) return undefined;
    const w = window as unknown as { __GLOBE__?: GlobeNav };
    w.__GLOBE__ = nav;
    return () => {
      if (w.__GLOBE__ === nav) delete w.__GLOBE__;
    };
  }, [nav]);

  // Back on the home page after the dive (or the page was kept alive): the globe is just a globe.
  useEffect(() => {
    nav.reset();
    setEntering(false);
    if (fadeRef.current) fadeRef.current.style.opacity = '0';
  }, [pathname, nav]);

  const enter = useCallback(() => {
    if (entering) return;
    const slots = layout?.slots;
    // No canvas to dive through (no WebGL, still loading, reduced motion): just go.
    if (!slots || !ready || nav.reducedMotion || !onScreen) {
      router.push(href);
      return;
    }
    setEntering(true);
    let gone = false;
    const go = () => {
      if (gone) return;
      gone = true;
      writeEntry({ yaw: nav.yaw, pitch: nav.pitch });
      router.push(href);
    };
    nav.onDone = go;
    window.setTimeout(go, DIVE_TIMEOUT_MS);
    nav.enter(slots);
  }, [entering, layout, ready, nav, onScreen, router, href]);

  const onCta = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return; // let the browser open it
    e.preventDefault();
    enter();
  };

  // ── drag to spin, tap to go in ─────────────────────────────
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    let down: { id: number; x: number; y: number; moved: boolean } | null = null;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (down) return;
      down = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* pointer already gone */
      }
      nav.dragStart(e.clientX, e.clientY, performance.now());
    };
    const onMove = (e: PointerEvent) => {
      if (!down || e.pointerId !== down.id) return;
      if (!down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) down.moved = true;
      // a finger only turns it sideways: up and down is the page scrolling
      nav.dragMove(e.clientX, e.clientY, performance.now(), e.pointerType !== 'mouse');
    };
    const onUp = (e: PointerEvent) => {
      if (!down || e.pointerId !== down.id) return;
      const tap = !down.moved && e.type === 'pointerup';
      down = null;
      nav.dragEnd(performance.now());
      if (tap) enter();
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }, [nav, enter]);

  if (projects.length === 0) return null;

  const live = hasWebGL && layout && atlas;

  return (
    <section
      ref={sectionRef}
      id="sphere"
      dir={rtl ? 'rtl' : 'ltr'}
      lang={locale}
      aria-label={copy.label}
      className="relative h-svh min-h-[640px] w-full overflow-hidden bg-black text-[#f2f2f2] select-none"
    >
      {/* The globe. Dragging turns it; the page still scrolls under a finger going up or down. */}
      <div
        ref={stageRef}
        aria-hidden="true"
        className="absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing"
      >
        {/* Until the canvas is up: a ring where the globe will be, so nothing jumps when it arrives. */}
        <div
          className={
            'absolute top-1/2 left-1/2 size-[min(64svh,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.07),rgba(0,0,0,0)_62%)] transition-opacity duration-1000 ' +
            (ready ? 'opacity-0' : 'opacity-100')
          }
        />
        {live && (
          <div className={'absolute inset-0 transition-opacity duration-1000 ' + (ready ? 'opacity-100' : 'opacity-0')}>
            <GlobeCanvas
              active={onScreen}
              nav={nav}
              slots={layout.slots}
              atlas={atlas}
              rtl={rtl}
              fadeRef={fadeRef}
              onReady={() => setReady(true)}
            />
          </div>
        )}
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_95%_at_50%_50%,transparent_55%,rgba(0,0,0,0.6)_85%,rgba(0,0,0,0.95)_100%)]"
      />

      <div
        className={
          'pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center px-6 pt-28 text-center transition-all duration-700 ease-out md:pt-24 ' +
          (entering ? '-translate-y-3 opacity-0 blur-sm' : '')
        }
      >
        <span className="font-(family-name:--font-jetbrains) text-[11px] leading-[1.4] tracking-[0.28em] text-white/60 uppercase rtl:font-(family-name:--font-lalezar) rtl:text-sm rtl:tracking-normal rtl:normal-case">
          {copy.kicker}
        </span>
        <h2 className="mt-3 font-(family-name:--font-bricolage) text-[clamp(32px,5.2vw,64px)] leading-none font-extrabold tracking-[-0.02em] text-balance rtl:font-(family-name:--font-lalezar) rtl:font-normal rtl:tracking-normal">
          {copy.title}
        </h2>
      </div>

      <div
        className={
          'pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 px-6 pb-10 transition-all duration-700 ease-out md:pb-12 ' +
          (entering ? 'translate-y-3 opacity-0 blur-sm' : '')
        }
      >
        <Link
          href={href}
          onClick={onCta}
          className="group pointer-events-auto inline-flex items-center gap-3 rounded-full bg-[#f2f2f2] px-7 py-3.5 font-(family-name:--font-jetbrains) text-xs font-bold tracking-[0.18em] text-[#050505] uppercase transition-transform duration-300 ease-out hover:scale-[1.04] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white active:scale-[0.98] rtl:font-(family-name:--font-lalezar) rtl:text-base rtl:font-normal rtl:tracking-normal rtl:normal-case"
        >
          {copy.cta}
          <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" aria-hidden="true" />
        </Link>
        <span className="font-(family-name:--font-jetbrains) text-[10px] tracking-[0.24em] text-white/45 uppercase rtl:font-(family-name:--font-lalezar) rtl:text-xs rtl:tracking-normal rtl:normal-case">
          {copy.hint}
        </span>
      </div>

      {/* The dive ends in black, and the projects page opens out of it. It covers the whole screen,
          navbar included, so it is fixed to the viewport rather than to the section. */}
      <div
        ref={fadeRef}
        aria-hidden="true"
        className={'pointer-events-none fixed inset-0 z-60 bg-black opacity-0 ' + (entering ? 'pointer-events-auto' : '')}
      />
    </section>
  );
}
