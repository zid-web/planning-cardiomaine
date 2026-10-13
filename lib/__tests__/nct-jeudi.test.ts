/**
 * Run: npx tsx lib/__tests__/nct-jeudi.test.ts
 */
import assert from "node:assert/strict"
import { DEFAULT_NCT_CALENDAR, isNctWeekday } from "@/lib/nct-calendar"

assert.equal(isNctWeekday("2026-10-15"), true) // jeudi
for (const d of ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-16", "2026-10-17", "2026-10-18"]) {
  assert.equal(isNctWeekday(d), false, d)
}
assert.equal(isNctWeekday("pas une date"), false)
const horsJeudi = DEFAULT_NCT_CALENDAR.filter((e) => !isNctWeekday(e.date)).map((e) => e.date)
console.log("dates par défaut hors jeudi :", horsJeudi.length ? horsJeudi.join(", ") : "aucune")
console.log("✅ nct-jeudi tests passed")
