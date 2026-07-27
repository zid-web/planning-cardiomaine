/**
 * Run: bunx tsx lib/__tests__/slot-blocking.test.ts
 */
import assert from "node:assert/strict"
import { generateWeekSchedule } from "@/lib/schedule-utils"
import {
  areCompatibleSamePeriod,
  canAssignDoctorToSlot,
  formatDoctorWithDoublon,
  applySlotBlockingStrips,
  isDoublonEligibleRow,
  INTERN_CODE,
} from "@/lib/slot-blocking"
import type { DoctorVacation } from "@/lib/types"

function main() {
  const weekKey = "2026-W30"
  let schedule = generateWeekSchedule(weekKey, [])

  assert.equal(areCompatibleSamePeriod("Matin - Coro", "Astreintes ATL Matin"), true)
  assert.equal(areCompatibleSamePeriod("Matin - Cs PSS", "Matin - Cs Tessée"), false)
  assert.equal(areCompatibleSamePeriod("Matin - ETT salle 1", "Matin - ETT salle 2"), true)
  assert.equal(isDoublonEligibleRow("Matin - Cs PSS"), true)
  assert.equal(isDoublonEligibleRow("Matin - EE1"), true)
  assert.equal(isDoublonEligibleRow("Apm - EE2"), true)
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

  // Doublon EE1 / EE2
  schedule["Matin - EE1"].LUNDI.value = ["G", "G"]
  assert.equal(formatDoctorWithDoublon(schedule, "LUNDI", "G", "Matin - EE1"), "G²")
  schedule["Apm - EE2"].LUNDI.value = ["DAAS", "DAAS"]
  assert.equal(formatDoctorWithDoublon(schedule, "LUNDI", "DAAS", "Apm - EE2"), "DAAS²")

  // Doublon ETT = salle 1 + salle 2
  schedule = generateWeekSchedule(weekKey, [])
  schedule["Hors site - IRM"].LUNDI.value = []
  schedule["Matin - ETT salle 1"].LUNDI.value = ["S"]
  r = canAssignDoctorToSlot("S", "2026-07-20", "Matin - ETT salle 2", "LUNDI", schedule, [])
  assert.equal(r.allowed, true, r.reason)
  schedule["Matin - ETT salle 2"].LUNDI.value = ["S"]
  assert.equal(formatDoctorWithDoublon(schedule, "LUNDI", "S", "Matin - ETT salle 1"), "S²")

  // LFB bloqué jour de garde
  schedule = generateWeekSchedule(weekKey, [])
  schedule["Garde Matin"].MARDI.value = ["G"]
  r = canAssignDoctorToSlot("G", "2026-07-21", "Hors site - LFB", "MARDI", schedule, [])
  assert.equal(r.allowed, false)
  r = canAssignDoctorToSlot("G", "2026-07-22", "Hors site - CDL", "MERCREDI", schedule, [])
  assert.equal(r.allowed, false)

  // Sans I : Garde Matin + Cs bloqué
  schedule = generateWeekSchedule(weekKey, [])
  schedule["Garde Matin"].MERCREDI.value = ["G"]
  r = canAssignDoctorToSlot("G", "2026-07-22", "Matin - Cs PSS", "MERCREDI", schedule, [])
  assert.equal(r.allowed, false, "sans I, pas de cumul Garde Matin + Cs")

  // Avec I déjà sur Garde Matin : ajouter le médecin qui a un Cs
  schedule = generateWeekSchedule(weekKey, [])
  schedule["Garde Matin"].MERCREDI.value = [INTERN_CODE]
  schedule["Matin - Cs PSS"].MERCREDI.value = ["G"]
  r = canAssignDoctorToSlot("G", "2026-07-22", "Garde Matin", "MERCREDI", schedule, [])
  assert.equal(r.allowed, true, `prospectif I+Garde: ${r.reason}`)

  // Avec I : Garde Matin + Cs / ETT / EE autorisés (un cumul clinique à la fois)
  schedule = generateWeekSchedule(weekKey, [])
  schedule["Garde Matin"].MERCREDI.value = ["G", INTERN_CODE]
  r = canAssignDoctorToSlot("G", "2026-07-22", "Matin - Cs PSS", "MERCREDI", schedule, [])
  assert.equal(r.allowed, true, r.reason)
  r = canAssignDoctorToSlot("G", "2026-07-22", "Matin - ETT salle 1", "MERCREDI", schedule, [])
  assert.equal(r.allowed, true, r.reason)
  r = canAssignDoctorToSlot("G", "2026-07-22", "Matin - EE1", "MERCREDI", schedule, [])
  assert.equal(r.allowed, true, r.reason)

  // Avec I : Coro / Rythmo / Rééducation interdits
  r = canAssignDoctorToSlot("G", "2026-07-22", "Matin - Coro", "MERCREDI", schedule, [])
  assert.equal(r.allowed, false, "Coro interdit avec I")
  r = canAssignDoctorToSlot("G", "2026-07-22", "Matin - Rythmo", "MERCREDI", schedule, [])
  assert.equal(r.allowed, false, "Rythmo interdit avec I")
  r = canAssignDoctorToSlot("G", "2026-07-22", "Apm - RÉEDUCATION", "MERCREDI", schedule, [])
  assert.equal(r.allowed, false, "Rééducation interdite avec I")

  // I uniquement sur Garde Matin
  r = canAssignDoctorToSlot(INTERN_CODE, "2026-07-22", "Matin - Cs PSS", "MERCREDI", schedule, [])
  assert.equal(r.allowed, false)
  r = canAssignDoctorToSlot(INTERN_CODE, "2026-07-22", "Garde Matin", "MERCREDI", schedule, [])
  assert.equal(r.allowed, true)

  // S + I + IRM
  schedule = generateWeekSchedule(weekKey, [])
  schedule["Garde Matin"].LUNDI.value = ["S", INTERN_CODE]
  schedule["Hors site - IRM"].LUNDI.value = ["S"]
  r = canAssignDoctorToSlot("S", "2026-07-20", "Hors site - IRM", "LUNDI", schedule, [])
  assert.equal(r.allowed, true, `S+I+IRM: ${r.reason}`)

  // S + I + EE (sans IRM sur le même créneau)
  schedule = generateWeekSchedule(weekKey, [])
  schedule["Garde Matin"].LUNDI.value = ["S", INTERN_CODE]
  schedule["Hors site - IRM"].LUNDI.value = []
  r = canAssignDoctorToSlot("S", "2026-07-20", "Matin - EE2", "LUNDI", schedule, [])
  assert.equal(r.allowed, true, `S+I+EE: ${r.reason}`)

  // Strip conserve Garde Matin + Cs avec I ; retire Coro
  schedule = generateWeekSchedule(weekKey, [])
  schedule["Garde Matin"].MERCREDI.value = ["G", INTERN_CODE]
  schedule["Matin - Cs PSS"].MERCREDI.value = ["G"]
  schedule["Matin - Coro"].MERCREDI.value = ["G"]
  schedule = applySlotBlockingStrips(schedule)
  assert.ok(schedule["Garde Matin"].MERCREDI.value.includes("G"))
  assert.ok(schedule["Matin - Cs PSS"].MERCREDI.value.includes("G"), "Cs conservé avec I")
  assert.ok(!schedule["Matin - Coro"].MERCREDI.value.includes("G"), "Coro stripé avec I")

  // Strip conserve S+I+IRM
  schedule = generateWeekSchedule(weekKey, [])
  schedule["Garde Matin"].LUNDI.value = ["S", INTERN_CODE]
  schedule["Hors site - IRM"].LUNDI.value = ["S"]
  schedule = applySlotBlockingStrips(schedule)
  assert.ok(schedule["Garde Matin"].LUNDI.value.includes("S"))
  assert.ok(schedule["Hors site - IRM"].LUNDI.value.includes("S"), "IRM conservé pour S+I")

  // Strip structurel ½-off
  schedule = generateWeekSchedule(weekKey, [])
  schedule["1/2 journée off Matin"].JEUDI.value = ["U"]
  schedule["Matin - Coro"].JEUDI.value = ["U"]
  schedule = applySlotBlockingStrips(schedule)
  assert.ok(!schedule["Matin - Coro"].JEUDI.value.includes("U"))

  console.log("✅ slot-blocking tests passed")
}

main()
