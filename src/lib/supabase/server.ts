import { createServerClient as createSupabaseServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { supabasePublicEnv, supabaseServiceKey } from '@/lib/env';

export async function createServerClient() {
  const cookieStore = await cookies();
  const { url, key } = supabasePublicEnv();

  return createSupabaseServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component, session refresh handled by middleware
          }
        },
      },
    }
  );
}

// Public reads give up after this long so a dead DB falls back to the snapshot
// (see lib/queries/public.ts) instead of hanging the render
const ANON_TIMEOUT_MS = 4000;

export function createAnonClient() {
  const { url, key } = supabasePublicEnv();
  return createClient(
    url,
    key,
    {
      auth: { persistSession: false },
      global: {
        fetch: (input, init) =>
          fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(ANON_TIMEOUT_MS) }),
      },
    }
  );
}

export function createServiceClient() {
  return createClient(
    supabasePublicEnv().url,
    supabaseServiceKey(),
    { auth: { persistSession: false } }
  );
}

export async function requireAdminUser(): Promise<void> {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || user.app_metadata?.role !== 'admin') {
    throw new Error('Unauthorized');
  }
}
