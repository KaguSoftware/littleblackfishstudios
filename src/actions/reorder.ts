'use server';

import { createServiceClient, requireAdminUser } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function updateOrder(
  items: { id: string; order: number }[],
  model: 'project' | 'hero' | 'category'
) {
  await requireAdminUser();
  try {
    // Only well-formed rows reach the database
    const rows = (Array.isArray(items) ? items : []).filter(
      (i) => i && typeof i.id === 'string' && Number.isInteger(i.order),
    );
    if (rows.length === 0 || rows.length !== items.length) {
      return { success: false, error: 'Invalid order data' };
    }

    const supabase = createServiceClient();
    const table =
      model === 'project'
        ? 'projects'
        : model === 'hero'
          ? 'hero_slides'
          : 'categories';

    const results = await Promise.all(
      rows.map(({ id, order }) =>
        supabase.from(table).update({ order }).eq('id', id)
      )
    );

    const firstError = results.find((r) => r.error)?.error;
    if (firstError) {
      console.error(`Failed to update ${model} order:`, firstError);
      return { success: false, error: firstError.message };
    }

    revalidatePath('/[locale]', 'layout');
    revalidatePath('/[locale]/admin', 'page');
    return { success: true };
  } catch (error) {
    console.error(`Failed to update ${model} order:`, error);
    return { success: false, error: `Failed to update ${model} order` };
  }
}
