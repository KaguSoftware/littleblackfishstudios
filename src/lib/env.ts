/**
 * Server-side environment access that fails with a readable message instead of
 * "Cannot read properties of undefined" deep inside a Supabase call.
 * (The browser client reads NEXT_PUBLIC_* directly so Next can inline them.)
 */

function need(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`);
  return value;
}

export function supabasePublicEnv() {
  return {
    url: need(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL'),
    key: need(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
  };
}

export function supabaseServiceKey() {
  return need(process.env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY');
}
