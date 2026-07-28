/**
 * Run: npx tsx lib/__tests__/group-clinical-rules.test.ts
 */
import assert from "node:assert/strict"
import { applyFixedClinicalAssignments } from "@/lib/fixed-assignments"
import {
  DOC022_CLINICAL_ELIGIBILITY,
  DOC022_DOCTOR_NAMES,
  DOC022_FIXED_CLINICAL_SLOTS,
  toSolverClinicalRulesPayload,
} from "@/lib/group-clinical-rules"
import { generateWeekSchedule } from "@/lib/schedule-utils"

function main() {
  assert.equal(DOC022_DOCTOR_NAMES.S, "Saint André")
  assert.equal(DOC022_DOCTOR_NAMES.M, "Zid")
  assert.ok(DOC022_CLINICAL_ELIGIBILITY.irm.includes("S"))
  assert.ok(DOC022_CLINICAL_ELIGIBILITY.coro.includes("W"))
  assert.ok(DOC022_FIXED_CLINICAL_SLOTS.length >= 5)

  const payload = toSolverClinicalRulesPayload()
  assert.ok(payload.clinical_eligibility)
  assert.ok(Array.isArray(payload.doc022_fixed_slots))
  assert.ok(payload.doc022_fixed_slots.some((s) => s.doctor === "P"))

  const weekKey = "2026-W30"
  let schedule = generateWeekSchedule(weekKey, [])
  schedule = applyFixedClinicalAssignments(schedule, weekKey, [])

  assert.ok(
    schedule["Matin - ETT salle 1"].LUNDI.value.includes("P"),
    "Poret ECHO1 lundi matin",
  )
  assert.ok(
    schedule["Apm - ETT salle 1"].MERCREDI.value.includes("S"),
    "Saint André écho enfants mercredi apm",
  )
  assert.ok(schedule["Matin - EE2"].LUNDI.value.includes("V"), "Lefebvre EE2 lundi matin")
  assert.ok(schedule["Matin - EE2"].VENDREDI.value.includes("O"), "Bros EE2 vendredi matin")
  assert.ok(schedule["Hors site - Scinti"].LUNDI.value.includes("T"))
  assert.ok(schedule["Hors site - Scinti"].MARDI.value.includes("R"))
  assert.ok(schedule["Hors site - Scinti"].MERCREDI.value.includes("T"))
  // IRM / DAAS inchangés
  assert.ok(schedule["Hors site - IRM"].LUNDI.value.includes("S"))
  assert.ok(schedule["Apm - EE2"].LUNDI.value.includes("DAAS"))

  console.log("✅ group-clinical-rules / DOC022 fixed slots tests passed")
}

main()
