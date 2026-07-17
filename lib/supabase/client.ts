import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    console.error('[v0] Missing Supabase environment variables', {
      hasUrl: !!url,
      hasKey: !!key,
    })
    throw new Error('Supabase configuration is missing. Please check your environment variables.')
  }

  return createBrowserClient(url, key)
}
