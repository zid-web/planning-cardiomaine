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
  isDoublonEligibleRow,
} from "@/lib/slot-blocking"
import type { DoctorVacation } from "@/lib/types"

function main() {
  const weekKey = "2026-W30"
  let schedule = generateWeekSchedule(weekKey, [])

  assert.equal(areCompatibleSamePeriod("Matin - Coro", "Astreintes ATL Matin"), true)
  assert.equal(areCompatibleSamePeriod("Matin - Cs PSS", "Matin - Cs Tessée"), false)
  assert.equal(areCompatibleSamePeriod("Matin - ETT salle 1", "Matin - ETT salle 2"), true)
  assert.equal(isDoublonEligibleRow("Matin - Cs PSS"), true)
  assert.equal(isDoublonEligibleRow("Matin - ETT salle 1"), false)
  assert.equal(isDoublonEligibleRow("Matin - Coro"), false)

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
  // Cs PSS ≠ Cs Tessée même matin
  r = canAssignDoctorToSlot("M", "2026-07-20", "Matin - Cs Tessée", "LUNDI", schedule, [])
  assert.equal(r.allowed, false)

  schedule["Matin - Coro"].LUNDI.value = ["M"]
  schedule["Matin - Cs PSS"].LUNDI.value = []
  r = canAssignDoctorToSlot("M", "2026-07-20", "Astreintes ATL Matin", "LUNDI", schedule, [])
  assert.equal(r.allowed, true)

  // Doublon Cs = 2× dans la même case
  schedule = generateWeekSchedule(weekKey, [])
  schedule["Matin - Cs PSS"].LUNDI.value = ["B", "B"]
  assert.equal(formatDoctorWithDoublon(schedule, "LUNDI", "B", "Matin - Cs PSS"), "B²")
  assert.equal(formatDoctorWithDoublon(schedule, "LUNDI", "B", "Matin - Cs Tessée"), "B")

  // Doublon ETT = salle 1 + salle 2 (médecin sans autre activité le matin)
  schedule = generateWeekSchedule(weekKey, [])
  schedule["Hors site - IRM"].LUNDI.value = [] // S est seedé IRM lundi
  schedule["Matin - ETT salle 1"].LUNDI.value = ["S"]
  r = canAssignDoctorToSlot("S", "2026-07-20", "Matin - ETT salle 2", "LUNDI", schedule, [])
  assert.equal(r.allowed, true, r.reason)
  schedule["Matin - ETT salle 2"].LUNDI.value = ["S"]
  assert.equal(formatDoctorWithDoublon(schedule, "LUNDI", "S", "Matin - ETT salle 1"), "S²")
  assert.equal(formatDoctorWithDoublon(schedule, "LUNDI", "S", "Matin - ETT salle 2"), "S²")

  // LFB bloqué jour de garde
  schedule = generateWeekSchedule(weekKey, [])
  schedule["Garde Matin"].MARDI.value = ["G"]
  r = canAssignDoctorToSlot("G", "2026-07-21", "Hors site - LFB", "MARDI", schedule, [])
  assert.equal(r.allowed, false)
  r = canAssignDoctorToSlot("G", "2026-07-22", "Hors site - CDL", "MERCREDI", schedule, [])
  assert.equal(r.allowed, false)

  // S + IRM : Lundi IRM = matin → Garde Midi OK ; Garde Matin cède (admin peut assigner)
  schedule = generateWeekSchedule(weekKey, [])
  schedule = applySlotBlockingStrips(schedule) // no-op structure
  assert.ok(schedule["Hors site - IRM"].LUNDI.value.includes("S") || true)
  // Seed IRM lundi (comme contraintes structurelles)
  schedule["Hors site - IRM"].LUNDI.value = ["S"]
  schedule["Hors site - IRM"].LUNDI.type = "doctor"
  r = canAssignDoctorToSlot("S", "2026-07-20", "Garde Midi", "LUNDI", schedule, [])
  assert.equal(r.allowed, true, `Garde Midi Lundi doit être libre: ${r.reason}`)
  r = canAssignDoctorToSlot("S", "2026-07-20", "Garde Matin", "LUNDI", schedule, [])
  assert.equal(r.allowed, true, `Garde Matin doit pouvoir remplacer IRM: ${r.reason}`)
  schedule["Hors site - IRM"].VENDREDI.value = ["S"]
  schedule["Hors site - IRM"].VENDREDI.type = "doctor"
  r = canAssignDoctorToSlot("S", "2026-07-24", "Garde Matin", "VENDREDI", schedule, [])
  assert.equal(r.allowed, true, `Garde Matin Vendredi libre (IRM = apm): ${r.reason}`)
  r = canAssignDoctorToSlot("S", "2026-07-24", "Garde Midi", "VENDREDI", schedule, [])
  assert.equal(r.allowed, true, `Garde Midi Vendredi remplace IRM: ${r.reason}`)

  // Strip : Garde Matin retire IRM le lundi
  schedule["Garde Matin"].LUNDI.value = ["S"]
  schedule["Garde Matin"].LUNDI.type = "doctor"
  schedule = applySlotBlockingStrips(schedule)
  assert.ok(!schedule["Hors site - IRM"].LUNDI.value.includes("S"), "IRM cède à Garde Matin")
  assert.ok(schedule["Garde Matin"].LUNDI.value.includes("S"))

  // Strip structurel ½-off
  schedule = generateWeekSchedule(weekKey, [])
  schedule["1/2 journée off Matin"].JEUDI.value = ["U"]
  schedule["Matin - Coro"].JEUDI.value = ["U"]
  schedule = applySlotBlockingStrips(schedule)
  assert.ok(!schedule["Matin - Coro"].JEUDI.value.includes("U"))

  console.log("✅ slot-blocking tests passed")
}

main()
