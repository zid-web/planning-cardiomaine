/**
 * Run: bunx tsx lib/__tests__/week-generation-params.test.ts
 */
import assert from "node:assert/strict"
import {
  defaultLfbDoctor,
  defaultPsslDoctor,
  defaultVisiteDoctor,
  defaultWeekGenerationParams,
  LFB_POOL,
  toSolverWeekGenerationOverrides,
  VISITE_POOL,
} from "@/lib/week-generation-params"

function main() {
  assert.deepEqual([...VISITE_POOL], ["U", "A", "B"])
  assert.deepEqual([...LFB_POOL], ["H", "S", "G"])

  // W30 → index 0
  assert.equal(defaultVisiteDoctor(30), "U")
  assert.equal(defaultVisiteDoctor(31), "A")
  assert.equal(defaultVisiteDoctor(32), "B")

  // LFB et PSSL sont suspendus de S28 à S36 : sur cette plage, le titulaire
  // par défaut est `null` (le test attendait encore un médecin).
  assert.equal(defaultLfbDoctor(30), null, "LFB suspendu en S30 (été)")
  assert.equal(defaultLfbDoctor(32), null)
  assert.equal(defaultPsslDoctor(30), null, "PSSL suspendu en S30 (été)")

  // Hors suspension, la rotation LFB est H → S → G (modulo 3).
  assert.equal(defaultLfbDoctor(37), "S")
  assert.equal(defaultLfbDoctor(38), "G")
  assert.equal(defaultLfbDoctor(39), "H")

  // PSSL : B les semaines impaires, Z les paires. Les deux booléens
  // pssl_b_active / pssl_z_active ont été remplacés par un seul `pssl_doctor`.
  assert.equal(defaultPsslDoctor(37), "B", "semaine impaire → B")
  assert.equal(defaultPsslDoctor(38), "Z", "semaine paire → Z")

  const params = defaultWeekGenerationParams(38)
  assert.equal(params.visite_doctor, defaultVisiteDoctor(38))
  assert.equal(params.lfb_doctor, "G")
  assert.equal(params.pssl_doctor, "Z")

  const overrides = toSolverWeekGenerationOverrides({
    visite_doctor: "",
    lfb_doctor: "G",
    pssl_doctor: "B",
  })
  assert.equal(overrides.visite_doctor, null)
  assert.equal(overrides.lfb_doctor, "G")
  assert.equal(overrides.pssl_doctor, "B")
  // Les flags legacy restent dérivés de pssl_doctor pour le solveur
  assert.equal(overrides.pssl_b_active, true)
  assert.equal(overrides.pssl_z_active, false)

  console.log("✅ week-generation-params tests passed")
}

main()
