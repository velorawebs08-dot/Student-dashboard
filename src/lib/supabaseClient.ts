import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function normalizeSupabaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  // Support bare Supabase project ref if accidentally entered without scheme
  if (/^[a-z0-9-]{10,40}$/i.test(trimmed)) {
    return `https://${trimmed}.supabase.co`;
  }
  return trimmed;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

const rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const rawAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

const normalizedUrl = normalizeSupabaseUrl(rawUrl);
const urlIsValid = isValidHttpUrl(normalizedUrl);
const keyLooksLikeUrl = /^https?:\/\//i.test(rawAnonKey);
const keyIsValid = Boolean(rawAnonKey && !keyLooksLikeUrl && rawAnonKey.length >= 20);

export const isSupabaseConfigured = urlIsValid && keyIsValid;

export const supabaseConfigError = !rawUrl || !rawAnonKey
  ? 'Supabase environment variables (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) are not configured.'
  : !urlIsValid
    ? 'VITE_SUPABASE_URL must be a valid https:// URL (e.g. https://your-project.supabase.co).'
    : keyLooksLikeUrl
      ? 'VITE_SUPABASE_ANON_KEY appears to contain a URL instead of your Supabase anon public key.'
      : !keyIsValid
        ? 'VITE_SUPABASE_ANON_KEY is invalid. Please set your Supabase anon public key in Secrets.'
        : null;

export const supabase: SupabaseClient = createClient(
  isSupabaseConfigured ? normalizedUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? rawAnonKey : 'placeholder-anon-key-placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);

export function assertSupabaseConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new Error(
      supabaseConfigError ||
        'App configuration is incomplete. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    );
  }
}
