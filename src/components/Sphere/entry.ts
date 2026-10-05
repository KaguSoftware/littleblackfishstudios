import { wrap } from './layout';
import type { SavedView } from './navigator';

/**
 * Hand-off from the globe on the home page to the sphere on the projects page: which way you are
 * facing when you arrive. It lives in sessionStorage because the two are different pages.
 */
const KEY = 'sphere:enter';
const MAX_AGE_MS = 20_000; // a stale one (a tab restored long after) must not steer a later visit

/**
 * `globe` is the globe's own orientation (the side of it that was facing you). You dive in
 * through that side, so inside you are looking the opposite way: the far wall. A little of the
 * downward tilt is kept, so you land looking roughly level.
 */
export function writeEntry(globe: SavedView) {
  const view: SavedView = { yaw: wrap(globe.yaw + Math.PI), pitch: -globe.pitch * 0.4 };
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...view, at: Date.now() }));
  } catch {
    /* storage unavailable: you land on the usual opening view */
  }
}

/** Read without consuming (React may render twice); `clearEntry` once the page has used it. */
export function peekEntry(): SavedView | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
    if (v && [v.yaw, v.pitch, v.at].every((n) => typeof n === 'number' && Number.isFinite(n)) && Date.now() - v.at < MAX_AGE_MS) {
      return { yaw: v.yaw, pitch: v.pitch };
    }
  } catch {
    /* no storage, or junk in it */
  }
  return null;
}

export function clearEntry() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}
