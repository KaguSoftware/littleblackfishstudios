import { buildSlots, type Layout } from './layout';
import { buildLabelAtlas, type Atlas } from './labelAtlas';
import type { SphereProject } from './types';

/**
 * Things the home page's globe and the projects page both need, built once per session.
 *
 * The layout is a few thousand swaps of simulated annealing, the label atlas is a 4096px canvas of
 * text, and both come out the same for the same projects. Both pages are client components in the
 * same JS bundle, so a module-level cache survives the client-side navigation between them. Only the
 * latest entry is kept (a different language or edited projects means a different key), so it
 * can't grow.
 */

/** Everything the layout and the captions depend on. */
function keyOf(projects: SphereProject[], rtl: boolean) {
  return (rtl ? 'fa' : 'en') + '\u0002' + projects.map((p) => [p.id, p.title, p.category, p.scene, p.image].join('\u0001')).join('\u0002');
}

let layoutEntry: { key: string; layout: Layout } | null = null;

export function getLayout(projects: SphereProject[], rtl: boolean): Layout {
  const key = keyOf(projects, rtl);
  if (layoutEntry?.key === key) return layoutEntry.layout;
  const layout = buildSlots(projects);
  layoutEntry = { key, layout };
  return layout;
}

let atlasEntry: { key: string; promise: Promise<Atlas>; value?: Atlas } | null = null;

/** The atlas if it has already been built (by the home page's globe), so the first render can use it. */
export function peekAtlas(projects: SphereProject[], rtl: boolean): Atlas | null {
  const key = keyOf(projects, rtl);
  return atlasEntry?.key === key ? (atlasEntry.value ?? null) : null;
}

/** `root` only supplies the font variables, so the two pages can pass different elements. */
export function getAtlas(projects: SphereProject[], root: HTMLElement, rtl: boolean): Promise<Atlas> {
  const key = keyOf(projects, rtl);
  if (atlasEntry?.key === key) return atlasEntry.promise;
  const promise = buildLabelAtlas(projects, root, rtl);
  const entry: NonNullable<typeof atlasEntry> = { key, promise };
  atlasEntry = entry;
  promise.then((a) => {
    entry.value = a;
  }, () => {});
  // A failed build must not be served again.
  promise.catch(() => {
    if (atlasEntry === entry) atlasEntry = null;
  });
  return promise;
}
