/**
 * Run: npx tsx lib/__tests__/garde-matin-rules.test.ts
 */
import assert from "node:assert/strict"
import { applyGardeMatinInternAndCsPss } from "@/lib/garde-matin-rules"
import { applyStructuralConstraints } from "@/lib/apply-structural-constraints"
import { generateWeekSchedule } from "@/lib/schedule-utils"
import { formatDoctorWithDoublon, canAssignDoctorToSlot } from "@/lib/slot-blocking"

const c = (value: string[], status: "validated" | "pending" = "validated") => ({ value, type: "doctor" as const, status })
const wk = "2026-W48" // lun 23/11 → dim 29/11, sans férié

const s: any = generateWeekSchedule(wk, [])
s["Garde Matin"].MARDI = c(["B"])
s["Garde Matin"].SAMEDI = c(["G"])
s["Matin - Cs PSS"].MARDI = c(["H"])
const r = applyGardeMatinInternAndCsPss(s, wk)
// I en doublon sur la Garde Matin, lun-ven uniquement
assert.deepEqual(r["Garde Matin"].MARDI.value, ["B", "I"])
assert.deepEqual(r["Garde Matin"].SAMEDI.value, ["G"])
// Médecin de garde en Matin - Cs PSS avec (4), même B (Cs Tessée habituellement)
assert.deepEqual(r["Matin - Cs PSS"].MARDI.value, ["H", "B"])
assert.deepEqual(r["Matin - Cs PSS"].MARDI.patientCounts, { B: 4 })
assert.equal(formatDoctorWithDoublon(r, "MARDI", "B", "Matin - Cs PSS"), "B (4)")
assert.equal(formatDoctorWithDoublon(r, "MARDI", "H", "Matin - Cs PSS"), "H")
// Idempotent
assert.deepEqual(applyGardeMatinInternAndCsPss(r, wk), r)
// Changement du médecin de garde : l'ancien quitte la Cs PSS, le nouveau y entre
const r2: any = structuredClone(r)
r2["Garde Matin"].MARDI = c(["Z", "I"])
const r3 = applyGardeMatinInternAndCsPss(r2, wk)
assert.deepEqual(r3["Matin - Cs PSS"].MARDI.value, ["H", "Z"])
assert.deepEqual(r3["Matin - Cs PSS"].MARDI.patientCounts, { Z: 4 })
// I en congé : pas ajouté
const s2: any = generateWeekSchedule(wk, [])
s2["Garde Matin"].LUNDI = c(["G"])
const vac: any[] = [{ id: "1", doctor_id: "I", start_date: "2026-11-23", end_date: "2026-11-23" }]
assert.deepEqual(applyGardeMatinInternAndCsPss(s2, wk, vac)["Garde Matin"].LUNDI.value, ["G"])
// Dans la chaîne complète : la paire Garde Matin + Cs PSS tient (pas retirée par les strips) et reste valide
const full = applyStructuralConstraints(s, wk, [], { isFreshWeek: false })
assert.ok(full["Garde Matin"].MARDI.value.includes("I"))
assert.ok(full["Matin - Cs PSS"].MARDI.value.includes("B"))
assert.equal(full["Matin - Cs PSS"].MARDI.patientCounts?.B, 4)
assert.equal(canAssignDoctorToSlot("B", "2026-11-24", "Matin - Cs PSS", "MARDI", full, []).allowed, true)
console.log("✅ garde-matin-rules tests passed")
