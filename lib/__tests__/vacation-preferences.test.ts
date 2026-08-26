/**
 * Run: bunx tsx lib/__tests__/vacation-preferences.test.ts
 */
import assert from "node:assert/strict"
import { generateWeekSchedule } from "@/lib/schedule-utils"
import { applyNurseFixedAssignments, dateStrForWeekDay } from "@/lib/fixed-assignments"
import { canNurseTakeRow, ensureNurseDoctorBinomeProposals } from "@/lib/nurse-rules"
import { canAssignDoctorToSlot } from "@/lib/slot-blocking"
import {
  applyPreferenceBias,
  isDayAfterNightGuard,
  preferredPartnerForNurseSlot,
  PREFERENCE_BONUS,
} from "@/lib/vacation-preferences"
import { STRESS_PARTNER_POOL } from "@/lib/nurse-rules"
import type { DoctorVacation } from "@/lib/types"

function main() {
  // --- K souvent au Stress mardi matin, rarement le mercredi ---
  const patterns = {
    "Matin - Stress": {
      MARDI: { eligible_doctors: ["B", "Z"], frequency: { B: 5, Z: 3 } },
      MERCREDI: { eligible_doctors: ["K", "G"], frequency: { K: 4, G: 1 } },
    },
  }
  const biased = applyPreferenceBias(patterns)

  assert.ok(
    biased["Matin - Stress"].MARDI.eligible_doctors.includes("K"),
    "K devient éligible au Stress mardi matin",
  )
  assert.equal(
    biased["Matin - Stress"].MARDI.frequency.K,
    5 + PREFERENCE_BONUS,
    "K passe devant le meilleur autre candidat du mardi",
  )
  assert.equal(
    biased["Matin - Stress"].MERCREDI.eligible_doctors.includes("K"),
    false,
    "K est écarté du Stress mercredi matin",
  )
  assert.equal(biased["Matin - Stress"].MERCREDI.frequency.K, undefined)
  assert.deepEqual(biased["Matin - Stress"].MERCREDI.eligible_doctors, ["G"])

  // L'entrée d'origine n'est pas mutée
  assert.equal(patterns["Matin - Stress"].MERCREDI.frequency.K, 4)
  assert.deepEqual(patterns["Matin - Stress"].MARDI.eligible_doctors, ["B", "Z"])

  // « rarement » ≠ « jamais » : seul candidat connu → on le garde
  const soloK = applyPreferenceBias({
    "Matin - Stress": { MERCREDI: { eligible_doctors: ["K"], frequency: { K: 2 } } },
  })
  assert.deepEqual(soloK["Matin - Stress"].MERCREDI.eligible_doctors, ["K"])

  // Case sans historique : la préférence « souvent » crée l'entrée
  const fromEmpty = applyPreferenceBias({})
  assert.deepEqual(fromEmpty["Matin - Stress"].MARDI.eligible_doctors, ["K"])
  assert.equal(fromEmpty["Matin - Stress"].MARDI.frequency.K, PREFERENCE_BONUS)

  // --- S vendredi matin : congés et lendemain de garde annulent la préférence ---
  assert.equal(
    applyPreferenceBias({})["Matin - Stress"].VENDREDI.eligible_doctors.includes("S"),
    true,
    "S est privilégié au Stress vendredi matin par défaut",
  )

  const weekKey = "2026-W30"
  const sVacation: DoctorVacation[] = [
    {
      id: "1",
      doctor_id: "S",
      start_date: "2026-07-24",
      end_date: "2026-07-24",
      created_at: "",
      updated_at: "",
    },
  ]
  const onLeave = applyPreferenceBias(
    {},
    {
      weekKey,
      vacations: sVacation,
      dateStrForDay: (day) => dateStrForWeekDay(weekKey, day),
    },
  )
  assert.equal(
    onLeave["Matin - Stress"].VENDREDI,
    undefined,
    "S en congés : pas de préférence vendredi matin",
  )

  let sched = generateWeekSchedule(weekKey, [])
  sched["Garde Nuit"].JEUDI = { value: ["S"], type: "doctor", status: "validated" }
  assert.equal(isDayAfterNightGuard(sched, "VENDREDI", "S"), true)
  assert.equal(isDayAfterNightGuard(sched, "JEUDI", "S"), false)
  const afterGuard = applyPreferenceBias({}, { weekKey, schedule: sched })
  assert.equal(
    afterGuard["Matin - Stress"]?.VENDREDI,
    undefined,
    "S au lendemain de garde : pas de préférence vendredi matin",
  )
  // La préférence du mardi reste intacte
  assert.equal(afterGuard["Matin - Stress"].MARDI.frequency.K, PREFERENCE_BONUS)

  // --- Choix du partenaire d'une infirmière ---
  assert.equal(
    preferredPartnerForNurseSlot("Matin - Stress", "MARDI", STRESS_PARTNER_POOL),
    "K",
  )
  assert.equal(
    preferredPartnerForNurseSlot("Matin - Stress", "VENDREDI", STRESS_PARTNER_POOL),
    "S",
  )
  assert.equal(
    preferredPartnerForNurseSlot("Matin - Stress", "MERCREDI", STRESS_PARTNER_POOL),
    null,
    "aucune préférence positive le mercredi matin",
  )
  assert.equal(
    preferredPartnerForNurseSlot("Matin - Stress", "MARDI", ["B", "Z"]),
    null,
    "préférence ignorée si K n'est pas dans le pool",
  )

  // Véro seule sur Stress mardi matin → K proposé comme binôme
  sched = generateWeekSchedule(weekKey, [])
  sched["Matin - Stress"].MARDI = { value: ["Véro"], type: "doctor", status: "validated" }
  const paired = ensureNurseDoctorBinomeProposals(sched, weekKey, [])
  assert.ok(
    paired["Matin - Stress"].MARDI.value.includes("K"),
    "K est le partenaire proposé à Véro le mardi matin",
  )
  assert.ok(paired["Matin - Stress"].MARDI.value.includes("Véro"))

  // Vendredi matin : S proposé (pool trié autrement, la préférence prime)
  sched = generateWeekSchedule(weekKey, [])
  sched["Matin - Stress"].VENDREDI = { value: ["Laura"], type: "doctor", status: "validated" }
  const pairedFri = ensureNurseDoctorBinomeProposals(sched, weekKey, [])
  assert.ok(
    pairedFri["Matin - Stress"].VENDREDI.value.includes("S"),
    "S est le partenaire proposé le vendredi matin",
  )

  // --- Val en ETT : toujours salle 2 ---
  assert.equal(canNurseTakeRow("Val", "Matin - ETT salle 2"), true)
  assert.equal(canNurseTakeRow("Val", "Apm - ETT salle 2"), true)
  assert.equal(canNurseTakeRow("Val", "Matin - ETT salle 1"), false)
  assert.equal(canNurseTakeRow("Val", "Apm - ETT salle 1"), false)
  assert.equal(canNurseTakeRow("Val", "Matin - ETT Tessé"), true, "ETT Tessé reste ouvert")
  assert.equal(canNurseTakeRow("Véro", "Matin - ETT salle 1"), true, "règle propre à Val")

  sched = generateWeekSchedule(weekKey, [])
  let r = canAssignDoctorToSlot("Val", "2026-07-20", "Matin - ETT salle 1", "LUNDI", sched, [])
  assert.equal(r.allowed, false, "Val jamais sur ETT salle 1")
  r = canAssignDoctorToSlot("Val", "2026-07-20", "Matin - ETT salle 2", "LUNDI", sched, [])
  assert.equal(r.allowed, true, "Val reste assignable sur ETT salle 2")

  // --- Laura en congés → repli systématique sur Val ---
  // Semaine impaire : Laura est sur « Matin - Stress » vendredi ; Val est sur
  // « Matin - ETT salle 2 » le même matin (libérée par le repli).
  const oddWeek = "2026-W31"
  const fridayStr = dateStrForWeekDay(oddWeek, "VENDREDI")!
  let nurseSched = applyNurseFixedAssignments(generateWeekSchedule(oddWeek, []), oddWeek, [])
  assert.deepEqual(
    nurseSched["Matin - Stress"].VENDREDI.value,
    ["Laura"],
    "sans congés, Laura tient le Stress du vendredi matin",
  )
  assert.ok(nurseSched["Matin - ETT salle 2"].VENDREDI.value.includes("Val"))

  const lauraOff: DoctorVacation[] = [
    {
      id: "2",
      doctor_id: "Laura",
      start_date: fridayStr,
      end_date: fridayStr,
      created_at: "",
      updated_at: "",
    },
  ]
  nurseSched = applyNurseFixedAssignments(
    generateWeekSchedule(oddWeek, []),
    oddWeek,
    lauraOff,
  )
  assert.deepEqual(
    nurseSched["Matin - Stress"].VENDREDI.value,
    ["Val"],
    "Laura absente : Val prend systématiquement le relais",
  )
  assert.equal(
    nurseSched["Matin - ETT salle 2"].VENDREDI.value.includes("Val"),
    false,
    "Val libère son ETT salle 2 du même matin (une vacation par créneau)",
  )

  console.log("✅ vacation-preferences tests passed")
}

main()
