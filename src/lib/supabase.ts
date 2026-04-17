import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const fallbackUrl = 'https://placeholder-project.supabase.co';
const fallbackAnonKey = 'placeholder-anon-key';
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

if (!hasSupabaseConfig) {
  console.warn('Supabase env vars are missing in preview; using a safe fallback client so the UI can still render.');
}

export const supabase = createClient(
  hasSupabaseConfig ? supabaseUrl! : fallbackUrl,
  hasSupabaseConfig ? supabaseAnonKey! : fallbackAnonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);
