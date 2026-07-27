#!/usr/bin/env bun
/**
 * Crée / met à jour les admins hors planning (ex. Lucie = L).
 *
 * Usage:
 *   bun scripts/ensure-staff-admins.ts
 *
 * Requiert SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL
 * (local ou prod). Mot de passe temporaire via STAFF_ADMIN_TEMP_PASSWORD
 * (défaut: ChangeMeLucie1!).
 */
import { createClient } from "@supabase/supabase-js"
import { NON_SCHEDULING_STAFF_ADMINS } from "../lib/staff-admin"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const tempPassword = process.env.STAFF_ADMIN_TEMP_PASSWORD || "ChangeMeLucie1!"

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function ensureAdmin(entry: (typeof NON_SCHEDULING_STAFF_ADMINS)[number]) {
  const email = entry.email.toLowerCase()
  const { data: listed, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  })
  if (listErr) throw listErr

  let user = listed.users.find((u) => (u.email || "").toLowerCase() === email)

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        first_name: entry.first_name,
        last_name: entry.last_name,
      },
    })
    if (error || !data.user) throw error || new Error(`create failed for ${email}`)
    user = data.user
    console.log(`✅ créé ${email} (mdp temporaire: ${tempPassword})`)
  } else {
    console.log(`ℹ️  existe déjà ${email}`)
  }

  const { error: pErr } = await admin
    .from("profiles")
    .update({
      role: "admin",
      doctor_code: entry.code,
      first_name: entry.first_name || null,
      last_name: entry.last_name || null,
      must_change_password: true,
      email,
    })
    .eq("id", user.id)

  if (pErr) throw pErr
  console.log(`   → profiles: role=admin, doctor_code=${entry.code}`)
}

async function main() {
  for (const entry of NON_SCHEDULING_STAFF_ADMINS) {
    await ensureAdmin(entry)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
