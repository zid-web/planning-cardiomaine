import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Use environment variables, with fallback to production values for V0 preview
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rmrxsaiianffhpxpntws.supabase.co'
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtcnhzYWlpYW5mZmhweHBudHdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMzI3MTUsImV4cCI6MjA5OTgwODcxNX0.WlUydbEb3oZ2ZnyStE7du6wZhtuzKxGzgFyJPZOQdbo'

  // Debug logs for V0 preview environment verification
  console.log('[v0] Supabase Client Initialization', {
    environment: typeof window !== 'undefined' ? 'browser' : 'server',
    timestamp: new Date().toISOString(),
    hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  })

  if (!url || !key) {
    console.error('[v0] Missing Supabase configuration', {
      hasUrl: !!url,
      hasKey: !!key,
    })
    return null as any
  }

  console.log('[v0] Supabase client created successfully', {
    url: `${url.substring(0, 30)}...`,
    keyLength: key.length,
    usingFallback: !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  })

  return createBrowserClient(url, key)
}
