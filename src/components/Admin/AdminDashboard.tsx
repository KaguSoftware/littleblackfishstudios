'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import type { SortableItem } from './SortableList';

const SortableList = dynamic(() => import('./SortableList'), {
  ssr: false,
  loading: () => (
    <div className="animate-pulse space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-16 rounded-xl bg-zinc-800/50" />
      ))}
    </div>
  ),
});
import ProjectForm from './ProjectForm';
import HeroForm from './HeroForm';
import CategoryForm from './CategoryForm';
import { updateOrder } from '@/actions/reorder';
import { deleteHeroSlide, toggleHeroStatus } from '@/actions/hero';
import { deleteProject } from '@/actions/project';
import { toggleProjectStatus } from '@/actions/admin';
import { deleteCategory, toggleCategoryVisibility } from '@/actions/category';
import { setSubmissionRead, deleteSubmission } from '@/actions/contactSubmissions';
import { signOut } from '@/actions/auth';
import { useToast } from './Toast';
import { RichText } from '@/components/RichText';
import Image from 'next/image';
import {
  Plus,
  LayoutGrid,
  Image as ImageIcon,
  LogOut,
  Tags,
  Inbox,
  Mail,
  MailOpen,
  Phone,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import type {
  SerializedProject,
  SerializedHeroSlide,
  SerializedCategory,
  SerializedContactSubmission,
} from '@/lib/types';

type TabKey = 'projects' | 'hero' | 'categories' | 'submissions';

interface AdminDashboardProps {
  initialProjects: SerializedProject[];
  initialHeroSlides: SerializedHeroSlide[];
  initialCategories: SerializedCategory[];
  initialSubmissions: SerializedContactSubmission[];
  locale: string;
}

export default function AdminDashboard({
  initialProjects,
  initialHeroSlides,
  initialCategories,
  initialSubmissions,
  locale,
}: AdminDashboardProps) {
  const isRtl = locale === 'fa';
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>('projects');
  const [editingItem, setEditingItem] = useState<
    SerializedProject | SerializedHeroSlide | SerializedCategory | null
  >(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [projects, setProjects] = useState(initialProjects);
  const [heroSlides, setHeroSlides] = useState(initialHeroSlides);
  const [categories, setCategories] = useState(initialCategories);

  // Keep local state in sync when the server pushes fresh props (after revalidate).
  React.useEffect(() => setProjects(initialProjects), [initialProjects]);
  React.useEffect(() => setHeroSlides(initialHeroSlides), [initialHeroSlides]);
  React.useEffect(() => setCategories(initialCategories), [initialCategories]);
  React.useEffect(() => setSubmissions(initialSubmissions), [initialSubmissions]);

  const handleReorder = async (
    newItems: SortableItem[],
    type: 'project' | 'hero' | 'category',
  ) => {
    const itemsWithOrder = newItems.map((item, index) => ({
      id: item.id,
      order: index,
    }));
    return await updateOrder(itemsWithOrder, type);
  };

  const handleDeleteProject = (item: SortableItem) => {
    if (
      !confirm(
        isRtl
          ? 'آیا از حذف این پروژه مطمئن هستید؟'
          : 'Are you sure you want to delete this project?',
      )
    ) {
      return;
    }
    const previous = projects;
    setProjects((prev) => prev.filter((p) => p.id !== item.id));
    void deleteProject(item.id).then((result) => {
      if (!result.success) {
        setProjects(previous);
        toast.error(isRtl ? 'خطا در حذف پروژه' : 'Failed to delete project');
      }
    });
  };

  const handleDeleteHero = (item: SortableItem) => {
    if (!confirm(isRtl ? 'حذف اسلاید؟' : 'Delete slide?')) return;
    const previous = heroSlides;
    setHeroSlides((prev) => prev.filter((s) => s.id !== item.id));
    void deleteHeroSlide(item.id, item.image ?? '').then((result) => {
      if (result && !result.success) {
        setHeroSlides(previous);
        toast.error(isRtl ? 'خطا در حذف اسلاید' : 'Failed to delete slide');
      }
    });
  };

  const handleToggleProject = (id: string, currentStatus: boolean) => {
    const next = !currentStatus;
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, published: next } : p)));
    void toggleProjectStatus(id, currentStatus).then((result) => {
      if (!result?.success) {
        setProjects((prev) =>
          prev.map((p) => (p.id === id ? { ...p, published: currentStatus } : p)),
        );
      }
    });
  };

  const handleToggleHero = (id: string, currentStatus: boolean) => {
    const next = !currentStatus;
    setHeroSlides((prev) => prev.map((s) => (s.id === id ? { ...s, active: next } : s)));
    void toggleHeroStatus(id, currentStatus).then((result) => {
      if (result && !result.success) {
        setHeroSlides((prev) =>
          prev.map((s) => (s.id === id ? { ...s, active: currentStatus } : s)),
        );
      }
    });
  };

  const handleToggleCategory = (id: string, currentVisible: boolean) => {
    const next = !currentVisible;
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, visible: next } : c)));
    void toggleCategoryVisibility(id, currentVisible).then((result) => {
      if (result && !result.success) {
        setCategories((prev) =>
          prev.map((c) => (c.id === id ? { ...c, visible: currentVisible } : c)),
        );
      }
    });
  };

  const handleDeleteCategory = (item: SortableItem) => {
    if (
      !confirm(
        isRtl
          ? 'حذف دسته‌بندی؟ پروژه‌های آن بدون دسته‌بندی خواهند شد.'
          : 'Delete category? Projects in it will become uncategorized.',
      )
    ) {
      return;
    }
    const previous = categories;
    setCategories((prev) => prev.filter((c) => c.id !== item.id));
    void deleteCategory(item.id).then((result) => {
      if (result && !result.success) setCategories(previous);
    });
  };

  const addLabel = isRtl
    ? activeTab === 'categories'
      ? 'افزودن دسته‌بندی'
      : activeTab === 'hero'
        ? 'افزودن اسلاید'
        : 'افزودن پروژه'
    : activeTab === 'categories'
      ? 'Add Category'
      : activeTab === 'hero'
        ? 'Add Slide'
        : 'Add Project';

  const unreadCount = submissions.filter((s) => !s.read).length;

  const tabs: { key: TabKey; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      key: 'projects',
      label: isRtl ? 'پروژه‌ها' : 'Projects',
      icon: <LayoutGrid size={16} />,
    },
    {
      key: 'hero',
      label: isRtl ? 'هیرو' : 'Hero',
      icon: <ImageIcon size={16} />,
    },
    {
      key: 'categories',
      label: isRtl ? 'دسته‌بندی‌ها' : 'Categories',
      icon: <Tags size={16} />,
    },
    {
      key: 'submissions',
      label: isRtl ? 'پیام‌ها' : 'Submissions',
      icon: <Inbox size={16} />,
      badge: unreadCount,
    },
  ];

  const closeModal = () => {
    setShowAddForm(false);
    setEditingItem(null);
  };

  const renderEmptyState = () => {
    const labels: Record<TabKey, { en: string; fa: string; sub: { en: string; fa: string } }> = {
      projects: {
        en: 'No projects yet',
        fa: 'هنوز پروژه‌ای وجود ندارد',
        sub: { en: 'Add your first project to get started', fa: 'اولین پروژه خود را اضافه کنید' },
      },
      hero: {
        en: 'No hero slides yet',
        fa: 'هنوز اسلایدی وجود ندارد',
        sub: { en: 'Create a slide for the homepage hero carousel', fa: 'یک اسلاید برای صفحه اصلی بسازید' },
      },
      categories: {
        en: 'No categories yet',
        fa: 'هنوز دسته‌بندی‌ای وجود ندارد',
        sub: { en: 'Group your projects with categories', fa: 'پروژه‌ها را در دسته‌بندی‌ها گروه‌بندی کنید' },
      },
      submissions: {
        en: 'No submissions yet',
        fa: 'هنوز پیامی دریافت نشده',
        sub: { en: 'Inquiries from the contact form will appear here', fa: 'پیام‌های فرم تماس اینجا نمایش داده می‌شوند' },
      },
    };
    const icon =
      activeTab === 'projects' ? (
        <LayoutGrid size={32} />
      ) : activeTab === 'hero' ? (
        <ImageIcon size={32} />
      ) : activeTab === 'categories' ? (
        <Tags size={32} />
      ) : (
        <Inbox size={32} />
      );

    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 py-20 text-center">
        <div className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-zinc-900 text-zinc-500 ring-1 ring-zinc-800">
          {icon}
        </div>
        <p className="text-base font-bold text-zinc-300">
          {isRtl ? labels[activeTab].fa : labels[activeTab].en}
        </p>
        <p className="mt-1 mb-6 text-sm text-zinc-500">
          {isRtl ? labels[activeTab].sub.fa : labels[activeTab].sub.en}
        </p>
        {activeTab !== 'submissions' && (
          <button
            onClick={() => {
              setEditingItem(null);
              setShowAddForm(true);
            }}
            className="flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-500 hover:shadow-blue-600/30"
          >
            <Plus size={16} />
            {addLabel}
          </button>
        )}
      </div>
    );
  };

  const handleToggleSubmissionRead = (id: string, currentRead: boolean) => {
    const next = !currentRead;
    // Optimistic: flip locally first; the action runs in the background.
    setSubmissions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, read: next } : s)),
    );
    void setSubmissionRead(id, next).then((result) => {
      if (!result.success) {
        // Roll back on failure.
        setSubmissions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, read: currentRead } : s)),
        );
      }
    });
  };

  const handleDeleteSubmission = (id: string) => {
    if (!confirm(isRtl ? 'این پیام حذف شود؟' : 'Delete this submission?')) {
      return;
    }
    const previous = submissions;
    setSubmissions((prev) => prev.filter((s) => s.id !== id));
    void deleteSubmission(id).then((result) => {
      if (!result.success) {
        setSubmissions(previous);
      }
    });
  };

  const getInitials = (name: string) =>
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?';

  const avatarColors = [
    'from-blue-500 to-blue-700',
    'from-purple-500 to-purple-700',
    'from-pink-500 to-rose-700',
    'from-emerald-500 to-emerald-700',
    'from-amber-500 to-orange-700',
    'from-cyan-500 to-cyan-700',
  ];
  const avatarForId = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
    return avatarColors[Math.abs(hash) % avatarColors.length];
  };

  const renderSubmissions = () => (
    <div className="space-y-3">
      {submissions.map((s) => {
        const formattedDate = s.createdAt.toLocaleString(isRtl ? 'fa-IR' : 'en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
        });
        return (
          <div
            key={s.id}
            className={`group relative overflow-hidden rounded-2xl border p-5 transition-all ${
              s.read
                ? 'border-zinc-900 bg-zinc-950/40 hover:border-zinc-800 hover:bg-zinc-950/70'
                : 'border-blue-600/30 bg-blue-600/4 hover:border-blue-500/50'
            }`}
          >
            {!s.read && (
              <span
                aria-hidden
                className={`absolute top-0 bottom-0 w-1 bg-blue-500 ${
                  isRtl ? 'right-0' : 'left-0'
                }`}
              />
            )}
            <div className={`flex items-start gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
              {/* Avatar */}
              <div
                className={`flex size-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br ${avatarForId(
                  s.id,
                )} text-sm font-black text-white shadow-md`}
              >
                {getInitials(s.name)}
              </div>

              <div className="min-w-0 flex-1">
                <div
                  className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 ${
                    isRtl ? 'flex-row-reverse' : ''
                  }`}
                >
                  <p className="truncate text-base font-bold text-white">{s.name}</p>
                  {!s.read && (
                    <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-400">
                      {isRtl ? 'جدید' : 'New'}
                    </span>
                  )}
                  <span className="text-xs text-zinc-500">{formattedDate}</span>
                </div>
                <div
                  className={`mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs ${
                    isRtl ? 'flex-row-reverse' : ''
                  }`}
                >
                  <a
                    href={`mailto:${encodeURIComponent(s.email)}?subject=${encodeURIComponent(
                      `Re: Your project inquiry`,
                    )}&body=${encodeURIComponent(
                      `Hi ${s.name},\n\nThanks for reaching out.\n\n---\nYour message:\n${s.message}`,
                    )}`}
                    className="flex items-center gap-1.5 text-zinc-400 transition-colors hover:text-blue-400"
                    dir="ltr"
                  >
                    <Mail size={12} />
                    {s.email}
                  </a>
                  <a
                    href={`tel:${s.phone.replace(/[^\d+]/g, '')}`}
                    className="flex items-center gap-1.5 text-zinc-400 transition-colors hover:text-blue-400"
                    dir="ltr"
                  >
                    <Phone size={12} />
                    {s.phone}
                  </a>
                </div>
              </div>

              <div
                className={`flex shrink-0 items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100 ${
                  isRtl ? 'flex-row-reverse' : ''
                }`}
              >
                <button
                  onClick={() => handleToggleSubmissionRead(s.id, s.read)}
                  title={
                    s.read
                      ? isRtl
                        ? 'علامت‌گذاری به عنوان نخوانده'
                        : 'Mark unread'
                      : isRtl
                        ? 'علامت‌گذاری به عنوان خوانده‌شده'
                        : 'Mark read'
                  }
                  className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-white"
                >
                  {s.read ? <Mail size={16} /> : <MailOpen size={16} />}
                </button>
                <button
                  onClick={() => handleDeleteSubmission(s.id)}
                  title={isRtl ? 'حذف' : 'Delete'}
                  className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div
              className={`mt-4 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300 ${
                isRtl ? 'pr-15' : 'pl-15'
              }`}
              dir="auto"
            >
              <RichText text={s.message} variant="card" />
            </div>

            {!s.emailSent && (
              <div
                className={`mt-3 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-400 ${
                  isRtl ? 'mr-15 flex-row-reverse' : 'ml-15'
                }`}
              >
                <AlertTriangle size={14} />
                <span>
                  {isRtl ? 'ایمیل ارسال نشد' : 'Email delivery failed'}
                  {s.emailError ? `: ${s.emailError}` : ''}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const tabCount = (key: TabKey) => {
    switch (key) {
      case 'projects':
        return projects.length;
      case 'hero':
        return heroSlides.length;
      case 'categories':
        return categories.length;
      case 'submissions':
        return submissions.length;
    }
  };

  const activeTabLabel = tabs.find((t) => t.key === activeTab)?.label ?? '';
  const sectionSubtitle = isRtl
    ? activeTab === 'projects'
      ? 'مدیریت پروژه‌های منتشر شده'
      : activeTab === 'hero'
        ? 'اسلایدهای صفحه اصلی'
        : activeTab === 'categories'
          ? 'دسته‌بندی‌های پروژه'
          : 'پیام‌های دریافتی از فرم تماس'
    : activeTab === 'projects'
      ? 'Manage your published portfolio'
      : activeTab === 'hero'
        ? 'Homepage hero carousel slides'
        : activeTab === 'categories'
          ? 'Project categories and grouping'
          : 'Inbound messages from the contact form';

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Sidebar */}
      <aside
        className={`shrink-0 bg-zinc-950 md:sticky md:top-0 md:h-screen md:w-72 lg:w-80 ${
          isRtl ? 'border-zinc-900 md:border-l' : 'border-zinc-900 md:border-r'
        }`}
      >
        <div className="flex h-full flex-col p-6 md:p-7">
          {/* Brand */}
          <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 ring-1 ring-zinc-800">
              <Image
                src="/logo-icon-white.png"
                alt="Little Black Fish Studios"
                width={28}
                height={28}
                className="object-contain"
              />
            </div>
            <div className={isRtl ? 'text-right' : 'text-left'}>
              <h1 className="text-base font-black tracking-tight leading-tight">
                {isRtl ? 'استودیو' : 'Studio CMS'}
              </h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                {isRtl ? 'پنل مدیریت' : 'Admin Panel'}
              </p>
            </div>
          </div>

          <div className="my-6 h-px bg-zinc-900" />

          <p
            className={`mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-600 ${
              isRtl ? 'text-right' : 'text-left'
            }`}
          >
            {isRtl ? 'محتوا' : 'Content'}
          </p>

          <nav className="flex flex-row gap-1.5 overflow-x-auto md:flex-col md:gap-0.5 md:overflow-visible">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              const count = tabCount(tab.key);
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`group relative flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all md:w-full ${
                    isRtl ? 'flex-row-reverse text-right' : 'text-left'
                  } ${
                    isActive
                      ? 'bg-blue-600/10 text-white'
                      : 'text-zinc-400 hover:bg-zinc-900/70 hover:text-zinc-100'
                  }`}
                >
                  {isActive && (
                    <span
                      aria-hidden
                      className={`absolute top-1.5 bottom-1.5 w-1 rounded-full bg-blue-500 ${
                        isRtl ? 'right-0' : 'left-0'
                      }`}
                    />
                  )}
                  <span
                    className={`shrink-0 transition-colors ${
                      isActive ? 'text-blue-400' : 'text-zinc-500 group-hover:text-zinc-300'
                    }`}
                  >
                    {tab.icon}
                  </span>
                  <span className="flex-1 tracking-wide">{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 ? (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-black text-white">
                      {tab.badge}
                    </span>
                  ) : (
                    <span
                      className={`text-xs tabular-nums ${
                        isActive ? 'text-zinc-400' : 'text-zinc-600'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <form action={signOut.bind(null, locale)} className="mt-auto hidden md:block">
            <div className="mb-4 h-px bg-zinc-900" />
            <button
              type="submit"
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-zinc-500 transition-all hover:bg-zinc-900 hover:text-white ${
                isRtl ? 'flex-row-reverse text-right' : 'text-left'
              }`}
            >
              <LogOut size={16} />
              <span className="flex-1 tracking-wide">{isRtl ? 'خروج' : 'Sign Out'}</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Main column */}
      <div className="min-w-0 flex-1 p-6 md:p-10 lg:p-12">
        {/* Section header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className={isRtl ? 'text-right' : 'text-left'}>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-blue-500">
              {isRtl ? 'پنل مدیریت' : 'Dashboard'}
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">
              {activeTabLabel}
              <span className="ml-3 text-zinc-600 text-xl font-bold tabular-nums">
                {tabCount(activeTab)}
              </span>
            </h2>
            <p className="mt-1 text-sm text-zinc-500">{sectionSubtitle}</p>
          </div>

          <div className="flex items-center gap-3">
            {activeTab !== 'submissions' && (
              <button
                onClick={() => {
                  setEditingItem(null);
                  setShowAddForm(true);
                }}
                className="flex items-center justify-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-500 hover:shadow-blue-600/30 active:scale-[0.98]"
              >
                <Plus size={18} />
                {addLabel}
              </button>
            )}
            <form action={signOut.bind(null, locale)} className="md:hidden">
              <button
                type="submit"
                className="flex items-center gap-2 rounded-full border border-zinc-800 px-4 py-2.5 text-sm font-bold text-zinc-400 transition-all hover:border-zinc-600 hover:text-white"
              >
                <LogOut size={14} />
                {isRtl ? 'خروج' : 'Sign Out'}
              </button>
            </form>
          </div>
        </div>


      {/* Main Content Area */}
      <div className="min-h-100">
        {activeTab === 'projects' &&
          (projects.length === 0 ? (
            renderEmptyState()
          ) : (
            <SortableList
              items={projects.map((p) => ({
                id: p.id,
                title: isRtl ? p.titleFa : p.titleEn,
                image: p.imageUrl,
                youtubeUrl: p.youtubeUrl,
                active: p.published,
              }))}
              onReorder={(items) => handleReorder(items, 'project')}
              isRtl={isRtl}
              onEdit={(item) => {
                const fullData = projects.find((p) => p.id === item.id) ?? null;
                setEditingItem(fullData);
                setShowAddForm(true);
              }}
              onDelete={handleDeleteProject}
              onToggle={handleToggleProject}
            />
          ))}

        {activeTab === 'hero' &&
          (heroSlides.length === 0 ? (
            renderEmptyState()
          ) : (
            <SortableList
              items={heroSlides.map((s) => ({
                id: s.id,
                title: isRtl ? s.titleFa ?? '' : s.titleEn ?? '',
                image: s.imageUrl,
                youtubeUrl: s.youtubeUrl,
                active: s.active,
              }))}
              onReorder={(items) => handleReorder(items, 'hero')}
              isRtl={isRtl}
              onEdit={(item) => {
                const fullData = heroSlides.find((s) => s.id === item.id) ?? null;
                setEditingItem(fullData);
                setShowAddForm(true);
              }}
              onDelete={handleDeleteHero}
              onToggle={handleToggleHero}
            />
          ))}

        {activeTab === 'categories' &&
          (categories.length === 0 ? (
            renderEmptyState()
          ) : (
            <SortableList
              items={categories.map((c) => ({
                id: c.id,
                title: isRtl ? c.nameFa : c.nameEn,
                image: null,
                youtubeUrl: null,
                active: c.visible,
              }))}
              onReorder={(items) => handleReorder(items, 'category')}
              isRtl={isRtl}
              onEdit={(item) => {
                const fullData = categories.find((c) => c.id === item.id) ?? null;
                setEditingItem(fullData);
                setShowAddForm(true);
              }}
              onDelete={handleDeleteCategory}
              onToggle={handleToggleCategory}
              showThumbnail={false}
            />
          ))}

        {activeTab === 'submissions' &&
          (submissions.length === 0 ? renderEmptyState() : renderSubmissions())}
        </div>
      </div>

      {/* Overlay Form Modal */}
      <AnimatePresence>
        {activeTab !== 'submissions' && (showAddForm || editingItem) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-100 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
            onClick={closeModal}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="w-full max-w-4xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {activeTab === 'projects' ? (
                <ProjectForm
                  locale={locale}
                  initialData={editingItem as SerializedProject | undefined}
                  categories={categories}
                  onClose={closeModal}
                />
              ) : activeTab === 'hero' ? (
                <HeroForm
                  locale={locale}
                  initialData={editingItem as SerializedHeroSlide | undefined}
                  onClose={closeModal}
                />
              ) : (
                <CategoryForm
                  locale={locale}
                  initialData={editingItem as SerializedCategory | undefined}
                  onClose={closeModal}
                />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
