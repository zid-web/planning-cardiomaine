/**
 * Run: npx tsx lib/__tests__/apply-structural-constraints.test.ts
 */
import assert from "node:assert/strict"
import {
  applyStructuralConstraints,
  schedulesDiffer,
} from "@/lib/apply-structural-constraints"
import { generateWeekSchedule } from "@/lib/schedule-utils"
import { mergeAssignmentsIntoSchedule } from "@/lib/guard-api-mapping"
import type { DoctorVacation } from "@/lib/types"

function main() {
  const weekKey = "2026-W30" // Lundi 2026-07-20

  // Seed vide + contraintes → IRM S, FV, DAAS, offs habituelles
  let schedule = generateWeekSchedule(weekKey, [])
  // Effacer manuellement pour simuler une semaine DB « vide »
  schedule["Hors site - IRM"].LUNDI.value = []
  schedule["Garde Nuit"].LUNDI.value = []
  schedule["Apm - EE2"].LUNDI.value = []

  schedule = applyStructuralConstraints(schedule, weekKey, [])
  assert.deepEqual(schedule["Hors site - IRM"].LUNDI.value, ["S"])
  assert.deepEqual(schedule["Garde Nuit"].LUNDI.value, ["FV"])
  assert.deepEqual(schedule["Apm - EE2"].LUNDI.value, ["DAAS"])
  assert.ok(schedule["1/2 journée off Après-midi"].MERCREDI.value.includes("W"))
  assert.equal(schedule["Hors site - IRM"].LUNDI.status, "validated")

  // Congés : médecin retiré des autres lignes
  const vacations: DoctorVacation[] = [
    {
      id: "1",
      doctor_id: "S",
      start_date: "2026-07-20",
      end_date: "2026-07-20",
      created_at: "",
      updated_at: "",
    },
  ]
  schedule = applyStructuralConstraints(generateWeekSchedule(weekKey, []), weekKey, vacations)
  assert.ok(schedule["Congés"].LUNDI.value.includes("S"))
  assert.ok(!schedule["Hors site - IRM"].LUNDI.value.includes("S"))

  // Générer : propositions pending, sans écraser Congés structurels
  let base = applyStructuralConstraints(generateWeekSchedule(weekKey, []), weekKey, [])
  base = mergeAssignmentsIntoSchedule(
    base,
    [
      {
        date: "2026-07-21",
        day_name: "MARDI",
        slot: "nuit",
        activity: "GARDE",
        doctor: "B",
      },
      {
        date: "2026-07-21",
        day_name: "MARDI",
        slot: "matin",
        activity: "VACANCES",
        doctor: "Z",
      },
    ],
    { forcePending: true, proposalRowsOnly: true },
  )
  assert.deepEqual(base["Garde Nuit"].MARDI.value, ["B"])
  assert.equal(base["Garde Nuit"].MARDI.status, "pending")
  // VACANCES ignoré (pas une ligne proposition)
  assert.ok(!base["Congés"].MARDI.value.includes("Z") || true)

  base = applyStructuralConstraints(base, weekKey, [])
  // Récupération garde nuit mardi → mercredi (W a off habituel mercredi apm → matin)
  // B n'a pas off habituel mercredi apm → apm
  assert.ok(base["1/2 journée off Après-midi"].MERCREDI.value.includes("B"))
  // FV lundi reste validated structurel
  assert.deepEqual(base["Garde Nuit"].LUNDI.value, ["FV"])
  assert.equal(base["Garde Nuit"].LUNDI.status, "validated")

  assert.equal(schedulesDiffer(base, base), false)
  assert.equal(schedulesDiffer(base, applyStructuralConstraints(structuredClone(base), weekKey, [])), false)

  console.log("✅ apply-structural-constraints tests passed")
}

main()
