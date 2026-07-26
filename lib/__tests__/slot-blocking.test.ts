/**
 * Run: npx tsx lib/__tests__/slot-blocking.test.ts
 */
import assert from "node:assert/strict"
import { generateWeekSchedule } from "@/lib/schedule-utils"
import {
  areCompatibleSamePeriod,
  canAssignDoctorToSlot,
  formatDoctorWithDoublon,
  applySlotBlockingStrips,
} from "@/lib/slot-blocking"
import type { DoctorVacation } from "@/lib/types"

function main() {
  const weekKey = "2026-W30"
  let schedule = generateWeekSchedule(weekKey, [])

  assert.equal(areCompatibleSamePeriod("Matin - Coro", "Astreintes ATL Matin"), true)
  assert.equal(areCompatibleSamePeriod("Matin - Cs PSS", "Matin - Cs Tessée"), true)
  assert.equal(areCompatibleSamePeriod("Matin - ETT salle 1", "Matin - ETT salle 2"), true)
  assert.equal(areCompatibleSamePeriod("Matin - Cs PSS", "Matin - Coro"), false)

  // Congés bloquent
  const vacations: DoctorVacation[] = [
    {
      id: "1",
      doctor_id: "W",
      start_date: "2026-07-20",
      end_date: "2026-07-20",
      created_at: "",
      updated_at: "",
    },
  ]
  let r = canAssignDoctorToSlot("W", "2026-07-20", "Matin - Coro", "LUNDI", schedule, vacations)
  assert.equal(r.allowed, false)

  // ½ off Apm → pas de Coro apm
  schedule["1/2 journée off Après-midi"].LUNDI.value = ["O"]
  r = canAssignDoctorToSlot("O", "2026-07-20", "Apm - Coro", "LUNDI", schedule, [])
  assert.equal(r.allowed, false)
  r = canAssignDoctorToSlot("O", "2026-07-20", "Matin - Coro", "LUNDI", schedule, [])
  assert.equal(r.allowed, true)

  // Exclusion mutuelle matin (sauf ATL+Coro)
  schedule = generateWeekSchedule(weekKey, [])
  schedule["Matin - Cs PSS"].LUNDI.value = ["M"]
  r = canAssignDoctorToSlot("M", "2026-07-20", "Matin - Rythmo", "LUNDI", schedule, [])
  assert.equal(r.allowed, false)
  schedule["Matin - Coro"].LUNDI.value = ["M"]
  schedule["Matin - Cs PSS"].LUNDI.value = []
  r = canAssignDoctorToSlot("M", "2026-07-20", "Astreintes ATL Matin", "LUNDI", schedule, [])
  assert.equal(r.allowed, true)

  // Doublon Cs OK + affichage ²
  schedule = generateWeekSchedule(weekKey, [])
  schedule["Matin - Cs PSS"].LUNDI.value = ["B"]
  r = canAssignDoctorToSlot("B", "2026-07-20", "Matin - Cs Tessée", "LUNDI", schedule, [])
  assert.equal(r.allowed, true)
  schedule["Matin - Cs Tessée"].LUNDI.value = ["B"]
  assert.equal(formatDoctorWithDoublon(schedule, "LUNDI", "B", "Matin - Cs PSS"), "B²")

  // LFB bloqué jour de garde
  schedule = generateWeekSchedule(weekKey, [])
  schedule["Garde Matin"].MARDI.value = ["G"]
  r = canAssignDoctorToSlot("G", "2026-07-21", "Hors site - LFB", "MARDI", schedule, [])
  assert.equal(r.allowed, false)
  // Lendemain
  r = canAssignDoctorToSlot("G", "2026-07-22", "Hors site - CDL", "MERCREDI", schedule, [])
  assert.equal(r.allowed, false)

  // Strip structurel ½-off
  schedule = generateWeekSchedule(weekKey, [])
  schedule["1/2 journée off Matin"].JEUDI.value = ["U"]
  schedule["Matin - Coro"].JEUDI.value = ["U"]
  schedule = applySlotBlockingStrips(schedule)
  assert.ok(!schedule["Matin - Coro"].JEUDI.value.includes("U"))

  console.log("✅ slot-blocking tests passed")
}

main()
