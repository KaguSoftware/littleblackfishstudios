import { cache } from 'react';
import { createAnonClient } from '@/lib/supabase/server';
import type { Project, HeroSlide, Category } from '@/lib/types';
import snapshot from '@/data/fallback.json';

/**
 * Read-only queries for the public site, each backed by a hardcoded snapshot.
 *
 * When Supabase errors or times out (outage, quota restriction), the same filter is
 * applied to src/data/fallback.json instead, so pages keep rendering. Refresh the
 * snapshot with `node --env-file=.env.local scripts/snapshot-db.mjs`.
 */

const fallback = snapshot as unknown as {
  takenAt: string | null;
  projects: Project[];
  heroSlides: HeroSlide[];
  categories: Category[];
};

const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;

const snapshotProjects = () => fallback.projects.filter((p) => p.published).sort(byOrder);
const snapshotSlides = () => fallback.heroSlides.filter((s) => s.active).sort(byOrder);
const snapshotCategories = () => fallback.categories.filter((c) => c.visible).sort(byOrder);

type QueryResult = PromiseLike<{ data: unknown; error: { message: string } | null }>;

async function withFallback<T>(label: string, query: QueryResult, fallbackRows: () => T[]): Promise<T[]> {
  try {
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as T[];
  } catch (e) {
    console.warn(`[fallback] ${label}: ${e instanceof Error ? e.message : (e as { message?: string })?.message}`);
    return fallbackRows();
  }
}

export const getHomeData = cache(async () => {
  const supabase = createAnonClient();

  // Hero slides are served from the snapshot (videos live in public/videos), not the DB,
  // to save DB and storage usage.
  const slides: HeroSlide[] = snapshotSlides();

  const [projects, categories] = await Promise.all([
    withFallback<Project>(
      'projects',
      supabase.from('projects').select('*').eq('published', true).order('order', { ascending: true }),
      snapshotProjects,
    ),
    withFallback<Category>(
      'categories',
      supabase.from('categories').select('*').eq('visible', true).order('order', { ascending: true }),
      snapshotCategories,
    ),
  ]);

  return { slides, projects, categories };
});

export const getCategoryBySlug = cache(async (slug: string): Promise<Category | null> => {
  const rows = await withFallback<Category>(
    `category ${slug}`,
    createAnonClient().from('categories').select('*').eq('slug', slug).eq('visible', true).limit(1),
    () => snapshotCategories().filter((c) => c.slug === slug),
  );
  return rows[0] ?? null;
});

export async function getProjectsByCategory(categoryId: string): Promise<Project[]> {
  return withFallback<Project>(
    `projects in ${categoryId}`,
    createAnonClient()
      .from('projects')
      .select('*')
      .eq('published', true)
      .eq('category_id', categoryId)
      .order('order', { ascending: true }),
    () => snapshotProjects().filter((p) => p.category_id === categoryId),
  );
}

// React `cache()` dedupes calls within a single render pass: `generateMetadata`
// and the page component both call this with the same slug.
export const getProjectBySlug = cache(async (slug: string): Promise<Project | null> => {
  const rows = await withFallback<Project>(
    `project ${slug}`,
    createAnonClient().from('projects').select('*').eq('slug', slug).eq('published', true).limit(1),
    () => snapshotProjects().filter((p) => p.slug === slug),
  );
  return rows[0] ?? null;
});

export type ProjectNavRow = Pick<Project, 'id' | 'slug' | 'title_en' | 'title_fa'>;

export async function getProjectNav(): Promise<ProjectNavRow[]> {
  return withFallback<ProjectNavRow>(
    'project nav',
    createAnonClient()
      .from('projects')
      .select('id, slug, title_en, title_fa')
      .eq('published', true)
      .order('order', { ascending: true }),
    snapshotProjects,
  );
}

/** Published projects that opted into the /support page switcher. */
export async function getSupportProjects(): Promise<Project[]> {
  return withFallback<Project>(
    'support projects',
    createAnonClient()
      .from('projects')
      .select('*')
      .eq('published', true)
      .eq('support_enabled', true)
      .order('order', { ascending: true }),
    () => snapshotProjects().filter((p) => p.support_enabled),
  );
}

export async function getSitemapData() {
  const supabase = createAnonClient();

  const [projects, categories] = await Promise.all([
    withFallback<Pick<Project, 'slug' | 'updated_at'>>(
      'sitemap projects',
      supabase.from('projects').select('slug, updated_at').eq('published', true).order('order', { ascending: true }),
      snapshotProjects,
    ),
    withFallback<Pick<Category, 'slug' | 'updated_at'>>(
      'sitemap categories',
      supabase.from('categories').select('slug, updated_at').eq('visible', true).order('order', { ascending: true }),
      snapshotCategories,
    ),
  ]);

  return { projects, categories };
}
