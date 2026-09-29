'use client';

import React, { useState } from 'react';
import { createCategory, updateCategory } from '@/actions/category';
import { useRouter } from 'next/navigation';
import { Loader2, X } from 'lucide-react';
import type { SerializedCategory } from '@/lib/types';
import { useToast } from './Toast';

interface CategoryFormProps {
  locale: string;
  initialData?: SerializedCategory;
  onClose?: () => void;
}

export default function CategoryForm({ locale, initialData, onClose }: CategoryFormProps) {
  const isRtl = locale === 'fa';
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const nameEn = formData.get('nameEn') as string;
    const nameFa = formData.get('nameFa') as string;

    if (initialData) {
      const result = await updateCategory(initialData.id, formData);
      if (result.success) {
        router.refresh();
        onClose?.();
      } else {
        toast.error(result.error);
      }
    } else {
      const result = await createCategory({ nameEn, nameFa });
      if (result.success) {
        router.refresh();
        onClose?.();
      } else {
        toast.error(result.error);
      }
    }
    setLoading(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative space-y-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">
          {initialData
            ? isRtl
              ? 'ویرایش دسته‌بندی'
              : 'Edit Category'
            : isRtl
              ? 'افزودن دسته‌بندی'
              : 'Add Category'}
        </h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase text-zinc-500 mb-1 ml-1">
            English Name
          </label>
          <input
            name="nameEn"
            defaultValue={initialData?.nameEn}
            placeholder="Commercial"
            required
            className="w-full rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase text-zinc-500 mb-1 ml-1">
            Persian Name
          </label>
          <input
            name="nameFa"
            defaultValue={initialData?.nameFa}
            placeholder="تجاری"
            dir="rtl"
            required
            className="w-full rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 font-bold text-white transition-all hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-600/20 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="animate-spin" />
        ) : initialData ? (
          isRtl ? 'بروزرسانی' : 'Update'
        ) : isRtl ? (
          'ایجاد دسته‌بندی'
        ) : (
          'Create Category'
        )}
      </button>
    </form>
  );
}
