/** Small input cleaners for server actions. They never throw: bad input becomes an empty value. */

/** Trimmed string, cut to `max` characters. */
export function cleanText(value: FormDataEntryValue | null | undefined, max = 500): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/** An http(s) URL or a site-relative path (like /videos/hero-1.mp4). Anything else becomes null. */
export function cleanUrl(value: FormDataEntryValue | string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const url = value.trim().slice(0, 2000);
  if (!url) return null;
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

/** A JSON array of URLs (the gallery). Invalid JSON or non-URL entries are dropped. */
export function cleanUrlList(value: FormDataEntryValue | null | undefined, maxItems = 50): string[] {
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((u) => cleanUrl(typeof u === 'string' ? u : null)).filter((u): u is string => !!u).slice(0, maxItems);
  } catch {
    return [];
  }
}

export function cleanInt(value: FormDataEntryValue | null | undefined, fallback = 0): number {
  const n = typeof value === 'string' ? parseInt(value, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

/** URL slug from a title; empty when the title has no a-z or 0-9 characters (Persian-only titles). */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}
