import type { SerializedCategory, SerializedProject } from '@/lib/types';
import { getYouTubeMaxResThumbnail } from '@/lib/youtube';
import {
  UNCATEGORIZED_ID,
  type SphereCategory,
  type SphereLocale,
  type SphereProject,
} from '@/components/Sphere/types';

/** The sphere keeps one texture per project, so it only ever shows this many. */
export const MAX_SPHERE_PROJECTS = 50;

const BLURB_MAX_LENGTH = 240;

const OTHER_LABEL: Record<SphereLocale, string> = { en: 'Other', fa: 'سایر' };

/** [dark, mid, bright], greys only. Rotated by project index so neighbouring screens differ. */
const PALETTES: SphereProject['palette'][] = [
  ['#0a0a0a', '#6b6b6b', '#f2f2f2'],
  ['#0d0d0d', '#8a8a8a', '#ffffff'],
  ['#050505', '#555555', '#d9d9d9'],
  ['#111111', '#9a9a9a', '#f7f7f7'],
  ['#080808', '#767676', '#ebebeb'],
  ['#0b0b0b', '#5e5e5e', '#cfcfcf'],
];

/** The page-language text, or the other language when that one is blank. */
function pickText(preferred: string | null, other: string | null): string {
  return preferred?.trim() || other?.trim() || '';
}

/** Title in the page language, falling back to the other language when it is empty. */
export function localizedTitle(
  project: Pick<SerializedProject, 'titleEn' | 'titleFa'>,
  locale: SphereLocale,
): string {
  return locale === 'fa'
    ? pickText(project.titleFa, project.titleEn)
    : pickText(project.titleEn, project.titleFa);
}

function localizedCategoryName(category: SerializedCategory, locale: SphereLocale): string {
  return locale === 'fa'
    ? pickText(category.nameFa, category.nameEn)
    : pickText(category.nameEn, category.nameFa);
}

/**
 * Plain-text teaser from a description: links removed, one trimmed line per row, cut on a word
 * boundary near BLURB_MAX_LENGTH. The project page has no cross-language fallback, so neither do we.
 */
export function toBlurb(description: string | null): string {
  if (!description) return '';

  const text = description
    .replace(/https?:\/\/\S+/g, '')
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
  if (text.length <= BLURB_MAX_LENGTH) return text;

  // Drop everything from the last whitespace before the limit (a single unbroken word is cut as is).
  return `${text.slice(0, BLURB_MAX_LENGTH).replace(/\s+\S*$/, '')}…`;
}

function toKind(project: SerializedProject): SphereProject['kind'] {
  if (project.mediaType === 'youtube' || project.youtubeUrl) return 'video';
  if (project.mediaType === 'gallery') return 'gallery';
  return 'image';
}

/**
 * Turns the site's projects into what the sphere renders: localized, cleaned up, capped at
 * MAX_SPHERE_PROJECTS, with only the categories that still have a screen on the sphere.
 * Input order (already sorted by `order`) is kept.
 */
export function buildSphereData(
  projects: SerializedProject[],
  categories: SerializedCategory[],
  locale: SphereLocale,
): { projects: SphereProject[]; categories: SphereCategory[] } {
  const categoryLabels = new Map(
    categories.map((category) => [category.id, localizedCategoryName(category, locale)]),
  );

  const sphereProjects = projects
    .slice(0, MAX_SPHERE_PROJECTS)
    .map((project, index): SphereProject => {
      // A category that isn't in the list (hidden, deleted) counts as no category at all.
      const categoryLabel =
        project.categoryId === null ? undefined : categoryLabels.get(project.categoryId);

      return {
        id: project.id,
        slug: project.slug,
        title: localizedTitle(project, locale),
        category: categoryLabel ?? '',
        categoryId:
          project.categoryId !== null && categoryLabel !== undefined
            ? project.categoryId
            : UNCATEGORIZED_ID,
        kind: toKind(project),
        blurb: toBlurb(locale === 'fa' ? project.descriptionFa : project.descriptionEn),
        href: `/${locale}/projects/${project.slug}`,
        image: getYouTubeMaxResThumbnail(project.youtubeUrl) || project.imageUrl || null,
        video: null,
        scene: index % 10,
        palette: [...PALETTES[index % PALETTES.length]],
      };
    });

  const usedCategoryIds = new Set(sphereProjects.map((project) => project.categoryId));

  const sphereCategories: SphereCategory[] = categories
    .filter((category) => usedCategoryIds.has(category.id))
    .map((category) => ({ id: category.id, label: categoryLabels.get(category.id) ?? '' }));

  if (usedCategoryIds.has(UNCATEGORIZED_ID)) {
    sphereCategories.push({ id: UNCATEGORIZED_ID, label: OTHER_LABEL[locale] });
  }

  return { projects: sphereProjects, categories: sphereCategories };
}
