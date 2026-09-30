'use client';

import Link from 'next/link';
import type { SphereCopy, SphereProject } from './types';

interface PanelProps {
  /** The parent keeps passing the last project while the panel closes, so the exit animation keeps its content. */
  project: SphereProject | null;
  /** 0-based position of the project in the list. */
  index: number;
  total: number;
  open: boolean;
  rtl: boolean;
  copy: SphereCopy;
  onClose(): void;
  /** Previous project in list order. */
  onPrev(): void;
  onNext(): void;
}

const ICON_PATHS = {
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  close: 'M6 6l12 12M18 6L6 18',
  upRight: 'M7 17L17 7M8 7h9v9',
  upLeft: 'M17 17L7 7M16 7H7v9',
} as const;

function Icon({ name }: { name: keyof typeof ICON_PATHS }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

/** "03" in Latin digits, or "۰۳" for Persian. */
function pad2(n: number, rtl: boolean): string {
  return rtl
    ? n.toLocaleString('fa-IR', { minimumIntegerDigits: 2, useGrouping: false })
    : String(n).padStart(2, '0');
}

export default function Panel({
  project,
  index,
  total,
  open,
  rtl,
  copy,
  onClose,
  onPrev,
  onNext,
}: PanelProps) {
  // Out of the tab order while closed, so keyboard focus never lands in an invisible panel.
  const tab = open ? 0 : -1;
  const kind =
    project?.kind === 'video'
      ? copy.kindVideo
      : project?.kind === 'gallery'
        ? copy.kindGallery
        : copy.kindImage;

  return (
    <aside className={'sp-panel' + (open ? ' is-open' : '')} aria-hidden={!open} data-ui>
      {project && (
        <>
          <div className="sp-panel__top">
            <span className="sp-panel__idx">
              {pad2(index + 1, rtl)} / {pad2(total, rtl)}
            </span>
            <div className="sp-panel__nav">
              {/* the chevrons point in reading direction, so they swap in RTL */}
              <button type="button" className="sp-icon" aria-label={copy.prev} onClick={onPrev} tabIndex={tab}>
                <Icon name={rtl ? 'right' : 'left'} />
              </button>
              <button type="button" className="sp-icon" aria-label={copy.next} onClick={onNext} tabIndex={tab}>
                <Icon name={rtl ? 'left' : 'right'} />
              </button>
              <button type="button" className="sp-icon" aria-label={copy.close} onClick={onClose} tabIndex={tab}>
                <Icon name="close" />
              </button>
            </div>
          </div>

          <h2 className="sp-panel__title">{project.title}</h2>

          <div className="sp-panel__meta">
            {project.category ? (
              <>
                <span>{project.category}</span>
                <i aria-hidden="true" />
              </>
            ) : null}
            <span>{kind}</span>
          </div>

          {project.blurb ? <p className="sp-panel__blurb">{project.blurb}</p> : null}

          <Link className="sp-cta" href={project.href} tabIndex={tab}>
            {copy.openProject}
            <Icon name={rtl ? 'upLeft' : 'upRight'} />
          </Link>
        </>
      )}
    </aside>
  );
}
