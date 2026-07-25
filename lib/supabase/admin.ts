import { createClient } from "@supabase/supabase-js"

/**
 * Client Supabase service_role — Server Actions / Route Handlers uniquement.
 * Ne jamais importer ce module dans un composant client.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY (et NEXT_PUBLIC_SUPABASE_URL) requis pour les actions admin",
    )
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
