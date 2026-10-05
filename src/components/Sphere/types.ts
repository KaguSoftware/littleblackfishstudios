export type SphereLocale = 'en' | 'fa';

/** One project as the sphere sees it: already localized, already cleaned. */
export interface SphereProject {
  id: string;
  slug: string;
  title: string;
  /** Localized category name, '' when the project has none. */
  category: string;
  /** Category id, or UNCATEGORIZED_ID. */
  categoryId: string;
  kind: 'video' | 'gallery' | 'image';
  /** Plain text, may contain "\n" (rendered with white-space: pre-line). '' when there is none. */
  blurb: string;
  /** Project page, e.g. "/en/projects/gilgamesh". */
  href: string;
  /** Raw poster URL (YouTube thumbnail or Supabase image). The engine routes it through /_next/image. */
  image: string | null;
  /** The project's other uploaded photos, tried in turn if the poster fails to load. */
  galleryImages: string[];
  /** Optional short looping clip. Plays instead of the poster when present. */
  video: string | null;
  /** Procedural fallback animation, 0-9, shown until the poster loads. */
  scene: number;
  /** [dark, mid, bright] colours of the animated screen. */
  palette: [string, string, string];
}

export interface SphereCategory {
  id: string;
  label: string;
}

export const UNCATEGORIZED_ID = '__uncategorized__';
export const ALL_ID = 'all';

/** Everything the sphere writes on screen, per locale. */
export interface SphereCopy {
  kicker: string;
  title: string;
  all: string;
  filterLabel: string;
  stageLabel: string;
  /** [bold lead, rest] pairs for the mouse hint. */
  hintFine: [string, string][];
  /** [bold lead, rest] pairs for the touch hint. */
  hintTouch: [string, string][];
  /** Caption under the ghost finger on phones. */
  dragHint: string;
  /** Cursor label over a screen. */
  open: string;
  /** Cursor label over the screen that is already opened. */
  view: string;
  /** Cursor label over empty space while a screen is opened. */
  back: string;
  openProject: string;
  close: string;
  prev: string;
  next: string;
  map: string;
  mapLabel: string;
  loader: string;
  allProjects: string;
  kindVideo: string;
  kindGallery: string;
  kindImage: string;
  inView: string;
}

/** The slice of the camera the drag-hint animation needs. Coordinates are stage-local pixels. */
export interface DragDriver {
  dragStart(x: number, y: number, t: number): void;
  dragMove(x: number, y: number, t: number, viewH: number): void;
  dragEnd(t: number): void;
}
