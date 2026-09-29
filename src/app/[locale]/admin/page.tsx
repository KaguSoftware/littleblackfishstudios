import { createServiceClient, requireAdminUser } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import AdminDashboard from '@/components/Admin/AdminDashboard';
import { ToastProvider } from '@/components/Admin/Toast';
import {
  serializeProject,
  serializeHeroSlide,
  serializeCategory,
  serializeContactSubmission,
} from '@/lib/serializers';

interface AdminPageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminPage({ params }: AdminPageProps) {
  const { locale } = await params;

  if (!['en', 'fa'].includes(locale)) {
    notFound();
  }

  // Defense-in-depth: middleware should already gate this, but never trust a single layer.
  try {
    await requireAdminUser();
  } catch {
    redirect(`/${locale}/login`);
  }

  const supabase = createServiceClient();

  const [
    { data: projectRows },
    { data: slideRows },
    { data: categoryRows },
    { data: submissionRows },
  ] = await Promise.all([
    supabase.from('projects').select('*').order('order', { ascending: true }),
    supabase.from('hero_slides').select('*').order('order', { ascending: true }),
    supabase.from('categories').select('*').order('order', { ascending: true }),
    supabase
      .from('contact_submissions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  const projects = (projectRows ?? []).map(serializeProject);
  const heroSlides = (slideRows ?? []).map(serializeHeroSlide);
  const categories = (categoryRows ?? []).map(serializeCategory);
  const submissions = (submissionRows ?? []).map(serializeContactSubmission);

  return (
    <div className="min-h-screen bg-linear-to-b from-black via-zinc-950 to-black text-white">
      <ToastProvider>
        <AdminDashboard
          initialProjects={projects}
          initialHeroSlides={heroSlides}
          initialCategories={categories}
          initialSubmissions={submissions}
          locale={locale}
        />
      </ToastProvider>
    </div>
  );
}
