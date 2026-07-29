/**
 * Run: bunx tsx lib/__tests__/activity-maintenance.test.ts
 */
import assert from "node:assert/strict"
import {
  buildActivityMaintenancePayload,
  buildDefaultActivityMaintenance2026,
  isActivitySuspendedInWeek,
  isActivitySuspendedOnDate,
  isoWeekInclusiveRangeToDates,
} from "@/lib/activity-maintenance"
import {
  applyActivityMaintenanceClear,
  applyLfbThursdayRotation,
  applyNctCalendarConstraints,
  applyStructuralConstraints,
} from "@/lib/apply-structural-constraints"
import { generateWeekSchedule } from "@/lib/schedule-utils"

function main() {
  const range2836 = isoWeekInclusiveRangeToDates(2026, 28, 36)
  assert.ok(range2836)
  assert.equal(range2836!.start_date, "2026-07-06", "S28 2026 = lundi 6 juil.")
  assert.equal(range2836!.end_date, "2026-09-06", "S36 2026 = dimanche 6 sept.")

  const range3136 = isoWeekInclusiveRangeToDates(2026, 31, 36)
  assert.ok(range3136)
  assert.equal(range3136!.start_date, "2026-07-27")
  assert.equal(range3136!.end_date, "2026-09-06")

  const periods = buildDefaultActivityMaintenance2026()
  assert.equal(periods.length, 2)
  assert.deepEqual(periods[0].activities.sort(), ["CDL", "LFB", "PSSL"])
  assert.deepEqual(periods[1].activities, ["NCT"])

  const payload = buildActivityMaintenancePayload()
  assert.equal(payload.length, 2)
  assert.ok(payload.every((p) => p.start_date && p.end_date && p.activities.length))

  // Hors site S28–S36
  assert.equal(isActivitySuspendedOnDate("2026-07-06", "LFB"), true)
  assert.equal(isActivitySuspendedOnDate("2026-09-06", "CDL"), true)
  assert.equal(isActivitySuspendedOnDate("2026-07-05", "LFB"), false)
  assert.equal(isActivitySuspendedOnDate("2026-09-07", "PSSL"), false)

  // NCT S31–S36 seulement
  assert.equal(isActivitySuspendedOnDate("2026-07-23", "NCT"), false, "S30 NCT encore actif")
  assert.equal(isActivitySuspendedOnDate("2026-07-27", "NCT"), true)
  assert.equal(isActivitySuspendedInWeek("2026-W30", "NCT"), false)
  assert.equal(isActivitySuspendedInWeek("2026-W31", "NCT"), true)
  assert.equal(isActivitySuspendedInWeek("2026-W28", "LFB"), true)
  assert.equal(isActivitySuspendedInWeek("2026-W27", "LFB"), false)

  // Structurel : LFB non injecté si suspendu
  let s28 = generateWeekSchedule("2026-W28", [])
  s28 = applyLfbThursdayRotation(s28, "2026-W28")
  assert.deepEqual(s28["Hors site - LFB"].JEUDI.value, [], "pas de LFB S28")

  let s27 = generateWeekSchedule("2026-W27", [])
  s27 = applyLfbThursdayRotation(s27, "2026-W27")
  assert.ok(s27["Hors site - LFB"].JEUDI.value.length > 0, "LFB injecté hors suspension")

  // NCT calendrier : S30 a encore 2026-07-23 = M ; S31+ vidé
  let nct30 = generateWeekSchedule("2026-W30", [])
  nct30 = applyNctCalendarConstraints(nct30, "2026-W30")
  assert.ok(
    nct30["Hors site - NCT"].JEUDI?.value?.includes("M") ||
      Object.values(nct30["Hors site - NCT"]).some((c) => (c.value || []).includes("M")),
    "NCT encore présent S30",
  )

  let nct31 = generateWeekSchedule("2026-W31", [])
  nct31["Hors site - NCT"].JEUDI = { value: ["M"], type: "doctor", status: "validated" }
  nct31 = applyNctCalendarConstraints(nct31, "2026-W31")
  for (const day of Object.keys(nct31["Hors site - NCT"])) {
    assert.deepEqual(nct31["Hors site - NCT"][day].value, [], `NCT vide ${day} S31`)
  }

  // Clear PSSL/CDL déjà remplis
  let filled = generateWeekSchedule("2026-W32", [])
  filled["Hors site - PSSL"].MARDI = { value: ["Z"], type: "doctor", status: "pending" }
  filled["Hors site - CDL"].MARDI = { value: ["V"], type: "doctor", status: "pending" }
  filled = applyActivityMaintenanceClear(filled, "2026-W32")
  assert.deepEqual(filled["Hors site - PSSL"].MARDI.value, [])
  assert.deepEqual(filled["Hors site - CDL"].MARDI.value, [])

  // Pipeline structurel complet S33
  let full = generateWeekSchedule("2026-W33", [])
  full["Hors site - LFB"].JEUDI = { value: ["H"], type: "doctor", status: "validated" }
  full = applyStructuralConstraints(full, "2026-W33", [])
  assert.deepEqual(full["Hors site - LFB"].JEUDI.value, [], "LFB vidé en pipeline S33")

  console.log("✅ activity-maintenance tests passed")
}

main()
