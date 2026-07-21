import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Debug logs for V0 preview environment verification
  console.log('[v0] Supabase Client Initialization', {
    environment: typeof window !== 'undefined' ? 'browser' : 'server',
    timestamp: new Date().toISOString(),
  })

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

  console.log('[v0] Supabase client created successfully', {
    url: `${url.substring(0, 30)}...`,
    keyLength: key.length,
  })

  return createBrowserClient(url, key)
}
