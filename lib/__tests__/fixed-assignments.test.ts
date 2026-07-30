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
  assert.deepEqual(schedule["Matin - Rythmo"].MARDI.value, ["P"])
  assert.deepEqual(schedule["Apm - Rythmo"].MARDI.value, ["P"])
  // W30 paire : U Mer matin+apm ; Ven matin U (alternance)
  assert.deepEqual(schedule["Matin - Rythmo"].MERCREDI.value, ["U"])
  assert.deepEqual(schedule["Apm - Rythmo"].MERCREDI.value, ["U"])
  assert.deepEqual(schedule["Matin - Rythmo"].VENDREDI.value, ["U"])
  assert.deepEqual(schedule["Apm - Rythmo"].VENDREDI.value, [])

  // W31 impaire : U Mer apm + Ven apm ; pas Mer matin / pas Ven matin
  const odd = applyFixedClinicalAssignments(generateWeekSchedule("2026-W31"), "2026-W31")
  assert.deepEqual(odd["Apm - Rythmo"].MERCREDI.value, ["U"])
  assert.deepEqual(odd["Matin - Rythmo"].MERCREDI.value, [])
  assert.deepEqual(odd["Apm - Rythmo"].VENDREDI.value, ["U"])
  assert.deepEqual(odd["Matin - Rythmo"].VENDREDI.value, [])

  // W32 paire : Ven matin = P (alternance)
  const even32 = applyFixedClinicalAssignments(generateWeekSchedule("2026-W32"), "2026-W32")
  assert.deepEqual(even32["Matin - Rythmo"].VENDREDI.value, ["P"])
  assert.deepEqual(even32["Matin - Rythmo"].MERCREDI.value, ["U"])
  assert.deepEqual(even32["Apm - Rythmo"].MERCREDI.value, ["U"])

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

  // Rythmo : contrainte saute dès que P / U / A est en congés
  const rythmoVac: DoctorVacation[] = [
    {
      id: "a",
      doctor_id: "A",
      start_date: "2026-07-20",
      end_date: "2026-07-20",
      reason: "test",
    },
    {
      id: "p",
      doctor_id: "P",
      start_date: "2026-07-21",
      end_date: "2026-07-21",
      reason: "test",
    },
    {
      id: "u",
      doctor_id: "U",
      start_date: "2026-07-22",
      end_date: "2026-07-22",
      reason: "test",
    },
  ]
  const rythmoOff = applyFixedClinicalAssignments(
    generateWeekSchedule(weekKey, []),
    weekKey,
    rythmoVac,
  )
  assert.deepEqual(rythmoOff["Apm - Rythmo"].LUNDI.value, [], "A en congés → pas de Rythmo lundi")
  assert.deepEqual(rythmoOff["Apm - Rythmo"].JEUDI.value, ["A"], "A présent jeudi → Rythmo OK")
  assert.deepEqual(rythmoOff["Matin - Rythmo"].MARDI.value, [], "P en congés → pas de Rythmo mardi matin")
  assert.deepEqual(rythmoOff["Apm - Rythmo"].MARDI.value, [], "P en congés → pas de Rythmo mardi apm")
  assert.deepEqual(rythmoOff["Apm - Rythmo"].MERCREDI.value, [], "U en congés → pas de Rythmo mercredi")

  // Congés déjà sur la ligne (sans doctor_vacations) → saute aussi
  const withCongesOnly = generateWeekSchedule(weekKey, [])
  withCongesOnly["Congés"].LUNDI = { value: ["A"], type: "doctor", status: "validated" }
  withCongesOnly["Apm - Rythmo"].LUNDI = { value: ["A"], type: "doctor", status: "validated" }
  applyFixedClinicalAssignments(withCongesOnly, weekKey, [])
  assert.deepEqual(
    withCongesOnly["Apm - Rythmo"].LUNDI.value,
    [],
    "A sur Congés → Rythmo lundi sauté même sans liste vacations",
  )

  // U en congés mercredi → case libre ; P manuel conservé après ré-injection
  const uOffWed: DoctorVacation[] = [
    {
      id: "u2",
      doctor_id: "U",
      start_date: "2026-07-22",
      end_date: "2026-07-22",
      reason: "test",
    },
  ]
  let freeWed = generateWeekSchedule(weekKey, [])
  freeWed = applyFixedClinicalAssignments(freeWed, weekKey, uOffWed)
  assert.deepEqual(freeWed["Apm - Rythmo"].MERCREDI.value, [], "U absent → Rythmo mercredi libre")
  freeWed["Apm - Rythmo"].MERCREDI = { value: ["P"], type: "doctor", status: "validated" }
  freeWed["Congés"].MERCREDI = { value: ["U"], type: "doctor", status: "validated" }
  freeWed = applyFixedClinicalAssignments(freeWed, weekKey, uOffWed)
  assert.deepEqual(
    freeWed["Apm - Rythmo"].MERCREDI.value,
    ["P"],
    "P manuel conservé quand U est en congés",
  )

  // Avant chargement congés : ne pas écraser P par U
  let beforeReady = generateWeekSchedule(weekKey, [])
  beforeReady["Apm - Rythmo"].MERCREDI = { value: ["P"], type: "doctor", status: "validated" }
  beforeReady = applyFixedClinicalAssignments(beforeReady, weekKey, [], { vacationsReady: false })
  assert.deepEqual(
    beforeReady["Apm - Rythmo"].MERCREDI.value,
    ["P"],
    "vacationsReady=false → ne pas écraser P",
  )

  // Saisie manuelle prime même si le titulaire fixe est présent (U disponible)
  let manualRythmo = generateWeekSchedule(weekKey, [])
  manualRythmo["Apm - Rythmo"].MERCREDI = { value: ["P"], type: "doctor", status: "validated" }
  manualRythmo = applyFixedClinicalAssignments(manualRythmo, weekKey, [])
  assert.deepEqual(
    manualRythmo["Apm - Rythmo"].MERCREDI.value,
    ["P"],
    "P manuel conservé même si U est disponible",
  )

  // ETT ped (S mercredi Apm salle 1) : modification manuelle conservée
  let ettPed = generateWeekSchedule(weekKey, [])
  assert.deepEqual(
    ettPed["Apm - ETT salle 1"].MERCREDI.value,
    ["S"],
    "défaut DOC022 = S (ETT ped)",
  )
  ettPed["Apm - ETT salle 1"].MERCREDI = { value: ["P"], type: "doctor", status: "validated" }
  ettPed = applyFixedClinicalAssignments(ettPed, weekKey, [])
  assert.deepEqual(
    ettPed["Apm - ETT salle 1"].MERCREDI.value,
    ["P"],
    "ETT ped : saisie manuelle P non écrasée par S",
  )
  // Case vidée → S revient (défaut)
  ettPed["Apm - ETT salle 1"].MERCREDI = { value: [], type: "empty", status: "validated" }
  ettPed = applyFixedClinicalAssignments(ettPed, weekKey, [])
  assert.deepEqual(
    ettPed["Apm - ETT salle 1"].MERCREDI.value,
    ["S"],
    "ETT ped vide → réinjection S",
  )

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
