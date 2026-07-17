import { createBrowserClient } from "@supabase/ssr"

let supabaseClient: ReturnType<typeof createBrowserClient> | null = null

export function getSupabase() {
  if (supabaseClient) {
    return supabaseClient
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase credentials. Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in your environment variables."
    )
  }

  supabaseClient = createBrowserClient(supabaseUrl, supabaseKey)

  return supabaseClient
}

export function createClient() {
  return getSupabase()
}
