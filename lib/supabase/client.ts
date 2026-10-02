import { createBrowserClient } from '@supabase/ssr'
import { getSupabaseConfig } from '@/lib/supabase/config'

/**
 * Client Supabase côté navigateur. La configuration (projet de production,
 * ou Supabase local pour les tests) vient de `lib/supabase/config.ts` — les
 * variables Vercel `NEXT_PUBLIC_SUPABASE_*` ne sont plus utilisées.
 */
export function createClient() {
  const { url, anonKey } = getSupabaseConfig()
  return createBrowserClient(url, anonKey)
}
