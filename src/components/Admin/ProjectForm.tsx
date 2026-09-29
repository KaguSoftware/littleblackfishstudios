'use client';

import React, { useState } from 'react';
import ImageUpload from './ImageUpload';
import { createProject, updateProject } from '@/actions/project';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  X,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Video,
  Image as ImageIcon,
} from 'lucide-react';
import Image from 'next/image';
import type { SerializedProject, SerializedCategory } from '@/lib/types';
import { useToast } from './Toast';

interface ProjectFormProps {
  locale: string;
  initialData?: SerializedProject;
  categories?: SerializedCategory[];
  onClose?: () => void;
}

export default function ProjectForm({ locale, initialData, categories = [], onClose }: ProjectFormProps) {
  const isRtl = locale === 'fa';
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState(initialData?.imageUrl || '');
  const [mediaType, setMediaType] = useState<'youtube' | 'gallery'>((initialData?.mediaType as 'youtube' | 'gallery') || 'youtube');
  const [galleryUrls, setGalleryUrls] = useState<string[]>(initialData?.galleryUrls || []);
  const [categoryId, setCategoryId] = useState<string>(initialData?.categoryId || '');
  const [supportEnabled, setSupportEnabled] = useState(initialData?.supportEnabled ?? false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    formData.append('imageUrl', imageUrl);
    formData.append('mediaType', mediaType);
    formData.append('galleryUrls', JSON.stringify(galleryUrls));
    formData.append('categoryId', categoryId);
    
    if (initialData) {
      formData.append('currentImageUrl', initialData.imageUrl || '');
      const result = await updateProject(initialData.id, formData);
      if (result.success) {
        router.refresh();
        if (onClose) onClose();
      } else {
        toast.error(result.error);
      }
    } else {
      const data = {
        titleEn: formData.get('titleEn') as string,
        titleFa: formData.get('titleFa') as string,
        descriptionEn: formData.get('descriptionEn') as string,
        descriptionFa: formData.get('descriptionFa') as string,
        youtubeUrl: formData.get('youtubeUrl') as string,
        imageUrl: imageUrl,
        published: formData.get('published') === 'true',
        mediaType,
        galleryUrls,
        categoryId: categoryId || null,
        support: Object.fromEntries(
          [...formData.entries()].filter(([k]) => k.startsWith('support')).map(([k, v]) => [k, String(v)]),
        ),
      };
      const result = await createProject(data);
      if (result.success) {
        router.refresh();
        (e.target as HTMLFormElement).reset();
        setImageUrl('');
        setGalleryUrls([]);
        if (onClose) onClose();
      } else {
        toast.error(result.error);
      }
    }
    setLoading(false);
  }

  const addGalleryImage = (url: string) => {
    setGalleryUrls(prev => [...prev, url]);
  };

  const removeGalleryImage = (index: number) => {
    setGalleryUrls(prev => prev.filter((_, i) => i !== index));
  };

  const moveGalleryImage = (index: number, direction: 'left' | 'right') => {
    const newGallery = [...galleryUrls];
    const newIndex = direction === 'left' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newGallery.length) return;
    [newGallery[index], newGallery[newIndex]] = [newGallery[newIndex], newGallery[index]];
    setGalleryUrls(newGallery);
  };

  return (
    <form onSubmit={handleSubmit} className="relative space-y-6 rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center justify-between mb-4 bg-zinc-950 pb-2 border-b border-zinc-800">
        <h2 className="text-xl font-bold">
          {initialData 
            ? (isRtl ? 'ویرایش پروژه' : 'Edit Project') 
            : (isRtl ? 'افزودن پروژه جدید' : 'Add New Project')}
        </h2>
        {onClose && (
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={24} />
          </button>
        )}
      </div>
      
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="space-y-6">
          {/* Main Thumbnail Upload */}
          <div>
            <label className="block text-xs font-bold uppercase text-zinc-500 mb-2 ml-1">
              {isRtl ? 'تصویر بندانگشتی (اصلی)' : 'Main Thumbnail'}
            </label>
            <ImageUpload onUploadComplete={setImageUrl} defaultValue={initialData?.imageUrl ?? undefined} bucket="projects" />
            <p className="mt-1 text-xs text-zinc-500">
              {isRtl 
                ? '(اختیاری. در صورت خالی بودن از تامنیل یوتیوب استفاده می‌شود)' 
                : '(Optional. Will use YouTube thumbnail if left blank)'}
            </p>
          </div>

          {/* Media Type Toggle */}
          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase text-zinc-500 ml-1">
              {isRtl ? 'نوع محتوا' : 'Media Type'}
            </label>
            <div className="flex p-1 bg-zinc-900 rounded-lg border border-zinc-800">
              <button
                type="button"
                onClick={() => setMediaType('youtube')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-all ${
                  mediaType === 'youtube' 
                    ? 'bg-blue-600 text-white shadow-lg' 
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <Video size={18} />
                <span className="text-sm font-medium">{isRtl ? 'یوتیوب' : 'YouTube'}</span>
              </button>
              <button
                type="button"
                onClick={() => setMediaType('gallery')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-all ${
                  mediaType === 'gallery' 
                    ? 'bg-blue-600 text-white shadow-lg' 
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <ImageIcon size={18} />
                <span className="text-sm font-medium">{isRtl ? 'گالری تصاویر' : 'Gallery'}</span>
              </button>
            </div>
          </div>

          {/* Conditional Media Input */}
          <div className="min-h-50 p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
            {mediaType === 'youtube' ? (
              <div className="space-y-4">
                <label className="block text-xs font-bold uppercase text-zinc-500 mb-1 ml-1">
                  {isRtl ? 'لینک یوتیوب' : 'YouTube URL'}
                </label>
                <input
                  name="youtubeUrl"
                  defaultValue={initialData?.youtubeUrl ?? undefined}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
            ) : (
              <div className="space-y-4">
                <label className="block text-xs font-bold uppercase text-zinc-500 mb-2 ml-1">
                  {isRtl ? 'تصاویر گالری' : 'Gallery Images'}
                </label>
                
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {galleryUrls.map((url, index) => (
                    <div key={url} className="group relative aspect-video rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950">
                      <Image src={url} alt={`Gallery ${index}`} fill className="object-cover" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => moveGalleryImage(index, 'left')}
                            disabled={index === 0}
                            className="p-1.5 bg-zinc-800 rounded-md hover:bg-zinc-700 disabled:opacity-30"
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeGalleryImage(index)}
                            className="p-1.5 bg-red-900/80 rounded-md hover:bg-red-800"
                          >
                            <Trash2 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveGalleryImage(index, 'right')}
                            disabled={index === galleryUrls.length - 1}
                            className="p-1.5 bg-zinc-800 rounded-md hover:bg-zinc-700 disabled:opacity-30"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="absolute top-1 left-1 bg-black/50 px-1.5 py-0.5 rounded text-[10px] font-bold">
                        {index + 1}
                      </div>
                    </div>
                  ))}
                  
                  <div className="relative aspect-video rounded-lg border-2 border-dashed border-zinc-800 hover:border-zinc-700 transition-colors bg-zinc-900/50">
                    <ImageUpload
                      key={galleryUrls.length}
                      onUploadComplete={addGalleryImage}
                      bucket="projects"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Info Column */}
        <div className="space-y-4">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-zinc-500 mb-1 ml-1">English Title</label>
              <input
                name="titleEn"
                defaultValue={initialData?.titleEn}
                placeholder="Project Title"
                required
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-zinc-500 mb-1 ml-1">Persian Title</label>
              <input
                name="titleFa"
                defaultValue={initialData?.titleFa}
                placeholder="عنوان پروژه"
                dir="rtl"
                required
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-zinc-500 mb-1 ml-1">English Description</label>
              <textarea
                name="descriptionEn"
                defaultValue={initialData?.descriptionEn ?? undefined}
                placeholder="Project details..."
                rows={4}
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-zinc-500 mb-1 ml-1">Persian Description</label>
              <textarea
                name="descriptionFa"
                defaultValue={initialData?.descriptionFa ?? undefined}
                placeholder="جزئیات پروژه..."
                dir="rtl"
                rows={4}
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-zinc-500 mb-1 ml-1">
                {isRtl ? 'دسته‌بندی' : 'Category'}
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              >
                <option value="">{isRtl ? 'بدون دسته‌بندی' : 'Uncategorized'}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {isRtl ? c.nameFa : c.nameEn}
                  </option>
                ))}
              </select>
              {categories.length === 0 && (
                <p className="mt-1 text-xs text-zinc-500">
                  {isRtl
                    ? 'هیچ دسته‌بندی‌ای وجود ندارد. ابتدا یک دسته‌بندی ایجاد کنید.'
                    : 'No categories yet. Create one in the Categories tab.'}
                </p>
              )}
            </div>
          </div>

          {/* Support page: opt this project into the /support switcher */}
          <div className="space-y-4 pt-4 border-t border-zinc-800">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                name="supportEnabled"
                value="true"
                checked={supportEnabled}
                onChange={(e) => setSupportEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-800 bg-zinc-900 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-zinc-400 group-hover:text-white transition-colors">
                {isRtl ? 'نمایش در صفحهٔ حمایت' : 'Show on Support page'}
              </span>
            </label>

            {/* Hidden rather than unmounted, so unticking keeps the text for later */}
            <div className={supportEnabled ? 'space-y-4' : 'hidden'}>
              <p className="text-xs text-zinc-500">
                {isRtl
                  ? 'متن اصلی: هر بخش را با یک خط «## عنوان» شروع کنید و پاراگراف‌ها را با یک خط خالی جدا کنید. متن را کوتاه نگه دارید تا صفحه در دسکتاپ جا شود.'
                  : 'Main text: start each section with a "## Heading" line and separate paragraphs with a blank line. Keep it short so the page fits one desktop screen.'}
              </p>
              {([
                ['Title', 'Support page title', 'عنوان صفحهٔ حمایت', 'input'],
                ['Intro', 'Intro (one or two sentences)', 'معرفی کوتاه', 'short'],
                ['Body', 'Main text', 'متن اصلی', 'long'],
                ['Closing', 'Closing line', 'جملهٔ پایانی', 'short'],
              ] as const).map(([field, labelEn, labelFa, kind]) =>
                (['En', 'Fa'] as const).map((lang) => {
                  const name = `support${field}${lang}` as const;
                  const common = {
                    name,
                    defaultValue: initialData?.[name] ?? undefined,
                    dir: lang === 'Fa' ? 'rtl' : 'ltr',
                    className:
                      'w-full rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all',
                  };
                  return (
                    <div key={name}>
                      <label className="block text-xs font-bold uppercase text-zinc-500 mb-1 ml-1">
                        {isRtl ? `${labelFa} (${lang === 'En' ? 'انگلیسی' : 'فارسی'})` : `${lang === 'En' ? 'English' : 'Persian'} ${labelEn}`}
                      </label>
                      {kind === 'input' ? <input {...common} /> : <textarea {...common} rows={kind === 'long' ? 10 : 2} />}
                    </div>
                  );
                }),
              )}
              <div className="grid grid-cols-2 gap-4">
                {([
                  ['supportEpisodesDone', 'Episodes released', 'قسمت‌های منتشرشده'],
                  ['supportEpisodesTotal', 'Total episodes', 'کل قسمت‌ها'],
                ] as const).map(([name, labelEn, labelFa]) => (
                  <div key={name}>
                    <label className="block text-xs font-bold uppercase text-zinc-500 mb-1 ml-1">
                      {isRtl ? labelFa : labelEn}
                    </label>
                    <input
                      type="number"
                      min={0}
                      name={name}
                      defaultValue={initialData?.[name] ?? undefined}
                      className="w-full rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-zinc-500">
                {isRtl
                  ? 'برای پنهان کردن نوار پیشرفت، هر دو را خالی بگذارید.'
                  : 'Leave both empty to hide the progress bar.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-4 border-t border-zinc-800">
            {!initialData && (
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" name="published" value="true" className="h-4 w-4 rounded border-zinc-800 bg-zinc-900 text-blue-600 focus:ring-blue-500" />
                <span className="text-sm text-zinc-400 group-hover:text-white transition-colors">
                  {isRtl ? 'انتشار فوری' : 'Publish Immediately'}
                </span>
              </label>
            )}
            
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 p-3 font-bold text-white transition-all hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <>
                  {initialData ? (isRtl ? 'بروزرسانی' : 'Update') : (isRtl ? 'ایجاد پروژه' : 'Create Project')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
