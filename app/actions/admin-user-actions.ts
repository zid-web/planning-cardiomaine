"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { DOCTORS } from "@/lib/constants"
import {
  findNonSchedulingStaffAdminByEmail,
  isNonSchedulingStaffAdminCode,
} from "@/lib/staff-admin"
import { revalidatePath } from "next/cache"
import { perfLog, perfWarn } from "@/lib/perf-log"

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
      .limit(1000)

    if (error) return { success: false as const, error: error.message, users: [] as AdminUserRow[] }

    // Compléter les emails manquants depuis Auth (anciens profils / trigger partiel)
    const emailById = new Map<string, string>()
    try {
      let page = 1
      for (;;) {
        const { data: listed, error: authErr } = await admin.auth.admin.listUsers({
          page,
          perPage: 200,
        })
        if (authErr) break
        const batch = listed?.users || []
        for (const u of batch) {
          if (u.email) emailById.set(u.id, u.email)
        }
        if (batch.length < 200) break
        page += 1
        if (page > 20) break
      }
    } catch {
      // Auth list optionnelle — on garde les emails profil
    }

    const users = (profiles || []).map((p) => ({
      ...(p as AdminUserRow),
      email: (p as AdminUserRow).email || emailById.get(p.id) || null,
    }))

    return { success: true as const, users }
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

    const knownStaff = findNonSchedulingStaffAdminByEmail(email)
    let role = input.role
    let doctorCode = input.doctor_code?.trim().toUpperCase() || null
    let firstName = input.first_name?.trim() || null
    let lastName = input.last_name?.trim() || null

    // Lucie (L) et autres admins hors planning : forcer admin + code, jamais médecin
    if (knownStaff) {
      role = "admin"
      doctorCode = knownStaff.code
      firstName = firstName || knownStaff.first_name || null
      lastName = lastName || knownStaff.last_name || null
    }

    if (doctorCode && isNonSchedulingStaffAdminCode(doctorCode)) {
      role = "admin"
      if (DOCTORS.includes(doctorCode)) {
        return {
          success: false as const,
          error: `${doctorCode} est un admin hors planning — ne pas l’ajouter à DOCTORS`,
        }
      }
    }

    // Un code médecin listé en rôle doctor est OK ; un admin hors planning ne doit pas
    // être créé en « doctor » sous un autre code par erreur.
    if (role === "doctor" && doctorCode && isNonSchedulingStaffAdminCode(doctorCode)) {
      return {
        success: false as const,
        error: `${doctorCode} est réservé aux admins hors planning (pas médecin)`,
      }
    }

    const admin = createAdminClient()
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName || "",
        last_name: lastName || "",
      },
    })

    if (error || !data.user) {
      return { success: false as const, error: error?.message || "Création échouée" }
    }

    const { error: pErr } = await admin
      .from("profiles")
      .update({
        role,
        doctor_code: doctorCode,
        first_name: firstName,
        last_name: lastName,
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

    const { data: existing } = await admin
      .from("profiles")
      .select("email, role, doctor_code")
      .eq("id", id)
      .single()

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

    const nextCode =
      (payload.doctor_code as string | null | undefined) ?? existing?.doctor_code ?? null
    const knownStaff =
      findNonSchedulingStaffAdminByEmail(existing?.email) ||
      (isNonSchedulingStaffAdminCode(nextCode)
        ? { code: String(nextCode).toUpperCase() }
        : undefined)

    if (knownStaff) {
      payload.role = "admin"
      payload.doctor_code = "code" in knownStaff && knownStaff.code ? knownStaff.code : nextCode
      if (patch.role === "doctor") {
        return {
          success: false as const,
          error: `${payload.doctor_code} est un admin hors planning — rôle médecin interdit`,
        }
      }
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

export async function resetUserPassword(id: string, newPassword: string) {
  try {
    const actor = await assertAdmin()

    // Supabase exige un minimum de 6 caractères (configuration du projet) ;
    // l'appli exige déjà ≥ 8 caractères ailleurs (création de compte, saisie
    // du mot de passe par l'utilisateur). En dessous de ce seuil, l'appel
    // `updateUserById` échoue côté Supabase et le mot de passe n'est JAMAIS
    // réellement modifié — l'utilisateur reste bloqué avec « email ou mot de
    // passe incorrect » sans que l'admin s'en rende compte. On bloque donc
    // ici tout mot de passe trop court (ex. "1234") avant l'appel Supabase.
    if (!newPassword || newPassword.length < 8) {
      return { success: false as const, error: "Le mot de passe doit contenir au moins 8 caractères" }
    }

    const admin = createAdminClient()

    // Trace de l'operation (point souleve en revue). Changer le mot de passe
    // d'autrui est une prise de controle de compte : sans trace, rien ne
    // permet de savoir qui l'a fait ni quand, sur une application ou le
    // planning fait foi sur les gardes assurees.
    //
    // La trace part dans les journaux du serveur (recuperes par Vercel), et
    // NON dans une table : cela demanderait une migration, et un fichier
    // dormant dans `supabase/migrations/` n'est pas neutre — `supabase db
    // push` l'appliquerait. Une table durable reste la solution plus solide,
    // a decider separement.
    //
    // Ne journalise jamais le mot de passe, evidemment, ni celui de l'auteur.
    const audit = { actorId: actor.id, actorEmail: actor.email, targetId: id }

    const { error: authError } = await admin.auth.admin.updateUserById(id, {
      password: newPassword,
    })
    if (authError) {
      perfWarn("admin-users", "password_reset_failed", { ...audit, error: authError.message })
      return { success: false as const, error: authError.message }
    }
    perfLog("admin-users", "password_reset", audit)

    // À partir d'ici le mot de passe EST modifié : l'ancien ne fonctionne plus.
    // Signaler un simple « échec » si l'écriture suivante rate serait
    // trompeur — l'admin en conclurait que rien ne s'est passé, ne
    // communiquerait pas le nouveau mot de passe, et l'utilisateur se
    // retrouverait plus bloqué qu'avant. On distingue donc ce cas, et
    // `passwordChanged` permet à l'appelant de l'annoncer correctement.
    const { error: profileError } = await admin
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", id)
    if (profileError) {
      perfWarn("admin-users", "password_reset_flag_failed", {
        ...audit,
        error: profileError.message,
      })
      revalidatePath("/protected/admin/users")
      return {
        success: false as const,
        passwordChanged: true as const,
        error:
          "Le mot de passe a bien été modifié — communiquez-le à l'utilisateur. " +
          "En revanche, l'obligation de le changer à la prochaine connexion n'a pas pu " +
          `être enregistrée (${profileError.message}). Relancez l'opération pour la poser.`,
      }
    }

    revalidatePath("/protected/admin/users")
    return { success: true as const, passwordChanged: true as const }
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
