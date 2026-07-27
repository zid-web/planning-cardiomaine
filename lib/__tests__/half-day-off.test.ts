/**
 * Run: npx tsx lib/__tests__/half-day-off.test.ts
 */
import assert from "node:assert/strict"
import {
  applyHabitualHalfDaysOff,
  applyNightGuardRecoveryOffs,
  extractSundayNightGuardDoctor,
  HABITUAL_HALF_DAYS_OFF,
  nextIsoWeekKey,
  placeMondayRecoveryFromSundayNight,
  placeNightGuardRecoveryOff,
  previousIsoWeekKey,
  syncRecoveryOffsAfterNightGuardChange,
  targetOffSlotAfterNightGuard,
} from "@/lib/half-day-off"
import { applyStructuralConstraints } from "@/lib/apply-structural-constraints"
import { generateWeekSchedule } from "@/lib/schedule-utils"

function main() {
  // Table ½ off apm fixes
  assert.deepEqual(HABITUAL_HALF_DAYS_OFF.MARDI?.am, ["S"])
  assert.deepEqual(HABITUAL_HALF_DAYS_OFF.MERCREDI?.am, ["M", "W", "G", "Z", "H", "B"])
  assert.deepEqual(HABITUAL_HALF_DAYS_OFF.JEUDI?.am, ["U", "P"])
  assert.deepEqual(HABITUAL_HALF_DAYS_OFF.VENDREDI?.am, ["O", "A", "K", "R", "T"])

  // Défaut : après-midi du lendemain
  assert.equal(targetOffSlotAfterNightGuard("FV", "MARDI"), "am")
  assert.equal(targetOffSlotAfterNightGuard("B", "JEUDI"), "am")

  // Conflit avec off habituel apm → matin
  assert.equal(targetOffSlotAfterNightGuard("W", "MERCREDI"), "matin")
  assert.equal(targetOffSlotAfterNightGuard("M", "MERCREDI"), "matin")
  assert.equal(targetOffSlotAfterNightGuard("H", "MERCREDI"), "matin")
  assert.equal(targetOffSlotAfterNightGuard("B", "MERCREDI"), "matin")
  assert.equal(targetOffSlotAfterNightGuard("P", "JEUDI"), "matin")
  assert.equal(targetOffSlotAfterNightGuard("O", "VENDREDI"), "matin")
  // S mardi apm habituel → récupération garde nuit = matin
  assert.equal(targetOffSlotAfterNightGuard("S", "MARDI"), "matin")
  // H n’a plus d’off mardi → récupération lundi→mardi = apm
  assert.equal(targetOffSlotAfterNightGuard("H", "MARDI"), "am")
  // Z n’a plus d’off lundi apm → récupération dimanche→lundi = apm
  assert.equal(targetOffSlotAfterNightGuard("Z", "LUNDI"), "am")

  const weekKey = "2026-W30"
  let schedule = generateWeekSchedule(weekKey)

  // Seed habituels
  schedule = applyHabitualHalfDaysOff(schedule)
  assert.deepEqual(schedule["1/2 journée off Après-midi"].MARDI.value, ["S"])
  assert.deepEqual(schedule["1/2 journée off Matin"].MARDI.value, [])
  assert.deepEqual(
    schedule["1/2 journée off Après-midi"].MERCREDI.value,
    ["M", "W", "G", "Z", "H", "B"],
  )
  assert.deepEqual(schedule["1/2 journée off Après-midi"].JEUDI.value, ["U", "P"])
  assert.deepEqual(
    schedule["1/2 journée off Après-midi"].VENDREDI.value,
    ["O", "A", "K", "R", "T"],
  )
  assert.deepEqual(schedule["1/2 journée off Après-midi"].LUNDI.value, [])

  // Garde nuit lundi FV → off mardi apm (+ S habituel)
  schedule = generateWeekSchedule(weekKey)
  schedule["Garde Nuit"].LUNDI.value = ["FV"]
  schedule = applyNightGuardRecoveryOffs(schedule)
  assert.ok(schedule["1/2 journée off Après-midi"].MARDI.value.includes("FV"))
  assert.ok(schedule["1/2 journée off Après-midi"].MARDI.value.includes("S"))
  assert.ok(!schedule["1/2 journée off Matin"].MARDI.value.includes("FV"))

  // Garde nuit mardi W → off mercredi matin (W a off habituel mercredi apm)
  schedule = generateWeekSchedule(weekKey)
  schedule["Garde Nuit"].MARDI.value = ["W"]
  schedule = applyNightGuardRecoveryOffs(schedule)
  assert.ok(schedule["1/2 journée off Matin"].MERCREDI.value.includes("W"))
  assert.ok(schedule["1/2 journée off Après-midi"].MERCREDI.value.includes("W"))

  // Samedi : pas de récupération
  schedule = generateWeekSchedule(weekKey)
  schedule["Garde Nuit"].SAMEDI.value = ["B"]
  const afterSat = placeNightGuardRecoveryOff(schedule, "SAMEDI", "B")
  assert.equal(afterSat, schedule)

  // Dimanche in-week : no-op
  schedule = generateWeekSchedule(weekKey)
  schedule["Garde Nuit"].DIMANCHE.value = ["B"]
  const afterSun = placeNightGuardRecoveryOff(schedule, "DIMANCHE", "B")
  assert.equal(afterSun, schedule)

  // Vendredi nuit → samedi apm OK
  schedule = generateWeekSchedule(weekKey)
  schedule["Garde Nuit"].VENDREDI.value = ["B"]
  schedule = applyNightGuardRecoveryOffs(schedule)
  assert.ok(schedule["1/2 journée off Après-midi"].SAMEDI.value.includes("B"))

  // Dimanche précédent → lundi apm (Z n’a plus d’off habituel lundi)
  schedule = generateWeekSchedule(weekKey)
  schedule = applyNightGuardRecoveryOffs(schedule, { previousSundayGuardDoctor: "Z" })
  assert.ok(schedule["1/2 journée off Après-midi"].LUNDI.value.includes("Z"))
  assert.ok(!schedule["1/2 journée off Matin"].LUNDI.value.includes("Z"))
  assert.ok(schedule["1/2 journée off Matin"].LUNDI.value.includes("R"))

  schedule = generateWeekSchedule(weekKey)
  schedule = placeMondayRecoveryFromSundayNight(schedule, "B")
  assert.ok(schedule["1/2 journée off Après-midi"].LUNDI.value.includes("B"))
  assert.ok(!schedule["1/2 journée off Matin"].LUNDI.value.includes("B"))

  schedule = applyStructuralConstraints(generateWeekSchedule(weekKey, []), weekKey, [], {
    previousSundayGuardDoctor: "B",
  })
  assert.ok(schedule["1/2 journée off Après-midi"].LUNDI.value.includes("B"))

  // Nettoyage systématique : changer la garde nuit retire l’ancien
  schedule = generateWeekSchedule(weekKey)
  schedule["Garde Nuit"].LUNDI.value = ["B"]
  schedule = syncRecoveryOffsAfterNightGuardChange(schedule, "LUNDI")
  assert.ok(schedule["1/2 journée off Après-midi"].MARDI.value.includes("B"))
  schedule["Garde Nuit"].LUNDI.value = ["O"]
  schedule = syncRecoveryOffsAfterNightGuardChange(schedule, "LUNDI")
  assert.ok(schedule["1/2 journée off Après-midi"].MARDI.value.includes("O"))
  assert.ok(!schedule["1/2 journée off Après-midi"].MARDI.value.includes("B"))
  assert.ok(schedule["1/2 journée off Après-midi"].MARDI.value.includes("S"))
  assert.ok(!schedule["1/2 journée off Matin"].MARDI.value.includes("S"))

  // Vider la garde nuit → seulement S habituel mardi apm
  schedule["Garde Nuit"].LUNDI.value = []
  schedule = syncRecoveryOffsAfterNightGuardChange(schedule, "LUNDI")
  assert.deepEqual(schedule["1/2 journée off Matin"].MARDI.value, [])
  assert.deepEqual(schedule["1/2 journée off Après-midi"].MARDI.value, ["S"])

  // Samedi (pas d’habituel) : remplacement propre
  schedule = generateWeekSchedule(weekKey)
  schedule["Garde Nuit"].VENDREDI.value = ["B"]
  schedule = syncRecoveryOffsAfterNightGuardChange(schedule, "VENDREDI")
  assert.deepEqual(schedule["1/2 journée off Après-midi"].SAMEDI.value, ["B"])
  schedule["Garde Nuit"].VENDREDI.value = ["O"]
  schedule = syncRecoveryOffsAfterNightGuardChange(schedule, "VENDREDI")
  assert.deepEqual(schedule["1/2 journée off Après-midi"].SAMEDI.value, ["O"])
  assert.deepEqual(schedule["1/2 journée off Matin"].SAMEDI.value, [])

  // Dimanche précédent changé / vidé → lundi nettoyé
  schedule = generateWeekSchedule(weekKey)
  schedule = placeMondayRecoveryFromSundayNight(schedule, "B")
  assert.ok(schedule["1/2 journée off Après-midi"].LUNDI.value.includes("B"))
  schedule = placeMondayRecoveryFromSundayNight(schedule, "O")
  assert.ok(schedule["1/2 journée off Après-midi"].LUNDI.value.includes("O"))
  assert.ok(!schedule["1/2 journée off Après-midi"].LUNDI.value.includes("B"))
  schedule = placeMondayRecoveryFromSundayNight(schedule, null)
  assert.ok(!schedule["1/2 journée off Après-midi"].LUNDI.value.includes("O"))
  assert.deepEqual(schedule["1/2 journée off Après-midi"].LUNDI.value, [])

  assert.equal(previousIsoWeekKey("2026-W30"), "2026-W29")
  assert.equal(nextIsoWeekKey("2026-W30"), "2026-W31")

  schedule = generateWeekSchedule(weekKey)
  schedule["Astreintes ATL Nuit"].DIMANCHE.value = ["O"]
  schedule["Garde Nuit"].DIMANCHE.value = ["B"]
  assert.equal(extractSundayNightGuardDoctor(schedule), "B")
  schedule["Garde Nuit"].DIMANCHE.value = []
  assert.equal(extractSundayNightGuardDoctor(schedule), "O")
  schedule["Astreintes ATL Nuit"].DIMANCHE.value = ["CH"]
  assert.equal(extractSundayNightGuardDoctor(schedule), null)

  // S : ½ off mardi apm ; matin uniquement si garde nuit la veille
  // Vider Garde Nuit lundi (FV fixe sinon pollue mardi apm)
  schedule = generateWeekSchedule(weekKey)
  schedule["Garde Nuit"].LUNDI.value = []
  schedule = applyNightGuardRecoveryOffs(schedule)
  assert.deepEqual(schedule["1/2 journée off Après-midi"].MARDI.value, ["S"])
  assert.deepEqual(schedule["1/2 journée off Matin"].MARDI.value, [])
  schedule["Garde Nuit"].LUNDI.value = ["S"]
  schedule = syncRecoveryOffsAfterNightGuardChange(schedule, "LUNDI")
  assert.ok(schedule["1/2 journée off Matin"].MARDI.value.includes("S"))
  assert.ok(schedule["1/2 journée off Après-midi"].MARDI.value.includes("S"))

  // H : off mercredi apm (plus mardi) ; récupération mardi nuit → mercredi matin
  schedule = generateWeekSchedule(weekKey)
  schedule["Garde Nuit"].MARDI.value = ["H"]
  schedule = syncRecoveryOffsAfterNightGuardChange(schedule, "MARDI")
  assert.ok(schedule["1/2 journée off Matin"].MERCREDI.value.includes("H"))
  assert.ok(schedule["1/2 journée off Après-midi"].MERCREDI.value.includes("H"))
  assert.ok(!schedule["1/2 journée off Après-midi"].MARDI.value.includes("H"))

  console.log("✅ half-day-off recovery tests passed")
}

main()
