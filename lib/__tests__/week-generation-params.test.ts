/**
 * Run: bunx tsx lib/__tests__/week-generation-params.test.ts
 */
import assert from "node:assert/strict"
import {
  defaultLfbDoctor,
  defaultPsslFlags,
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
  assert.equal(defaultLfbDoctor(30), "H")
  assert.equal(defaultVisiteDoctor(31), "A")
  assert.equal(defaultLfbDoctor(31), "S")
  assert.equal(defaultVisiteDoctor(32), "B")
  assert.equal(defaultLfbDoctor(32), "G")

  const odd = defaultPsslFlags(31)
  assert.equal(odd.pssl_b_active, true)
  assert.equal(odd.pssl_z_active, false)
  const even = defaultPsslFlags(30)
  assert.equal(even.pssl_b_active, false)
  assert.equal(even.pssl_z_active, true)

  const params = defaultWeekGenerationParams(30)
  assert.equal(params.visite_doctor, "U")
  assert.equal(params.lfb_doctor, "H")
  assert.equal(params.pssl_z_active, true)

  const overrides = toSolverWeekGenerationOverrides({
    visite_doctor: "",
    lfb_doctor: "G",
    pssl_b_active: true,
    pssl_z_active: false,
  })
  assert.equal(overrides.visite_doctor, null)
  assert.equal(overrides.lfb_doctor, "G")
  assert.equal(overrides.pssl_b_active, true)
  assert.equal(overrides.pssl_z_active, false)

  console.log("✅ week-generation-params tests passed")
}

main()
