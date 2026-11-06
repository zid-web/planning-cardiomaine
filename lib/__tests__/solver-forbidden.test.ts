/**
 * Run: npx tsx lib/__tests__/solver-forbidden.test.ts
 */
import assert from "node:assert/strict"
import { buildForbiddenAssignments, validatedOnly } from "@/lib/solver-forbidden"
import { buildSolverRulesPayload, SOLVER_RULES_VERSION } from "@/lib/solver-rules"
import { generateWeekSchedule } from "@/lib/schedule-utils"
import { applyStructuralConstraints } from "@/lib/apply-structural-constraints"

const wk = "2026-W46" // mercredi 11/11 férié
const vac: any[] = [{ id: "1", doctor_id: "V", start_date: "2026-11-08", end_date: "2026-11-22" }]
const s: any = applyStructuralConstraints(generateWeekSchedule(wk, vac), wk, vac, { isFreshWeek: true })
s["Apm - Cs PSS"].LUNDI = { value: ["H"], type: "doctor", status: "pending" } // proposition : ne contraint pas

const f = buildForbiddenAssignments(wk, s, vac)
const has = (row: string, day: string, doc: string) => (f.forbidden[row]?.[day] ?? []).includes(doc)
assert.ok(f.count > 0)
assert.ok(has("Matin - Coro", "MERCREDI", "M"), "jour férié : Coro fermée")
assert.ok(!has("Garde Nuit", "MERCREDI", "P"), "jour férié : gardes ouvertes")
assert.ok(has("Garde Nuit", "MERCREDI", "S"), "S en LFB le lendemain")
assert.ok(has("Matin - Cs Tessée", "LUNDI", "V"), "V en congé")
assert.ok(has("Matin - ETT salle 1", "LUNDI", "O"), "O jamais d'ETT")
assert.ok(f.reasons["Matin - ETT salle 1|LUNDI|O"].includes("ETT"))
// Une proposition en attente ne bloque pas les autres médecins
assert.equal(validatedOnly(s)["Apm - Cs PSS"].LUNDI.value.length, 0)
// Jamais d'infirmière ni d'interne dans les interdits (le solveur ne les place pas)
for (const days of Object.values(f.forbidden)) for (const docs of Object.values(days)) {
  assert.ok(!docs.includes("Val") && !docs.includes("I"))
}
// Envoyé au solveur dans app_rules
const p = buildSolverRulesPayload(wk, { schedule: s, vacations: vac })
assert.equal(p.version, SOLVER_RULES_VERSION)
assert.deepEqual(p.forbidden, f.forbidden)
console.log("✅ solver-forbidden tests passed", f.count, "interdits")
