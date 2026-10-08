'use server';

import { createServiceClient, requireAdminUser } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { cleanInt, cleanText, cleanUrl } from '@/lib/validate';

function extractStoragePath(url: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

function isSupabaseUrl(url: string): boolean {
  return url.includes('.supabase.co/storage/');
}

export async function createHeroSlide(formData: FormData) {
  await requireAdminUser();
  try {
    const supabase = createServiceClient();
    const titleEn = cleanText(formData.get('titleEn'), 200) || null;
    const titleFa = cleanText(formData.get('titleFa'), 200) || null;
    const subtitleEn = cleanText(formData.get('subtitleEn'), 500) || null;
    const subtitleFa = cleanText(formData.get('subtitleFa'), 500) || null;
    const order = cleanInt(formData.get('order'));
    const imageUrl = cleanUrl(formData.get('imageUrl'));
    const youtubeUrl = cleanUrl(formData.get('youtubeUrl'));

    if (!imageUrl && !youtubeUrl) throw new Error('Image or YouTube URL is required');

    const { error } = await supabase.from('hero_slides').insert({
      title_en: titleEn,
      title_fa: titleFa,
      subtitle_en: subtitleEn,
      subtitle_fa: subtitleFa,
      image_url: imageUrl,
      youtube_url: youtubeUrl,
      order,
      active: true,
    });

    if (error) throw error;

    revalidatePath('/[locale]', 'layout');
    revalidatePath('/[locale]/admin', 'page');
    return { success: true };
  } catch (error) {
    console.error('Create hero slide failed:', error);
    return { success: false, error: 'Failed to create slide' };
  }
}

export async function toggleHeroStatus(id: string, currentStatus: boolean) {
  await requireAdminUser();
  try {
    const supabase = createServiceClient();

    const { error } = await supabase
      .from('hero_slides')
      .update({ active: !currentStatus })
      .eq('id', id);

    if (error) throw error;

    revalidatePath('/[locale]', 'layout');
    revalidatePath('/[locale]/admin', 'page');
    return { success: true };
  } catch (error) {
    console.error('Toggle hero status failed:', error);
    return { success: false };
  }
}

export async function deleteHeroSlide(id: string, imageUrl: string) {
  await requireAdminUser();
  try {
    const supabase = createServiceClient();

    const { error: deleteError } = await supabase.from('hero_slides').delete().eq('id', id);
    if (deleteError) throw deleteError;

    if (imageUrl && isSupabaseUrl(imageUrl)) {
      const path = extractStoragePath(imageUrl, 'hero');
      if (path) {
        const { error: storageError } = await supabase.storage.from('hero').remove([path]);
        if (storageError) console.error('Failed to delete hero storage file:', storageError);
      }
    }

    revalidatePath('/[locale]', 'layout');
    revalidatePath('/[locale]/admin', 'page');
    return { success: true };
  } catch (error) {
    console.error('Delete hero slide failed:', error);
    return { success: false };
  }
}

export async function updateHeroSlide(id: string, formData: FormData) {
  await requireAdminUser();
  try {
    const supabase = createServiceClient();
    const titleEn = cleanText(formData.get('titleEn'), 200) || null;
    const titleFa = cleanText(formData.get('titleFa'), 200) || null;
    const subtitleEn = cleanText(formData.get('subtitleEn'), 500) || null;
    const subtitleFa = cleanText(formData.get('subtitleFa'), 500) || null;
    const order = cleanInt(formData.get('order'));
    const imageUrl = cleanUrl(formData.get('imageUrl'));
    const youtubeUrl = cleanUrl(formData.get('youtubeUrl'));

    const { error } = await supabase
      .from('hero_slides')
      .update({
        title_en: titleEn,
        title_fa: titleFa,
        subtitle_en: subtitleEn,
        subtitle_fa: subtitleFa,
        image_url: imageUrl,
        youtube_url: youtubeUrl,
        order,
      })
      .eq('id', id);

    if (error) throw error;

    revalidatePath('/[locale]', 'layout');
    revalidatePath('/[locale]/admin', 'page');
    return { success: true };
  } catch (error) {
    console.error('Update hero slide failed:', error);
    return { success: false, error: 'Failed to update slide' };
  }
}
