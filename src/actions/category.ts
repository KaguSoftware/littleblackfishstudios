'use server';

import { createServiceClient, requireAdminUser } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { cleanText, slugify } from '@/lib/validate';

export async function createCategory(data: { nameEn: string; nameFa: string }) {
  await requireAdminUser();
  try {
    const supabase = createServiceClient();
    const nameEn = cleanText(data.nameEn, 100);
    const nameFa = cleanText(data.nameFa, 100);
    if (!nameEn || !nameFa) return { success: false, error: 'Both names are required' };
    // The slug is fixed at creation so category URLs never change when the name is edited
    const slug = `${slugify(nameEn) || 'category'}-${Date.now()}`;

    const { error } = await supabase.from('categories').insert({
      slug,
      name_en: nameEn,
      name_fa: nameFa,
      order: 0,
      visible: true,
    });

    if (error) throw error;

    revalidatePath('/[locale]', 'layout');
    revalidatePath('/[locale]/admin', 'page');
    return { success: true };
  } catch (error) {
    console.error('Failed to create category:', error);
    return { success: false, error: 'Failed to create category' };
  }
}

export async function updateCategory(id: string, formData: FormData) {
  await requireAdminUser();
  try {
    const supabase = createServiceClient();
    const nameEn = cleanText(formData.get('nameEn'), 100);
    const nameFa = cleanText(formData.get('nameFa'), 100);

    if (!nameEn || !nameFa) {
      return { success: false, error: 'Both names are required' };
    }

    const { error } = await supabase
      .from('categories')
      .update({
        name_en: nameEn,
        name_fa: nameFa,
      })
      .eq('id', id);

    if (error) throw error;

    revalidatePath('/[locale]', 'layout');
    revalidatePath('/[locale]/admin', 'page');
    return { success: true };
  } catch (error) {
    console.error('Failed to update category:', error);
    return { success: false, error: 'Failed to update category' };
  }
}

export async function deleteCategory(id: string) {
  await requireAdminUser();
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) throw error;

    revalidatePath('/[locale]', 'layout');
    revalidatePath('/[locale]/admin', 'page');
    return { success: true };
  } catch (error) {
    console.error('Failed to delete category:', error);
    return { success: false, error: 'Failed to delete category' };
  }
}

export async function toggleCategoryVisibility(id: string, currentVisible: boolean) {
  await requireAdminUser();
  try {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from('categories')
      .update({ visible: !currentVisible })
      .eq('id', id);

    if (error) throw error;

    revalidatePath('/[locale]', 'layout');
    revalidatePath('/[locale]/admin', 'page');
    return { success: true };
  } catch (error) {
    console.error('Failed to toggle category visibility:', error);
    return { success: false };
  }
}
