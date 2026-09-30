import { getSitemapData } from '@/lib/queries/public';
import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://littleblackfishstudios.com';
const LOCALES = ['en', 'fa'] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { projects, categories } = await getSitemapData();

  const staticRoutes: MetadataRoute.Sitemap = LOCALES.flatMap((locale) => [
    { url: `${BASE_URL}/${locale}`, lastModified: new Date() },
    { url: `${BASE_URL}/${locale}/projects`, lastModified: new Date() },
    { url: `${BASE_URL}/${locale}/about`, lastModified: new Date() },
    { url: `${BASE_URL}/${locale}/contact`, lastModified: new Date() },
    { url: `${BASE_URL}/${locale}/support`, lastModified: new Date() },
  ]);

  const projectRoutes: MetadataRoute.Sitemap = projects.flatMap((p) =>
    LOCALES.map((locale) => ({
      url: `${BASE_URL}/${locale}/projects/${p.slug}`,
      lastModified: new Date(p.updated_at),
    }))
  );

  const categoryRoutes: MetadataRoute.Sitemap = categories.flatMap((c) =>
    LOCALES.map((locale) => ({
      url: `${BASE_URL}/${locale}/category/${c.slug}`,
      lastModified: new Date(c.updated_at),
    }))
  );

  return [...staticRoutes, ...projectRoutes, ...categoryRoutes];
}
