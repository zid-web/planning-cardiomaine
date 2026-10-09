/**
 * Run: bunx tsx lib/__tests__/clinical-priority.test.ts
 * Priorités des propositions : Coro d'abord, O jamais ETT, groupe écho avant Cs, U lundi.
 */
import assert from "node:assert/strict"
import { applyClinicalPriorityRules } from "@/lib/clinical-priority"
import { applyClinicalRotationRules } from "@/lib/clinical-rotation-diversity"
import { canAssignDoctorToSlot } from "@/lib/slot-blocking"
import { generateWeekSchedule } from "@/lib/schedule-utils"
import { DOC022_CLINICAL_ELIGIBILITY } from "@/lib/group-clinical-rules"

const wk = "2026-W44"
const prop = (value: string[]) => ({ value, type: "doctor" as const, status: "pending" as const })
const vals = (s: ReturnType<typeof generateWeekSchedule>, r: string, d: string) => s[r][d].value

function main() {
  // O ne fait jamais d'ETT : éligibilité + validation + proposition solveur retirée
  assert.ok(!(DOC022_CLINICAL_ELIGIBILITY.echo as readonly string[]).includes("O"))
  const base = generateWeekSchedule(wk, [])
  const refused = canAssignDoctorToSlot("O", "2026-10-27", "Matin - ETT salle 1", "MARDI", base, [])
  assert.equal(refused.allowed, false)
  assert.match(refused.reason || "", /ETT/)

  // Coro d'abord : W proposé en Cs PSS pendant que la Coro est vide → Coro pourvue par un M/O/W
  const s = generateWeekSchedule(wk, [])
  s["Matin - Cs PSS"].MARDI = prop(["W"])
  s["Matin - EE1"].MARDI = prop(["M"])
  s["Matin - ETT salle 1"].MARDI = prop(["O"])
  const out = applyClinicalPriorityRules(s, wk, [])
  const coro = vals(out, "Matin - Coro", "MARDI")
  assert.equal(coro.length, 1, "la Coro vide est pourvue")
  assert.ok(["M", "O", "W"].includes(coro[0]))
  assert.ok(!vals(out, "Matin - ETT salle 1", "MARDI").includes("O"), "O jamais en ETT")
  // Le coronarographiste en Coro n'est pas aussi en Cs / EE / ETT sur ce créneau
  for (const row of ["Matin - Cs PSS", "Matin - Cs Tessée", "Matin - EE1", "Matin - EE2", "Matin - ETT salle 1", "Matin - ETT salle 2"]) {
    assert.ok(!vals(out, row, "MARDI").includes(coro[0]), `${coro[0]} déjà en Coro : pas ${row}`)
  }

  // Groupe écho : ETT / Stress / Rééducation proposés avant le Cs
  const s2 = generateWeekSchedule(wk, [])
  s2["Apm - Cs PSS"].JEUDI = prop(["H"])
  const o2 = applyClinicalPriorityRules(s2, wk, [])
  const echoGroup = ["H", "Z", "G", "B", "S"]
  const onMainTask = (row: string) => vals(o2, row, "MERCREDI").some((d) => echoGroup.includes(d))
  assert.ok(
    onMainTask("Apm - ETT salle 1") || onMainTask("Apm - Stress") || onMainTask("Apm - RÉEDUCATION") ||
      onMainTask("Apm - ETT salle 2"),
    "un médecin du groupe écho est proposé à ETT/Stress/Rééducation",
  )
  // Le Cs PSS n'est jamais confié à U, B, S
  for (const day of ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI"])
    for (const row of ["Matin - Cs PSS", "Apm - Cs PSS"])
      for (const d of vals(o2, row, day)) assert.ok(!["U", "B", "S"].includes(d), `${d} jamais en Cs PSS`)

  // Cases validées / manuelles intactes
  const s3 = generateWeekSchedule(wk, [])
  s3["Matin - Cs PSS"].LUNDI = { value: ["W"], type: "doctor", status: "validated", manualAssignment: true }
  const o3 = applyClinicalPriorityRules(s3, wk, [])
  assert.deepEqual(vals(o3, "Matin - Cs PSS", "LUNDI"), ["W"])
  // Case vidée par l'admin : jamais repeuplée
  const s4 = generateWeekSchedule(wk, [])
  s4["Matin - ETT salle 1"].MERCREDI = { value: [], type: "empty", status: "validated", manuallyCleared: true }
  assert.deepEqual(vals(applyClinicalPriorityRules(s4, wk, []), "Matin - ETT salle 1", "MERCREDI"), [])

  // U lundi : retiré de Cs Tessée s'il est de garde ce jour-là
  const s5 = generateWeekSchedule(wk, [])
  s5["Matin - Cs Tessée"].LUNDI = { value: ["U"], type: "doctor", status: "validated" }
  s5["Apm - Cs Tessée"].LUNDI = { value: ["U"], type: "doctor", status: "validated" }
  s5["Garde Nuit"].LUNDI = prop(["U"])
  const o5 = applyClinicalPriorityRules(s5, wk, [])
  assert.ok(!vals(o5, "Matin - Cs Tessée", "LUNDI").includes("U"))
  assert.ok(!vals(o5, "Apm - Cs Tessée", "LUNDI").includes("U"))

  // Idempotent et branché dans la passe locale
  const again = applyClinicalPriorityRules(out, wk, [])
  assert.deepEqual(JSON.stringify(again), JSON.stringify(out))
  assert.ok(applyClinicalRotationRules(s, wk, []))

  console.log("✅ clinical-priority tests passed")
}

main()
