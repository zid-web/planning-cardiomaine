/**
 * Run: bunx tsx lib/__tests__/supabase-config.test.ts
 */
import assert from "node:assert/strict"
import {
  resolveSupabaseConfig,
  SUPABASE_PROJECT_ANON_KEY,
  SUPABASE_PROJECT_URL,
} from "@/lib/supabase/config"

function main() {
  // Aucune variable : projet de production
  let c = resolveSupabaseConfig(undefined, undefined)
  assert.equal(c.url, SUPABASE_PROJECT_URL)
  assert.equal(c.anonKey, SUPABASE_PROJECT_ANON_KEY)
  assert.equal(c.source, "project")
  assert.equal(c.ignoredEnvUrl, undefined)

  // Variables de l'intégration Vercel (autre projet) : ignorées, signalées
  c = resolveSupabaseConfig("https://cdvzcrworcjwtxjdymen.supabase.co", "sb_publishable_xxx")
  assert.equal(c.url, SUPABASE_PROJECT_URL)
  assert.equal(c.anonKey, SUPABASE_PROJECT_ANON_KEY)
  assert.equal(c.source, "project")
  assert.equal(c.ignoredEnvUrl, "https://cdvzcrworcjwtxjdymen.supabase.co")

  // Même projet dans l'environnement : rien à signaler, et la clé reste celle du code
  c = resolveSupabaseConfig(SUPABASE_PROJECT_URL, "autre-cle")
  assert.equal(c.anonKey, SUPABASE_PROJECT_ANON_KEY)
  assert.equal(c.ignoredEnvUrl, undefined)

  // Supabase local (tests de bout en bout) : l'environnement est respecté
  for (const url of ["http://127.0.0.1:54321", "http://localhost:54321", "https://localhost"]) {
    c = resolveSupabaseConfig(url, "cle-locale")
    assert.equal(c.source, "local-env", url)
    assert.equal(c.url, url)
    assert.equal(c.anonKey, "cle-locale")
  }
  // Local sans clé : on ne bascule pas sur une configuration incomplète
  c = resolveSupabaseConfig("http://127.0.0.1:54321", undefined)
  assert.equal(c.source, "project")
  // Un hôte qui ressemble à localhost n'est pas local
  c = resolveSupabaseConfig("https://localhost.evil.example", "k")
  assert.equal(c.source, "project")

  // La clé anon codée appartient bien au projet de l'adresse (champ ref du JWT)
  const payload = JSON.parse(Buffer.from(SUPABASE_PROJECT_ANON_KEY.split(".")[1], "base64url").toString())
  assert.equal(`https://${payload.ref}.supabase.co`, SUPABASE_PROJECT_URL)
  assert.equal(payload.role, "anon")

  console.log("✅ supabase-config tests passed")
}

main()
