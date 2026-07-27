/**
 * Run: npx tsx lib/__tests__/half-day-off.test.ts
 */
import assert from "node:assert/strict"
import {
  applyNightGuardRecoveryOffs,
  extractSundayNightGuardDoctor,
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
  // Défaut : après-midi du lendemain
  assert.equal(targetOffSlotAfterNightGuard("FV", "MARDI"), "am")
  assert.equal(targetOffSlotAfterNightGuard("B", "JEUDI"), "am")

  // Conflit avec off habituel apm → matin
  assert.equal(targetOffSlotAfterNightGuard("W", "MERCREDI"), "matin")
  assert.equal(targetOffSlotAfterNightGuard("M", "MERCREDI"), "matin")
  assert.equal(targetOffSlotAfterNightGuard("P", "JEUDI"), "matin")
  assert.equal(targetOffSlotAfterNightGuard("O", "VENDREDI"), "matin")
  assert.equal(targetOffSlotAfterNightGuard("Z", "LUNDI"), "matin")
  // Mardi apm : H, S (habituel apm → récupération garde nuit = matin)
  assert.equal(targetOffSlotAfterNightGuard("H", "MARDI"), "matin")
  assert.equal(targetOffSlotAfterNightGuard("S", "MARDI"), "matin")

  const weekKey = "2026-W30"
  let schedule = generateWeekSchedule(weekKey)

  // Garde nuit lundi FV → off mardi apm
  schedule["Garde Nuit"].LUNDI.value = ["FV"]
  schedule = applyNightGuardRecoveryOffs(schedule)
  assert.ok(schedule["1/2 journée off Après-midi"].MARDI.value.includes("FV"))
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

  // Dimanche précédent → lundi (Z → matin + habituel apm)
  schedule = generateWeekSchedule(weekKey)
  schedule = applyNightGuardRecoveryOffs(schedule, { previousSundayGuardDoctor: "Z" })
  assert.ok(schedule["1/2 journée off Matin"].LUNDI.value.includes("Z"))
  assert.ok(schedule["1/2 journée off Après-midi"].LUNDI.value.includes("Z"))

  schedule = generateWeekSchedule(weekKey)
  schedule = placeMondayRecoveryFromSundayNight(schedule, "B")
  assert.ok(schedule["1/2 journée off Après-midi"].LUNDI.value.includes("B"))
  assert.ok(!schedule["1/2 journée off Matin"].LUNDI.value.includes("B"))

  schedule = applyStructuralConstraints(generateWeekSchedule(weekKey, []), weekKey, [], {
    previousSundayGuardDoctor: "B",
  })
  assert.ok(schedule["1/2 journée off Après-midi"].LUNDI.value.includes("B"))

  // Nettoyage systématique : changer la garde nuit retire l’ancien de la ½ off
  schedule = generateWeekSchedule(weekKey)
  schedule["Garde Nuit"].LUNDI.value = ["B"]
  schedule = syncRecoveryOffsAfterNightGuardChange(schedule, "LUNDI")
  assert.ok(schedule["1/2 journée off Après-midi"].MARDI.value.includes("B"))
  schedule["Garde Nuit"].LUNDI.value = ["O"]
  schedule = syncRecoveryOffsAfterNightGuardChange(schedule, "LUNDI")
  assert.ok(schedule["1/2 journée off Après-midi"].MARDI.value.includes("O"))
  assert.ok(
    !schedule["1/2 journée off Après-midi"].MARDI.value.includes("B"),
    "ancien médecin B retiré après changement de garde",
  )
  assert.ok(
    !schedule["1/2 journée off Matin"].MARDI.value.includes("B"),
    "B aussi retiré du matin",
  )
  // Habituels mardi : H/S en apm seulement (pas le matin)
  assert.ok(schedule["1/2 journée off Après-midi"].MARDI.value.includes("S"))
  assert.ok(schedule["1/2 journée off Après-midi"].MARDI.value.includes("H"))
  assert.ok(!schedule["1/2 journée off Matin"].MARDI.value.includes("S"))
  assert.ok(!schedule["1/2 journée off Matin"].MARDI.value.includes("H"))

  // Vider la garde nuit → plus de récupération (seulement habituels)
  schedule["Garde Nuit"].LUNDI.value = []
  schedule = syncRecoveryOffsAfterNightGuardChange(schedule, "LUNDI")
  assert.ok(!schedule["1/2 journée off Après-midi"].MARDI.value.includes("O"))
  assert.deepEqual(schedule["1/2 journée off Matin"].MARDI.value, [])
  assert.deepEqual(schedule["1/2 journée off Après-midi"].MARDI.value, ["H", "S"])

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
  assert.ok(schedule["1/2 journée off Après-midi"].LUNDI.value.includes("Z")) // habituel

  assert.equal(previousIsoWeekKey("2026-W30"), "2026-W29")
  assert.equal(nextIsoWeekKey("2026-W30"), "2026-W31")

  // extractSundayNightGuardDoctor préfère Garde Nuit
  schedule = generateWeekSchedule(weekKey)
  schedule["Astreintes ATL Nuit"].DIMANCHE.value = ["O"]
  schedule["Garde Nuit"].DIMANCHE.value = ["B"]
  assert.equal(extractSundayNightGuardDoctor(schedule), "B")
  schedule["Garde Nuit"].DIMANCHE.value = []
  assert.equal(extractSundayNightGuardDoctor(schedule), "O")
  schedule["Astreintes ATL Nuit"].DIMANCHE.value = ["CH"]
  assert.equal(extractSundayNightGuardDoctor(schedule), null)

  // Mauvais créneau matin → déplacé vers apm
  schedule = generateWeekSchedule(weekKey)
  schedule["Garde Nuit"].LUNDI.value = ["FV"]
  schedule["1/2 journée off Matin"].MARDI.value = [
    ...(schedule["1/2 journée off Matin"].MARDI.value || []),
    "FV",
  ]
  schedule = applyNightGuardRecoveryOffs(schedule)
  assert.ok(schedule["1/2 journée off Après-midi"].MARDI.value.includes("FV"))
  assert.ok(!schedule["1/2 journée off Matin"].MARDI.value.includes("FV"))

  // H/S : ½ off mardi apm seulement ; matin uniquement si garde nuit la veille
  schedule = generateWeekSchedule(weekKey)
  schedule = applyNightGuardRecoveryOffs(schedule)
  assert.deepEqual(schedule["1/2 journée off Après-midi"].MARDI.value, ["H", "S"])
  assert.deepEqual(schedule["1/2 journée off Matin"].MARDI.value, [])
  // S de garde nuit lundi → ½ off mardi matin (récupération) + apm habituel
  schedule["Garde Nuit"].LUNDI.value = ["S"]
  schedule = syncRecoveryOffsAfterNightGuardChange(schedule, "LUNDI")
  assert.ok(schedule["1/2 journée off Matin"].MARDI.value.includes("S"))
  assert.ok(schedule["1/2 journée off Après-midi"].MARDI.value.includes("S"))
  assert.ok(!schedule["1/2 journée off Matin"].MARDI.value.includes("H"))

  console.log("✅ half-day-off recovery tests passed")
}

main()
