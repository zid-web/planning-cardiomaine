"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

export type AdminUserRow = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  role: string | null
  doctor_code: string | null
  must_change_password: boolean | null
  created_at: string | null
}

async function assertAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Non authentifié")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") throw new Error("Admin requis")
  return user
}

export async function listUsers() {
  try {
    await assertAdmin()
    const admin = createAdminClient()
    const { data: profiles, error } = await admin
      .from("profiles")
      .select("id, email, first_name, last_name, role, doctor_code, must_change_password, created_at")
      .order("created_at", { ascending: false })

    if (error) return { success: false as const, error: error.message, users: [] as AdminUserRow[] }
    return { success: true as const, users: (profiles || []) as AdminUserRow[] }
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Erreur",
      users: [] as AdminUserRow[],
    }
  }
}

export async function createUserAccount(input: {
  email: string
  password: string
  role: "admin" | "doctor"
  doctor_code?: string
  first_name?: string
  last_name?: string
}) {
  try {
    await assertAdmin()
    const email = input.email.trim().toLowerCase()
    if (!email || !input.password || input.password.length < 8) {
      return { success: false as const, error: "Email et mot de passe (≥ 8) requis" }
    }

    const admin = createAdminClient()
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        first_name: input.first_name || "",
        last_name: input.last_name || "",
      },
    })

    if (error || !data.user) {
      return { success: false as const, error: error?.message || "Création échouée" }
    }

    const { error: pErr } = await admin
      .from("profiles")
      .update({
        role: input.role,
        doctor_code: input.doctor_code?.trim().toUpperCase() || null,
        first_name: input.first_name?.trim() || null,
        last_name: input.last_name?.trim() || null,
        must_change_password: true,
        email,
      })
      .eq("id", data.user.id)

    if (pErr) return { success: false as const, error: pErr.message }

    revalidatePath("/protected/admin/users")
    return { success: true as const, userId: data.user.id }
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Erreur",
    }
  }
}

export async function updateUserProfile(
  id: string,
  patch: {
    role?: "admin" | "doctor"
    doctor_code?: string | null
    first_name?: string | null
    last_name?: string | null
    must_change_password?: boolean
  },
) {
  try {
    await assertAdmin()
    const admin = createAdminClient()
    const payload: Record<string, unknown> = {}
    if (patch.role) payload.role = patch.role
    if (patch.doctor_code !== undefined) {
      payload.doctor_code = patch.doctor_code?.trim().toUpperCase() || null
    }
    if (patch.first_name !== undefined) payload.first_name = patch.first_name
    if (patch.last_name !== undefined) payload.last_name = patch.last_name
    if (patch.must_change_password !== undefined) {
      payload.must_change_password = patch.must_change_password
    }

    const { error } = await admin.from("profiles").update(payload).eq("id", id)
    if (error) return { success: false as const, error: error.message }

    revalidatePath("/protected/admin/users")
    return { success: true as const }
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Erreur",
    }
  }
}

export async function deleteUserAccount(id: string) {
  try {
    const me = await assertAdmin()
    if (me.id === id) {
      return { success: false as const, error: "Impossible de supprimer votre propre compte" }
    }

    const admin = createAdminClient()
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) return { success: false as const, error: error.message }

    revalidatePath("/protected/admin/users")
    return { success: true as const }
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Erreur",
    }
  }
}
