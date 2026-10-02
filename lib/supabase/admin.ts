import { createClient } from "@supabase/supabase-js"
import { getSupabaseConfig } from "@/lib/supabase/config"

/**
 * Client Supabase service_role — Server Actions / Route Handlers uniquement.
 * Ne jamais importer ce module dans un composant client.
 */
export function createAdminClient() {
  const { url } = getSupabaseConfig()
  // La clé service_role doit appartenir au **même projet** que l'adresse
  // ci-dessus (Supabase → Settings → API du projet de production).
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY requis pour les actions admin")
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
