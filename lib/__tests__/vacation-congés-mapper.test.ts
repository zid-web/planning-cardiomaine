/**
 * Run: npx tsx lib/__tests__/vacation-congés-mapper.test.ts
 */
import assert from "node:assert/strict"
import { detectConflict } from "@/lib/assignment-validation"
import { generateWeekSchedule } from "@/lib/schedule-utils"
import {
  mergeVacancesIntoConges,
  normalizeLeaveSchedule,
  stripDoctorsOnLeaveFromOtherRows,
} from "@/lib/vacation-congés-mapper"
import type { DoctorVacation } from "@/lib/types"

function main() {
  const weekKey = "2026-W30" // Lundi 2026-07-20
  const vacations: DoctorVacation[] = [
    {
      id: "1",
      doctor_id: "Z",
      start_date: "2026-07-20",
      end_date: "2026-07-22",
      created_at: "",
      updated_at: "",
    },
  ]

  // Merge ancienne ligne Vacances → Congés
  const withLegacy = generateWeekSchedule(weekKey)
  withLegacy["Vacances"] = structuredClone(withLegacy["Congés"])
  withLegacy["Vacances"].LUNDI.value = ["Z"]
  withLegacy["Vacances"].LUNDI.type = "doctor"
  withLegacy["Congés"].LUNDI.value = ["P"]
  withLegacy["Congés"].LUNDI.type = "doctor"

  const merged = mergeVacancesIntoConges(withLegacy)
  assert.equal(merged["Vacances"], undefined)
  assert.ok(merged["Congés"].LUNDI.value.includes("Z"))
  assert.ok(merged["Congés"].LUNDI.value.includes("P"))

  // Strip : médecin en congé retiré des autres lignes (dont 1/2 off)
  let schedule = generateWeekSchedule(weekKey)
  schedule["Congés"].LUNDI.value = ["Z"]
  schedule["Congés"].LUNDI.type = "doctor"
  schedule["1/2 journée off Matin"].LUNDI.value = ["Z", "A"]
  schedule["1/2 journée off Matin"].LUNDI.type = "doctor"
  schedule["Matin - Coro"].LUNDI.value = ["Z", "W"]
  schedule["Matin - Coro"].LUNDI.type = "doctor"
  schedule["Apm - Coro"].MARDI.value = ["Z"] // Z en congé mardi aussi
  schedule["Apm - Coro"].MARDI.type = "doctor"

  schedule = stripDoctorsOnLeaveFromOtherRows(schedule, vacations, weekKey)
  assert.deepEqual(schedule["1/2 journée off Matin"].LUNDI.value, ["A"])
  assert.deepEqual(schedule["Matin - Coro"].LUNDI.value, ["W"])
  assert.deepEqual(schedule["Congés"].LUNDI.value, ["Z"], "Congés conservé")
  assert.deepEqual(schedule["Apm - Coro"].MARDI.value, [])

  // Pipeline complet + couleurs : pas de conflit sur la ligne Congés
  const normalized = normalizeLeaveSchedule(generateWeekSchedule(weekKey), vacations, weekKey)
  assert.ok(normalized["Congés"].LUNDI.value.includes("Z"))
  assert.equal(normalized["Vacances"], undefined)

  const conflictOnConges = detectConflict("Z", "2026-07-20", "Congés", vacations)
  assert.equal(conflictOnConges.hasConflict, false)

  const conflictOnCoro = detectConflict("Z", "2026-07-20", "Matin - Coro", vacations)
  assert.equal(conflictOnCoro.hasConflict, true)

  console.log("✅ vacation-congés-mapper tests passed")
}

main()
