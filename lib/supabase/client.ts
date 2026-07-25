import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Use environment variables, with fallback to production values for V0 preview
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rmrxsaiianffhpxpntws.supabase.co'
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtcnhzYWlpYW5mZmhweHBudHdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMzI3MTUsImV4cCI6MjA5OTgwODcxNX0.WlUydbEb3oZ2ZnyStE7du6wZhtuzKxGzgFyJPZOQdbo'

  if (!url || !key) {
    console.error('[supabase/client] Missing Supabase configuration', {
      hasUrl: !!url,
      hasKey: !!key,
    })
    return null as any
  }

  return createBrowserClient(url, key)
}
