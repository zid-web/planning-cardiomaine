/**
 * Run: npx tsx lib/__tests__/fixed-assignments.test.ts
 */
import assert from "node:assert/strict"
import {
  applyFixedClinicalAssignments,
  clearFixedAssigneesOnVacation,
  VISITE_ROTATION,
} from "@/lib/fixed-assignments"
import {
  getCellDisplayAssignees,
  normalizeRemplacantLabel,
  isListedDoctor,
} from "@/lib/doctor-code"
import { generateWeekSchedule } from "@/lib/schedule-utils"
import type { DoctorVacation } from "@/lib/types"

function main() {
  const weekKey = "2026-W30" // week 30 → Visite rotation index 30 % 3 = 0 → U
  const schedule = generateWeekSchedule(weekKey)

  assert.deepEqual(schedule["Hors site - IRM"].LUNDI.value, ["S"])
  assert.deepEqual(schedule["Hors site - IRM"].VENDREDI.value, ["S"])
  assert.deepEqual(schedule["Hors site - IRM"].MARDI.value, [])

  assert.deepEqual(schedule["Garde Nuit"].LUNDI.value, ["FV"])
  assert.deepEqual(schedule["Apm - Coro"].JEUDI.value, ["FV"])

  assert.deepEqual(schedule["Apm - EE2"].LUNDI.value, ["DAAS"])

  assert.deepEqual(schedule["Apm - Rythmo"].LUNDI.value, ["A"])
  assert.deepEqual(schedule["Apm - Rythmo"].JEUDI.value, ["A"])

  const visite = VISITE_ROTATION[30 % 3]
  assert.equal(visite, "U")
  assert.deepEqual(schedule["Matin - Visite"].LUNDI.value, [visite])

  // Vacances S + FV le lundi → IRM / Garde Nuit lundi vides
  const vacations: DoctorVacation[] = [
    {
      id: "1",
      doctor_id: "S",
      start_date: "2026-07-20",
      end_date: "2026-07-20",
      reason: "test",
    },
    {
      id: "2",
      doctor_id: "FV",
      start_date: "2026-07-20",
      end_date: "2026-07-20",
      reason: "test",
    },
  ]
  // 2026-W30 Monday = 2026-07-20
  const withVac = generateWeekSchedule(weekKey, vacations)
  assert.deepEqual(withVac["Hors site - IRM"].LUNDI.value, [], "S en vacances → pas d’IRM lundi")
  assert.deepEqual(withVac["Hors site - IRM"].VENDREDI.value, ["S"])
  assert.deepEqual(withVac["Garde Nuit"].LUNDI.value, [], "FV en vacances → pas de garde lundi")

  const cleared = clearFixedAssigneesOnVacation(schedule, weekKey, vacations)
  assert.ok(!cleared["Hors site - IRM"].LUNDI.value.includes("S"))
  assert.ok(!cleared["Garde Nuit"].LUNDI.value.includes("FV"))

  assert.equal(isListedDoctor("DAAS"), true)
  assert.equal(isListedDoctor("Dr Martin"), false)
  assert.equal(normalizeRemplacantLabel("  Dr Martin  "), "Dr Martin")
  assert.equal(normalizeRemplacantLabel("A"), null)
  assert.equal(normalizeRemplacantLabel(""), null)

  assert.deepEqual(
    getCellDisplayAssignees({
      value: ["W"],
      remplacant: "Dr Martin",
      status: "validated",
      type: "doctor",
    }),
    ["W", "Dr Martin"],
  )
  assert.deepEqual(
    getCellDisplayAssignees({
      value: ["W", "Dr Martin"],
      remplacant: "Dr Martin",
      status: "validated",
      type: "doctor",
    }),
    ["W", "Dr Martin"],
  )

  console.log("✅ fixed-assignments + remplacant tests passed")
}

main()
