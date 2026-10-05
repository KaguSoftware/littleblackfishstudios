import { notFound } from 'next/navigation';
import BackButton from '@/components/BackButton';
import type { Metadata } from 'next';
import { getCategoryBySlug, getProjectsByCategory } from '@/lib/queries/public';
import ProjectGrid from '@/components/ProjectGrid/ProjectGrid';
import {
  serializeCategory,
  serializeProject,
} from '@/lib/serializers';

export const revalidate = 3600;

interface Props {
  params: Promise<{ slug: string; locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale } = await params;
  const isRtl = locale === 'fa';
  const row = await getCategoryBySlug(slug);
  if (!row) return {};

  const name = isRtl ? row.name_fa : row.name_en;
  return {
    title: `${name} | Little Black Fish Studios`,
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug, locale } = await params;
  if (!['en', 'fa'].includes(locale)) notFound();
  const isRtl = locale === 'fa';

  const categoryRow = await getCategoryBySlug(slug);
  if (!categoryRow) notFound();

  const category = serializeCategory(categoryRow);
  const projects = (await getProjectsByCategory(category.id)).map(serializeProject);

  const name = isRtl ? category.nameFa : category.nameEn;

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-20 md:py-28 sm:px-6 lg:px-8">
        <BackButton
          locale={locale}
          isRtl={isRtl}
          label={isRtl ? 'بازگشت به پروژه‌ها' : 'Back to Projects'}
          fallbackHref={`/${locale}/projects`}
        />

        <header className="mb-12">
          <div className="mb-3 flex items-center gap-4">
            <div className="h-px flex-1 bg-zinc-800" />
            <span className="text-xs font-bold tracking-[0.2em] text-blue-500 uppercase">
              {isRtl ? 'دسته‌بندی' : 'Category'}
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight">
            {name}
          </h1>
          <div className="mt-4 h-1 w-20 bg-blue-600/80" />
        </header>

        {projects.length > 0 ? (
          <ProjectGrid projects={projects} locale={locale} />
        ) : (
          <div className="text-center py-20 border border-dashed border-zinc-800 rounded-2xl">
            <p className="text-zinc-500 font-light italic">
              {isRtl
                ? 'هنوز پروژه‌ای در این دسته‌بندی منتشر نشده است.'
                : 'No projects published in this category yet.'}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
