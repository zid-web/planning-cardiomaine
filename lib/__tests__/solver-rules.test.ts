import assert from "node:assert/strict"
import { buildSolverRulesPayload, solverAcknowledgedRules } from "../solver-rules"

const sched: any = {
  "Garde Nuit": { LUNDI: { value: ["U"], status: "validated" }, MARDI: { value: [], status: "validated", manuallyCleared: true } },
  "Matin - Rythmo": {},
  "Hors site - NCT": {},
}
const p = buildSolverRulesPayload("2026-W44", { previousSundayGuardDoctor: "B", schedule: sched })
assert.equal(p.version, 1)
assert.equal(p.night_guard.previous_sunday_guard_doctor, "B")
assert.ok(p.night_guard.friday_pool.includes("B"))
assert.ok(p.closed_slots.some((c) => c.row === "Matin - Rythmo" && c.day === "LUNDI"))
assert.deepEqual(p.fixed_assignments, [{ row: "Garde Nuit", day: "LUNDI", doctors: ["U"] }])
assert.deepEqual(p.cleared_cells, [{ row: "Garde Nuit", day: "MARDI" }])
assert.equal(p.weekly_limits.stress.max_per_doctor_per_week, 1)
assert.equal(solverAcknowledgedRules({ rules_version: 1 }), true)
assert.equal(solverAcknowledgedRules({}), false)
console.log("solver-rules OK")
