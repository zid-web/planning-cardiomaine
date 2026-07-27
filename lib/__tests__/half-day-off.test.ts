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
  targetOffSlotAfterNightGuard,
} from "@/lib/half-day-off"
import { applyStructuralConstraints } from "@/lib/apply-structural-constraints"
import { generateWeekSchedule } from "@/lib/schedule-utils"

function main() {
  // Défaut : après-midi du lendemain
  assert.equal(targetOffSlotAfterNightGuard("FV", "MARDI"), "am")
  assert.equal(targetOffSlotAfterNightGuard("B", "JEUDI"), "am")

  // Conflit avec off habituel apm → matin
  // Mercredi apm habituel : B, W, M, G → garde mardi → off mercredi matin
  assert.equal(targetOffSlotAfterNightGuard("W", "MERCREDI"), "matin")
  assert.equal(targetOffSlotAfterNightGuard("M", "MERCREDI"), "matin")
  // Jeudi apm : P, U
  assert.equal(targetOffSlotAfterNightGuard("P", "JEUDI"), "matin")
  // Vendredi apm : O, K, A
  assert.equal(targetOffSlotAfterNightGuard("O", "VENDREDI"), "matin")
  // Lundi apm : R, K, Z → dimanche précédent / virtuel
  assert.equal(targetOffSlotAfterNightGuard("Z", "LUNDI"), "matin")
  // Mardi apm : H, S
  assert.equal(targetOffSlotAfterNightGuard("H", "MARDI"), "matin")

  const weekKey = "2026-W30"
  let schedule = generateWeekSchedule(weekKey)

  // Garde nuit lundi FV → off mardi apm (H/S sont habituels mardi, pas FV)
  schedule["Garde Nuit"].LUNDI.value = ["FV"]
  schedule = applyNightGuardRecoveryOffs(schedule)
  assert.ok(schedule["1/2 journée off Après-midi"].MARDI.value.includes("FV"))
  assert.ok(!schedule["1/2 journée off Matin"].MARDI.value.includes("FV"))

  // Garde nuit mardi W → off mercredi matin (W a off habituel mercredi apm)
  schedule = generateWeekSchedule(weekKey)
  schedule["Garde Nuit"].MARDI.value = ["W"]
  schedule = applyNightGuardRecoveryOffs(schedule)
  assert.ok(schedule["1/2 journée off Matin"].MERCREDI.value.includes("W"))
  // Off habituel apm conservé
  assert.ok(schedule["1/2 journée off Après-midi"].MERCREDI.value.includes("W"))

  // Samedi : pas de récupération
  schedule = generateWeekSchedule(weekKey)
  schedule["Garde Nuit"].SAMEDI.value = ["B"]
  const afterSat = placeNightGuardRecoveryOff(schedule, "SAMEDI", "B")
  assert.equal(afterSat, schedule)

  // Dimanche in-week : no-op (récupération = lundi semaine suivante)
  schedule = generateWeekSchedule(weekKey)
  schedule["Garde Nuit"].DIMANCHE.value = ["B"]
  const afterSun = placeNightGuardRecoveryOff(schedule, "DIMANCHE", "B")
  assert.equal(afterSun, schedule)
  assert.ok(!schedule["1/2 journée off Après-midi"].LUNDI.value.includes("B"))

  // Vendredi nuit → samedi apm OK
  schedule = generateWeekSchedule(weekKey)
  schedule["Garde Nuit"].VENDREDI.value = ["B"]
  schedule = applyNightGuardRecoveryOffs(schedule)
  assert.ok(schedule["1/2 journée off Après-midi"].SAMEDI.value.includes("B"))

  // Dimanche précédent → lundi (Z a off habituel lundi apm → matin)
  schedule = generateWeekSchedule(weekKey)
  schedule = applyNightGuardRecoveryOffs(schedule, { previousSundayGuardDoctor: "Z" })
  assert.ok(schedule["1/2 journée off Matin"].LUNDI.value.includes("Z"))
  assert.ok(schedule["1/2 journée off Après-midi"].LUNDI.value.includes("Z"))

  // Dimanche précédent → lundi apm (B n’a pas d’off habituel lundi)
  schedule = generateWeekSchedule(weekKey)
  schedule = placeMondayRecoveryFromSundayNight(schedule, "B")
  assert.ok(schedule["1/2 journée off Après-midi"].LUNDI.value.includes("B"))
  assert.ok(!schedule["1/2 journée off Matin"].LUNDI.value.includes("B"))

  // Structural : previousSundayGuardDoctor propagé
  schedule = applyStructuralConstraints(generateWeekSchedule(weekKey, []), weekKey, [], {
    previousSundayGuardDoctor: "B",
  })
  assert.ok(
    schedule["1/2 journée off Après-midi"].LUNDI.value.includes("B"),
    "½ off apm lundi après garde nuit dimanche",
  )

  // extractSundayNightGuardDoctor préfère Garde Nuit
  schedule = generateWeekSchedule(weekKey)
  schedule["Astreintes ATL Nuit"].DIMANCHE.value = ["O"]
  schedule["Garde Nuit"].DIMANCHE.value = ["B"]
  assert.equal(extractSundayNightGuardDoctor(schedule), "B")
  schedule["Garde Nuit"].DIMANCHE.value = []
  assert.equal(extractSundayNightGuardDoctor(schedule), "O")
  schedule["Astreintes ATL Nuit"].DIMANCHE.value = ["CH"]
  assert.equal(extractSundayNightGuardDoctor(schedule), null)

  assert.equal(previousIsoWeekKey("2026-W30"), "2026-W29")
  assert.equal(nextIsoWeekKey("2026-W30"), "2026-W31")

  // Correction : mauvais créneau matin → déplacé vers apm si pas d'off habituel
  schedule = generateWeekSchedule(weekKey)
  schedule["Garde Nuit"].LUNDI.value = ["FV"]
  schedule["1/2 journée off Matin"].MARDI.value = [
    ...(schedule["1/2 journée off Matin"].MARDI.value || []),
    "FV",
  ]
  schedule = applyNightGuardRecoveryOffs(schedule)
  assert.ok(schedule["1/2 journée off Après-midi"].MARDI.value.includes("FV"))
  assert.ok(!schedule["1/2 journée off Matin"].MARDI.value.includes("FV"))

  console.log("✅ half-day-off recovery tests passed")
}

main()
