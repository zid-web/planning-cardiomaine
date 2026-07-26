/**
 * Run: npx tsx lib/__tests__/nct-command.test.ts
 */
import assert from "node:assert/strict"
import { resolveRowKey } from "@/lib/guard-api-mapping"
import {
  applyNctAssignmentsToFullSchedule,
  looksLikeNctScheduleText,
  parseNctAssignmentsFromText,
  weekKeyFromIsoDate,
} from "@/lib/nct-command"
import { generateWeekSchedule } from "@/lib/schedule-utils"

const SAMPLE = `
Voici les prochaines dates NCT (à partir d’aujourd’hui, 26 juillet 2026) :

✅ 2026-09-10 → M
✅ 2026-09-17 → W
✅ 2026-09-24 → M
✅ 2026-10-01 → W
✅ 2026-10-15 → M
`

function main() {
  assert.equal(resolveRowKey("matin", "NCT", "JEUDI"), "Hors site - NCT")
  assert.equal(resolveRowKey("am", "nct", "JEUDI"), "Hors site - NCT")
  assert.equal(resolveRowKey("nuit", "NCT", "JEUDI"), "Hors site - NCT")
  assert.equal(resolveRowKey("matin", "GARDE", "LUNDI"), "Garde Matin")
  assert.equal(resolveRowKey("matin", "CORO", "LUNDI"), "Matin - Coro")
  assert.equal(resolveRowKey("am", "CORO", "JEUDI"), "Apm - Coro")
  assert.equal(resolveRowKey("weekend", "VACANCES", "SAMEDI"), "Vacances")

  assert.ok(looksLikeNctScheduleText(SAMPLE))
  const parsed = parseNctAssignmentsFromText(SAMPLE)
  assert.equal(parsed.length, 5)
  assert.deepEqual(parsed[0], { date: "2026-09-10", doctor: "M" })
  assert.deepEqual(parsed[1], { date: "2026-09-17", doctor: "W" })

  // 2026-09-10 is a Thursday → week key stable
  const wk = weekKeyFromIsoDate("2026-09-10")
  assert.match(wk, /^\d{4}-W\d{2}$/)

  const base = generateWeekSchedule(wk)
  const { next, applied, touchedWeekKeys } = applyNctAssignmentsToFullSchedule(
    { [wk]: base },
    parsed.slice(0, 1),
  )
  assert.equal(applied, 1)
  assert.ok(touchedWeekKeys.includes(wk))
  assert.deepEqual(next[wk]["Hors site - NCT"].JEUDI.value, ["M"])

  console.log("✅ nct-command regression tests passed")
}

main()
