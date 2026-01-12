import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables! Frontend features may break.');
}

// Fallback to empty string to prevent immediate crash, but requests will fail if not set.
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
