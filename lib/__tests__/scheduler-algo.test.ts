/**
 * Run: npx tsx lib/__tests__/scheduler-algo.test.ts
 */
import assert from "node:assert/strict"
import { DAYS } from "@/lib/constants"
import {
  WORKLOAD_STATS_INCLUDED_DOCTORS,
  calculateMonthlyWorkloadStats,
  calculateWorkloadStats,
  isWorkloadStatsDoctor,
  sortedTaskEntries,
  sortedWorkloadEntries,
  weekKeysOverlappingMonth,
} from "@/lib/scheduler-algo"
import type { FullSchedule, ScheduleData } from "@/lib/types"

function emptyRow() {
  return Object.fromEntries(
    DAYS.map((d) => [d, { value: [] as string[], type: "empty" as const, status: "validated" as const }]),
  )
}

function bareWeek(rows: string[]): ScheduleData {
  const schedule: ScheduleData = {}
  for (const row of rows) schedule[row] = emptyRow()
  return schedule
}

function main() {
  assert.equal(isWorkloadStatsDoctor("W"), true)
  assert.equal(isWorkloadStatsDoctor("DAAS"), false)
  assert.equal(isWorkloadStatsDoctor("CH"), false)
  assert.equal(isWorkloadStatsDoctor("FV"), false)
  assert.equal(isWorkloadStatsDoctor("T"), false)
  assert.equal(isWorkloadStatsDoctor("V"), false)
  assert.equal(isWorkloadStatsDoctor("D"), false)
  assert.equal(isWorkloadStatsDoctor("I"), false)
  assert.equal(isWorkloadStatsDoctor("Val"), false)
  assert.equal(isWorkloadStatsDoctor("R"), false)
  // La liste a été inversée : c'est désormais une **allowlist** des médecins
  // comptabilisés (WORKLOAD_STATS_INCLUDED_DOCTORS), et non plus une liste
  // d'exclus. DAAS n'y figure pas, donc il reste hors statistiques.
  assert.ok(!WORKLOAD_STATS_INCLUDED_DOCTORS.has("DAAS"))
  assert.ok(WORKLOAD_STATS_INCLUDED_DOCTORS.has("S"))

  // Semaine 2026-W30 : lundi 20 juillet 2026 → jours en juillet
  const week = bareWeek([
    "Garde Nuit",
    "Matin - Coro",
    "Apm - Coro",
    "Hors site - CDL",
    "Apm - EE2",
    "Congés",
    "Astreintes ATL Nuit",
  ])
  week["Garde Nuit"].LUNDI = { value: ["FV"], type: "doctor", status: "validated" }
  week["Matin - Coro"].LUNDI = { value: ["W"], type: "doctor", status: "pending" }
  week["Apm - Coro"].MARDI = { value: ["M", "O"], type: "doctor", status: "validated" }
  week["Hors site - CDL"].MERCREDI = { value: ["V"], type: "doctor", status: "validated" }
  week["Apm - EE2"].LUNDI = { value: ["DAAS"], type: "doctor", status: "validated" }
  week["Congés"].JEUDI = { value: ["W"], type: "doctor", status: "validated" }
  week["Astreintes ATL Nuit"].VENDREDI = { value: ["CH", "W"], type: "doctor", status: "validated" }

  const weekly = calculateWorkloadStats(week)
  assert.equal(weekly.W, 2, "W : Coro + ATL (Congés exclus)")
  assert.equal(weekly.M, 1)
  assert.equal(weekly.O, 1)
  assert.equal(weekly.FV, undefined, "FV exclu")
  assert.equal(weekly.DAAS, undefined, "DAAS exclu")
  assert.equal(weekly.CH, undefined, "CH exclu")
  assert.equal(weekly.V, undefined, "V exclu")

  const full: FullSchedule = { "2026-W30": week }
  const monthly = calculateMonthlyWorkloadStats(full, 2026, 7)
  assert.equal(monthly.label, "juillet 2026")
  assert.ok(monthly.weeksScanned >= 1)
  assert.equal(monthly.doctors.W.total, 2)
  assert.equal(monthly.doctors.W.byTask["Matin - Coro"], 1)
  assert.equal(monthly.doctors.W.byTask["Astreintes ATL Nuit"], 1)
  assert.equal(monthly.doctors.W.byTask["Congés"], undefined)
  assert.equal(monthly.doctors.M.byTask["Apm - Coro"], 1)
  assert.equal(monthly.doctors.FV, undefined)

  const sorted = sortedWorkloadEntries(monthly)
  assert.equal(sorted[0].doctor, "W")
  assert.deepEqual(
    sortedTaskEntries(monthly.doctors.W.byTask).map(([k]) => k).sort(),
    ["Astreintes ATL Nuit", "Matin - Coro"].sort(),
  )

  // Semaine à cheval : 2026-W27 lundi 29 juin → lun juin, mer juillet
  const bridge = bareWeek(["Garde Matin"])
  bridge["Garde Matin"].LUNDI = { value: ["B"], type: "doctor", status: "validated" } // 29 juin
  bridge["Garde Matin"].MERCREDI = { value: ["B"], type: "doctor", status: "validated" } // 1er juil
  const fullBridge: FullSchedule = { "2026-W27": bridge }
  const june = calculateMonthlyWorkloadStats(fullBridge, 2026, 6)
  const july = calculateMonthlyWorkloadStats(fullBridge, 2026, 7)
  assert.equal(june.doctors.B.total, 1, "B compté en juin (lundi)")
  assert.equal(july.doctors.B.total, 1, "B compté en juillet (mercredi)")

  const keys = weekKeysOverlappingMonth(2026, 7)
  assert.ok(keys.includes("2026-W27") || keys.includes("2026-W30"))
  assert.ok(keys.length >= 4)

  console.log("✅ scheduler-algo workload stats tests passed")
}

main()
