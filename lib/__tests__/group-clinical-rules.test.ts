/**
 * Run: npx tsx lib/__tests__/group-clinical-rules.test.ts
 */
import assert from "node:assert/strict"
import { applyFixedClinicalAssignments } from "@/lib/fixed-assignments"
import {
  DOC022_CLINICAL_ELIGIBILITY,
  DOC022_DOCTOR_NAMES,
  DOC022_FIXED_CLINICAL_SLOTS,
  isAtlEligibleForCell,
  toSolverClinicalRulesPayload,
} from "@/lib/group-clinical-rules"
import { generateWeekSchedule } from "@/lib/schedule-utils"

/** Les pools sont `as const` : élargir pour pouvoir tester une non-appartenance. */
const asCodes = (list: readonly string[]): readonly string[] => list

function main() {
  assert.equal(DOC022_DOCTOR_NAMES.S, "Saint André")
  assert.equal(DOC022_DOCTOR_NAMES.M, "Zid")
  assert.ok(asCodes(DOC022_CLINICAL_ELIGIBILITY.irm).includes("S"))
  assert.ok(asCodes(DOC022_CLINICAL_ELIGIBILITY.coro).includes("W"))
  assert.ok(!asCodes(DOC022_CLINICAL_ELIGIBILITY.stress).includes("W"), "W non éligible Stress")
  assert.ok(asCodes(DOC022_CLINICAL_ELIGIBILITY.reeduc).includes("R"), "R éligible rééducation")
  assert.deepEqual(
    [...DOC022_CLINICAL_ELIGIBILITY.atl].sort(),
    ["CH", "M", "O", "W"].sort(),
    "ATL pool général = M/O/W/CH",
  )
  assert.ok(!asCodes(DOC022_CLINICAL_ELIGIBILITY.atl).includes("FV"), "FV hors pool ATL général")
  assert.equal(isAtlEligibleForCell("FV", "Astreintes ATL Midi", "JEUDI"), true)
  assert.equal(isAtlEligibleForCell("FV", "Astreintes ATL Matin", "JEUDI"), false)
  assert.equal(isAtlEligibleForCell("FV", "Astreintes ATL Midi", "MARDI"), false)
  assert.equal(isAtlEligibleForCell("FV", "Astreintes ATL Nuit", "JEUDI"), false)
  assert.equal(isAtlEligibleForCell("W", "Astreintes ATL Matin", "LUNDI"), true)
  assert.ok(!asCodes(DOC022_CLINICAL_ELIGIBILITY.atl).includes("R"))
  assert.ok(!asCodes(DOC022_CLINICAL_ELIGIBILITY.atl).includes("V"))
  assert.ok(!asCodes(DOC022_CLINICAL_ELIGIBILITY.atl).includes("T"))
  assert.ok(!asCodes(DOC022_CLINICAL_ELIGIBILITY.atl).includes("G"))
  assert.ok(DOC022_FIXED_CLINICAL_SLOTS.length >= 5)

  const payload = toSolverClinicalRulesPayload()
  // `clinical_eligibility` a été éclatée en clés séparées (*_allowed) :
  // on vérifie désormais celles réellement envoyées au solveur.
  assert.ok(Array.isArray(payload.reeduc_allowed))
  assert.ok(Array.isArray(payload.rythmo_allowed))
  assert.ok(Array.isArray(payload.nct_allowed))
  assert.ok(Array.isArray(payload.half_days_off))
  assert.deepEqual([...payload.astreinte_allowed].sort(), ["CH", "M", "O", "W"].sort())
  assert.ok(!asCodes(payload.astreinte_allowed).includes("FV"))
  assert.ok(asCodes(payload.coro_allowed).includes("FV"), "FV reste éligible Coro")
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
  // EE2 matin n'a plus de créneau fixe : les réservations DOC022 « Lefebvre »
  // (lundi) et « Bros » (vendredi) sont devenues des préférences souples
  // (H / R / O — voir lib/vacation-preferences.ts).
  assert.equal(
    DOC022_FIXED_CLINICAL_SLOTS.some((slot) => slot.row === "Matin - EE2"),
    false,
    "plus aucun créneau fixe sur EE2 matin",
  )
  assert.deepEqual(schedule["Matin - EE2"].LUNDI.value, [])
  assert.deepEqual(schedule["Matin - EE2"].VENDREDI.value, [])
  // EE1 mercredi après-midi est en revanche réservé à T (consigne 26/08/2026)
  assert.ok(schedule["Apm - EE1"].MERCREDI.value.includes("T"), "T sur EE1 mercredi apm")
  assert.ok(schedule["Hors site - Scinti"].LUNDI.value.includes("T"))
  assert.ok(schedule["Hors site - Scinti"].MARDI.value.includes("R"))
  assert.ok(schedule["Hors site - Scinti"].MERCREDI.value.includes("T"))
  // IRM / DAAS inchangés
  assert.ok(schedule["Hors site - IRM"].LUNDI.value.includes("S"))
  assert.ok(schedule["Apm - EE2"].LUNDI.value.includes("DAAS"))

  console.log("✅ group-clinical-rules / DOC022 fixed slots tests passed")
}

main()
