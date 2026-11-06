/**
 * Identité de l'appelant pour les Server Actions et Route Handlers.
 *
 * Une Server Action est appelable directement (POST avec l'identifiant de l'action),
 * y compris sans être connecté : chaque action sensible doit vérifier elle-même
 * qui l'appelle. Admin = `profiles.role = 'admin'` uniquement — jamais l'adresse
 * e-mail ni l'initiale, qui ne prouvent rien (n'importe qui peut créer un compte
 * « admin@… »).
 */

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export type Caller = {
  userId: string
  email: string
  role: string
  doctorCode: string
  isAdmin: boolean
}

/** Utilisateur connecté et son profil, ou null si personne n'est connecté. */
export async function getCaller(): Promise<Caller | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await createAdminClient()
    .from("profiles")
    .select("role, doctor_code")
    .eq("id", user.id)
    .maybeSingle()

  const role = String(profile?.role ?? "").toLowerCase()
  return {
    userId: user.id,
    email: (user.email ?? "").toLowerCase(),
    role,
    doctorCode: String(profile?.doctor_code ?? "").toUpperCase(),
    isAdmin: role === "admin",
  }
}

/** Appelant admin, ou null (non connecté / pas admin). */
export async function getAdminCaller(): Promise<Caller | null> {
  const caller = await getCaller()
  return caller?.isAdmin ? caller : null
}
