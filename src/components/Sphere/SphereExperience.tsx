'use client';

import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { Component, useSyncExternalStore } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { SPHERE_COPY } from './copy';
import { detectWebGL } from './webgl';
import type { SphereCategory, SphereLocale, SphereProject } from './types';

/**
 * Black, full viewport, one thin grey ring and its caption: nothing flashes while the engine chunk
 * downloads. Ring, spacing and type mirror `.sp-loader` in sphere.css, so when the engine mounts
 * its own loader takes over without anything moving.
 */
function SphereLoading() {
  // `loading` gets no props, so the language comes from the route.
  const { locale } = useParams<{ locale?: string }>();
  const copy = SPHERE_COPY[locale === 'fa' ? 'fa' : 'en'];

  return (
    <div
      role="status"
      className="grid h-dvh min-h-105 w-full place-content-center justify-items-center gap-4.5 bg-black max-md:pt-24"
    >
      <span
        aria-hidden="true"
        className="size-11 animate-spin rounded-full border-[1.5px] border-white/14 border-t-[#f2f2f2] motion-reduce:animate-none"
      />
      <span className="font-(family-name:--font-jetbrains) text-[11px] leading-[1.4] tracking-[0.28em] text-white/60 uppercase rtl:font-[ui-sans-serif,Tahoma,sans-serif] rtl:text-xs rtl:leading-[1.6] rtl:tracking-normal rtl:normal-case">
        {copy.loader}
      </span>
    </div>
  );
}

// The engine is WebGL-only, so it never renders on the server.
const SpherePortfolio = dynamic(() => import('./SpherePortfolio'), {
  ssr: false,
  loading: () => <SphereLoading />,
});

// Nothing ever changes, so there is nothing to subscribe to. The server and the hydration
// render both assume support; if the browser has none, React re-renders right after hydrating.
const subscribe = () => () => {};
const getServerSnapshot = () => true;

interface ErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

/** Swaps the engine for the plain list when it crashes or its chunk fails to load. */
class SphereErrorBoundary extends Component<ErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[sphere] The 3D view failed, showing the plain project list.', error, info.componentStack);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

interface SphereExperienceProps {
  projects: SphereProject[];
  categories: SphereCategory[];
  locale: SphereLocale;
  /** Server-rendered readable version of the page, shown when the sphere can't run. */
  fallback: ReactNode;
}

export default function SphereExperience({
  projects,
  categories,
  locale,
  fallback,
}: SphereExperienceProps) {
  const hasWebGL = useSyncExternalStore(subscribe, detectWebGL, getServerSnapshot);

  if (!hasWebGL) return <>{fallback}</>;

  return (
    <SphereErrorBoundary fallback={fallback}>
      <SpherePortfolio projects={projects} categories={categories} locale={locale} />
    </SphereErrorBoundary>
  );
}
