import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    console.error('[v0] Missing Supabase environment variables', {
      hasUrl: !!url,
      hasKey: !!key,
      urlValue: url ? `${url.substring(0, 20)}...` : 'undefined',
      keyValue: key ? `${key.substring(0, 20)}...` : 'undefined',
    })
    // Return a mock client that will fail gracefully
    // This allows the page to render but auth operations will fail
    return null as any
  }

  return createBrowserClient(url, key)
}
