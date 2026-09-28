#!/usr/bin/env node
/**
 * Snapshots the public site's content into src/data/fallback.json, the hardcoded
 * fallback the site renders when Supabase is unreachable (see src/lib/queries/public.ts).
 *
 * Usage:
 *   node --env-file=.env.local scripts/snapshot-db.mjs            # from the live DB
 *   node --env-file=.env.local scripts/snapshot-db.mjs --from-csv ./exports
 *     (a folder with projects.csv, hero_slides.csv, categories.csv exported from the
 *      Supabase table editor; images are still downloaded from Storage)
 *
 * Images in Supabase Storage are downloaded into public/fallback/<bucket>/<path> and
 * the snapshot points at those local copies, so it survives a Storage outage too.
 * The existing snapshot is only overwritten after everything succeeded.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_JSON = path.join(ROOT, 'src/data/fallback.json');
const OUT_MEDIA = path.join(ROOT, 'public/fallback');
const STORAGE_MARKER = '/storage/v1/object/public/';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (use --env-file=.env.local).');
  process.exit(1);
}

const byOrder = (a, b) => a.order - b.order;

/* ---------- Sources ---------- */

async function fromDb() {
  const get = async (table, filter) => {
    const res = await fetch(`${url}/rest/v1/${table}?select=*&${filter}&order=order.asc`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`${table}: ${res.status} ${body?.message ?? res.statusText}`);
    return body;
  };

  const [projects, heroSlides, categories] = await Promise.all([
    get('projects', 'published=eq.true'),
    get('hero_slides', 'active=eq.true'),
    get('categories', 'visible=eq.true'),
  ]);
  return { projects, heroSlides, categories };
}

/** Minimal RFC 4180 parser: quoted fields, escaped quotes, newlines inside quotes. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }

  const [header, ...data] = rows.filter((r) => r.some((v) => v !== ''));
  return data.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

const toBool = (v) => v === true || v === 'true' || v === 't';
const toNull = (v) => (v === '' || v === 'NULL' ? null : v);
const toArray = (v) => {
  if (!v) return [];
  if (v.startsWith('[')) return JSON.parse(v);
  if (v.startsWith('{')) return v.slice(1, -1).split(',').filter(Boolean).map((s) => s.replace(/^"|"$/g, ''));
  return [v];
};

async function fromCsv(dir) {
  const read = async (name) => parseCsv(await readFile(path.join(dir, `${name}.csv`), 'utf8'));
  const nullable = (r, fields) => fields.forEach((f) => (r[f] = toNull(r[f])));

  const projects = (await read('projects'))
    .map((r) => {
      nullable(r, ['youtube_url', 'image_url', 'description_en', 'description_fa', 'category_id']);
      nullable(r, Object.keys(r).filter((k) => k.startsWith('support_') && k !== 'support_enabled'));
      const toInt = (v) => (v == null ? null : Number(v));
      return {
        ...r,
        published: toBool(r.published),
        order: Number(r.order),
        gallery_urls: toArray(r.gallery_urls),
        support_enabled: toBool(r.support_enabled),
        support_episodes_done: toInt(r.support_episodes_done),
        support_episodes_total: toInt(r.support_episodes_total),
      };
    })
    .filter((r) => r.published)
    .sort(byOrder);

  const heroSlides = (await read('hero_slides'))
    .map((r) => {
      nullable(r, ['title_en', 'title_fa', 'subtitle_en', 'subtitle_fa', 'image_url', 'youtube_url']);
      return { ...r, active: toBool(r.active), order: Number(r.order) };
    })
    .filter((r) => r.active)
    .sort(byOrder);

  const categories = (await read('categories'))
    .map((r) => ({ ...r, visible: toBool(r.visible), order: Number(r.order) }))
    .filter((r) => r.visible)
    .sort(byOrder);

  return { projects, heroSlides, categories };
}

/* ---------- Media ---------- */

const downloaded = new Map();

async function localize(src) {
  if (!src || !src.includes(STORAGE_MARKER)) return src;
  if (downloaded.has(src)) return downloaded.get(src);

  const rel = decodeURIComponent(src.split(STORAGE_MARKER)[1].split('?')[0]);
  const res = await fetch(src).catch(() => null);
  if (!res?.ok) {
    // Storage may be down with the DB; keep the remote URL rather than losing the row
    console.warn(`  ! could not download ${src} (${res?.status ?? 'network error'}), keeping remote URL`);
    downloaded.set(src, src);
    return src;
  }

  const file = path.join(OUT_MEDIA, rel);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(await res.arrayBuffer()));

  const local = `/fallback/${rel.split(path.sep).join('/')}`;
  downloaded.set(src, local);
  console.log(`  ${local}`);
  return local;
}

/* ---------- Main ---------- */

const csvIndex = process.argv.indexOf('--from-csv');
let data;
try {
  data = csvIndex > -1 ? await fromCsv(path.resolve(process.argv[csvIndex + 1])) : await fromDb();
} catch (e) {
  console.error(`Could not read the source data: ${e.message}`);
  console.error('The existing snapshot was left untouched.');
  process.exitCode = 1;
}

if (data) {
  console.log('Downloading media...');
  for (const p of data.projects) {
    p.image_url = await localize(p.image_url);
    p.gallery_urls = await Promise.all((p.gallery_urls ?? []).map(localize));
  }
  for (const s of data.heroSlides) {
    s.image_url = await localize(s.image_url);
  }

  const snapshot = { takenAt: new Date().toISOString(), ...data };
  await writeFile(OUT_JSON, JSON.stringify(snapshot, null, 2) + '\n');

  console.log(
    `Saved ${data.projects.length} projects, ${data.heroSlides.length} hero slides, ` +
      `${data.categories.length} categories, ${downloaded.size} files to ${path.relative(ROOT, OUT_JSON)}.`,
  );
}
