'use server';

import { createServiceClient, requireAdminUser } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getYouTubeId } from '@/lib/youtube';
import { cleanText, cleanUrl, cleanUrlList, slugify } from '@/lib/validate';

function processImageUrl(imageUrl: string | null, youtubeUrl: string | null) {
  if ((!imageUrl || imageUrl.trim() === '') && youtubeUrl) {
    const videoId = getYouTubeId(youtubeUrl);
    if (videoId) {
      return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    }
  }
  return imageUrl;
}

// Extract the storage path from a Supabase public URL.
// URL shape: https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<path>
function extractStoragePath(url: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

function isSupabaseUrl(url: string): boolean {
  return url.includes('.supabase.co/storage/');
}

const SUPPORT_TEXT_FIELDS = ['Title', 'Intro', 'Body', 'Closing'] as const;

/** Support page columns from the project form (fields named supportTitleEn, supportEpisodesDone, ...). */
function readSupportFields(values: FormData | Record<string, string>) {
  const get = (name: string) =>
    values instanceof FormData ? ((values.get(name) as string | null) ?? '') : (values[name] ?? '');
  const text = (name: string) => get(name).trim() || null;
  const int = (name: string) => {
    const n = parseInt(get(name), 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const row: Record<string, string | number | boolean | null> = {
    support_enabled: get('supportEnabled') === 'true',
    support_episodes_done: int('supportEpisodesDone'),
    support_episodes_total: int('supportEpisodesTotal'),
  };
  for (const f of SUPPORT_TEXT_FIELDS) {
    row[`support_${f.toLowerCase()}_en`] = text(`support${f}En`);
    row[`support_${f.toLowerCase()}_fa`] = text(`support${f}Fa`);
  }
  return row;
}

export async function createProject(data: {
  slug?: string;
  titleEn: string;
  titleFa: string;
  descriptionEn?: string;
  descriptionFa?: string;
  youtubeUrl?: string;
  imageUrl?: string;
  published: boolean;
  mediaType?: string;
  galleryUrls?: string[];
  categoryId?: string | null;
  support?: Record<string, string>;
}) {
  await requireAdminUser();
  try {
    const supabase = createServiceClient();
    const titleEn = cleanText(data.titleEn, 200);
    const titleFa = cleanText(data.titleFa, 200);
    if (!titleEn || !titleFa) return { success: false, error: 'Both titles are required' };

    const youtubeUrl = cleanUrl(data.youtubeUrl);
    const finalImageUrl = processImageUrl(cleanUrl(data.imageUrl), youtubeUrl);
    // The slug is fixed at creation so project URLs never change when the title is edited
    const slug = `${slugify(titleEn) || 'project'}-${Date.now()}`;

    const { error } = await supabase.from('projects').insert({
      slug,
      title_en: titleEn,
      title_fa: titleFa,
      description_en: cleanText(data.descriptionEn, 20000) || null,
      description_fa: cleanText(data.descriptionFa, 20000) || null,
      youtube_url: youtubeUrl,
      image_url: finalImageUrl,
      published: data.published,
      media_type: cleanText(data.mediaType, 20) || 'youtube',
      gallery_urls: cleanUrlList(JSON.stringify(data.galleryUrls ?? [])),
      category_id: data.categoryId ?? null,
      order: 0,
      ...(data.support ? readSupportFields(data.support) : {}),
    });

    if (error) throw error;

    revalidatePath('/[locale]', 'layout');
    revalidatePath('/[locale]/admin', 'page');
    return { success: true };
  } catch (error) {
    console.error('Failed to create project:', error);
    return { success: false, error: 'Failed to create project' };
  }
}

export async function updateProject(id: string, formData: FormData) {
  await requireAdminUser();
  try {
    const supabase = createServiceClient();
    const titleEn = cleanText(formData.get('titleEn'), 200);
    const titleFa = cleanText(formData.get('titleFa'), 200);
    if (!titleEn || !titleFa) return { success: false, error: 'Both titles are required' };
    const descriptionEn = cleanText(formData.get('descriptionEn'), 20000);
    const descriptionFa = cleanText(formData.get('descriptionFa'), 20000);
    const youtubeUrl = cleanUrl(formData.get('youtubeUrl'));
    const imageUrl = cleanUrl(formData.get('imageUrl'));
    const mediaType = cleanText(formData.get('mediaType'), 20) || 'youtube';
    const galleryUrls = cleanUrlList(formData.get('galleryUrls'));
    const categoryIdRaw = formData.get('categoryId') as string | null;
    const categoryId = categoryIdRaw && categoryIdRaw.length > 0 ? categoryIdRaw : null;

    const finalImageUrl = processImageUrl(imageUrl, youtubeUrl);

    const { error } = await supabase.from('projects').update({
      title_en: titleEn,
      title_fa: titleFa,
      description_en: descriptionEn || null,
      description_fa: descriptionFa || null,
      youtube_url: youtubeUrl || null,
      image_url: finalImageUrl,
      media_type: mediaType,
      gallery_urls: galleryUrls,
      category_id: categoryId,
      ...readSupportFields(formData),
    }).eq('id', id);

    if (error) throw error;

    revalidatePath('/[locale]', 'layout');
    revalidatePath('/[locale]/admin', 'page');
    return { success: true };
  } catch (error) {
    console.error('Failed to update project:', error);
    return { success: false, error: 'Failed to update project' };
  }
}

export async function deleteProject(id: string) {
  await requireAdminUser();
  try {
    const supabase = createServiceClient();

    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('image_url, gallery_urls')
      .eq('id', id)
      .single();

    if (fetchError || !project) {
      return { success: false, error: 'Project not found' };
    }

    // Collect all Supabase-hosted storage paths to delete
    const pathsToDelete: string[] = [];

    if (project.image_url && isSupabaseUrl(project.image_url)) {
      const path = extractStoragePath(project.image_url, 'projects');
      if (path) pathsToDelete.push(path);
    }

    const gallery: string[] = project.gallery_urls ?? [];
    for (const url of gallery) {
      if (url && isSupabaseUrl(url)) {
        const path = extractStoragePath(url, 'projects');
        if (path) pathsToDelete.push(path);
      }
    }

    // Delete the row first: if this fails nothing is lost. Orphaned files are the lesser evil.
    const { error: deleteError } = await supabase.from('projects').delete().eq('id', id);
    if (deleteError) throw deleteError;

    // Row is gone, now remove its files from storage
    if (pathsToDelete.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('projects')
        .remove(pathsToDelete);
      if (storageError) console.error('Failed to delete project storage files:', storageError);
    }

    revalidatePath('/[locale]', 'layout');
    revalidatePath('/[locale]/admin', 'page');
    return { success: true };
  } catch (error) {
    console.error('Failed to delete project:', error);
    return { success: false, error: 'Failed to delete project' };
  }
}
