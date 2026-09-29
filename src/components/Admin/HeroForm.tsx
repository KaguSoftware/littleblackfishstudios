'use client';

import React, { useState } from 'react';
import ImageUpload from './ImageUpload';
import { createHeroSlide, updateHeroSlide } from '@/actions/hero';
import { useRouter } from 'next/navigation';
import { Loader2, X, Youtube } from 'lucide-react';
import type { SerializedHeroSlide } from '@/lib/types';
import { useToast } from './Toast';

interface HeroFormProps {
  locale: string;
  initialData?: SerializedHeroSlide;
  onClose?: () => void;
}

export default function HeroForm({ locale, initialData, onClose }: HeroFormProps) {
  const isRtl = locale === 'fa';
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState(initialData?.imageUrl || '');
  const [youtubeUrl, setYoutubeUrl] = useState(initialData?.youtubeUrl || '');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    formData.append('imageUrl', imageUrl);
    formData.append('youtubeUrl', youtubeUrl);

    if (initialData) {
      formData.append('currentImageUrl', initialData.imageUrl || '');
      const result = await updateHeroSlide(initialData.id, formData);
      if (result.success) {
        router.refresh();
        if (onClose) onClose();
      } else {
        toast.error(result.error);
      }
    } else {
      const result = await createHeroSlide(formData);
      if (result.success) {
        router.refresh();
        if (onClose) onClose();
      } else {
        toast.error(result.error);
      }
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="relative space-y-6 rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold">
          {initialData 
            ? (isRtl ? 'ویرایش اسلاید' : 'Edit Hero Slide') 
            : (isRtl ? 'افزودن اسلاید هیرو' : 'Add Hero Slide')}
        </h2>
        {onClose && (
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-white">
            <X size={24} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <ImageUpload onUploadComplete={setImageUrl} defaultValue={initialData?.imageUrl ?? undefined} bucket="hero" />
          
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Youtube className="h-5 w-5 text-red-500" />
            </div>
            <input 
              name="youtubeUrlRaw" // not used in FormData since we append state directly
              type="text"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="YouTube URL (Optional fallback/alternative)" 
              className="w-full rounded-lg bg-zinc-900 border border-zinc-800 p-3 pl-10 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all" 
            />
          </div>

          <input 
            name="order" 
            type="number" 
            defaultValue={initialData?.order || 0}
            placeholder="Order (0, 1, 2...)" 
            className="w-full rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-white" 
          />
        </div>
        <div className="space-y-4">
          <input name="titleEn" defaultValue={initialData?.titleEn ?? undefined} placeholder={isRtl ? 'عنوان (اختیاری - EN)' : 'Title (Optional - EN)'} className="w-full rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-white" />
          <input name="titleFa" defaultValue={initialData?.titleFa ?? undefined} placeholder={isRtl ? 'عنوان (اختیاری - FA)' : 'Title (Optional - FA)'} dir="rtl" className="w-full rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-white" />
          <input name="subtitleEn" defaultValue={initialData?.subtitleEn ?? undefined} placeholder={isRtl ? 'زیرنویس (اختیاری - EN)' : 'Subtitle (Optional - EN)'} className="w-full rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-white" />
          <input name="subtitleFa" defaultValue={initialData?.subtitleFa ?? undefined} placeholder={isRtl ? 'زیرنویس (اختیاری - FA)' : 'Subtitle (Optional - FA)'} dir="rtl" className="w-full rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-white" />
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-3 font-bold text-white disabled:opacity-50 transition-colors hover:bg-blue-500"
          >
            {loading ? <Loader2 className="mx-auto animate-spin" /> : (initialData ? (isRtl ? 'بروزرسانی' : 'Update') : (isRtl ? 'ذخیره اسلاید' : 'Save Slide'))}
          </button>
        </div>
      </div>
    </form>
  );
}
