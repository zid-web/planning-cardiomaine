/**
 * Run: npx tsx lib/__tests__/garde-matin-rules.test.ts
 */
import assert from "node:assert/strict"
import { applyGardeMatinInternAndCsPss, applySGardePriorityOverEttPed, applyUGardePriorityOverCsTessee } from "@/lib/garde-matin-rules"
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

// U de garde le lundi : plus de Cs Tessée ce jour-là (la garde passe en priorité) ; mercredi inchangé
{

  const u: any = applyStructuralConstraints(generateWeekSchedule("2026-W49", []), "2026-W49", [], { isFreshWeek: true })
  assert.ok(u["Matin - Cs Tessée"].LUNDI.value.includes("U"), "Cs Tessée fixe de U le lundi")
  u["Garde Nuit"].LUNDI = c(["U"])
  u["Garde Matin"].LUNDI = c(["U"])
  const out = applyStructuralConstraints(u, "2026-W49", [], { isFreshWeek: false })
  assert.ok(!out["Matin - Cs Tessée"].LUNDI.value.includes("U"))
  assert.ok(!out["Apm - Cs Tessée"].LUNDI.value.includes("U"))
  assert.equal(out["Matin - Cs PSS"].LUNDI.patientCounts?.U, 4, "U de Garde Matin en Cs PSS (4)")
  assert.ok(out["Matin - Cs Tessée"].MARDI.value.includes("U"), "mardi sans garde : Cs Tessée conservée")
  assert.deepEqual(applyUGardePriorityOverCsTessee(out), out)
  console.log("✅ U garde prioritaire sur Cs Tessée")
}

// S de garde mercredi midi : l'ETT pédiatrique saute ; sans garde elle reste
{
  const sp: any = applyStructuralConstraints(generateWeekSchedule("2026-W49", []), "2026-W49", [], { isFreshWeek: true })
  assert.ok(sp["Apm - ETT salle 1"].MERCREDI.value.includes("S"), "ETT ped fixe de S")
  const kept = applyStructuralConstraints(sp, "2026-W49", [], { isFreshWeek: false })
  assert.ok(kept["Apm - ETT salle 1"].MERCREDI.value.includes("S"), "sans garde : ETT ped conservée")
  sp["Garde Midi"].MERCREDI = c(["S"])
  const out = applyStructuralConstraints(sp, "2026-W49", [], { isFreshWeek: false })
  assert.ok(!out["Apm - ETT salle 1"].MERCREDI.value.includes("S"), "garde midi : ETT ped annulée")
  assert.deepEqual(applySGardePriorityOverEttPed(out), out)
  console.log("✅ S garde prioritaire sur ETT ped")
}

// Garde Matin + I : Coro interdite le matin, autorisée l'après-midi (W, S44)
{
  const w: any = generateWeekSchedule("2026-W44", [])
  w["Garde Matin"].MARDI = c(["W", "I"])
  assert.equal(canAssignDoctorToSlot("W", "2026-10-27", "Apm - Coro", "MARDI", w, []).allowed, true)
  assert.equal(canAssignDoctorToSlot("W", "2026-10-27", "Matin - Coro", "MARDI", w, []).allowed, false)
  w["Apm - Coro"].MARDI = c(["W"])
  const out = applyStructuralConstraints(w, "2026-W44", [], { isFreshWeek: false })
  assert.ok(out["Apm - Coro"].MARDI.value.includes("W"), "Coro après-midi conservée")
  console.log("✅ Garde Matin + Coro après-midi")
}

// Cs PSS (4) non obligatoire : retirée par l'admin (csPssDeclined), elle n'est pas remise ;
// un nouveau médecin de garde réactive la règle
{
  const d: any = generateWeekSchedule("2026-W48", [])
  d["Garde Matin"].MARDI = c(["B", "I"])
  d["Matin - Cs PSS"].MARDI = { value: ["H"], type: "doctor", status: "validated", csPssDeclined: "B" }
  const kept = applyGardeMatinInternAndCsPss(d, "2026-W48")
  assert.deepEqual(kept["Matin - Cs PSS"].MARDI.value, ["H"], "Cs PSS retirée par l'admin : pas remise")
  // L'admin remet B lui-même : l'indice (4) revient
  const readded: any = structuredClone(kept)
  readded["Matin - Cs PSS"].MARDI.value = ["H", "B"]
  const back = applyGardeMatinInternAndCsPss(readded, "2026-W48")
  assert.deepEqual(back["Matin - Cs PSS"].MARDI.patientCounts, { B: 4 }, "remis par l'admin : (4) revient")
  assert.equal(back["Matin - Cs PSS"].MARDI.csPssDeclined, undefined)
  d["Garde Matin"].MARDI = c(["Z", "I"])
  const again = applyGardeMatinInternAndCsPss(d, "2026-W48")
  assert.deepEqual(again["Matin - Cs PSS"].MARDI.value, ["H", "Z"])
  assert.equal(again["Matin - Cs PSS"].MARDI.csPssDeclined, undefined)
  console.log("✅ Cs PSS (4) retirable")
}

// Affectation forcée par l'admin : conservée malgré la règle, sauf congé
{
  const { restoreForcedAssignments } = require("@/lib/forced-assignments")
  const f: any = generateWeekSchedule("2026-W48", [])
  // W en Coro matin forcé alors qu'il est de Garde Matin avec I (normalement retiré)
  f["Garde Matin"].MARDI = c(["W", "I"])
  f["Matin - Coro"].MARDI = { value: ["W"], type: "doctor", status: "validated", forced: ["W"] }
  const out = applyStructuralConstraints(f, "2026-W48", [], { isFreshWeek: false })
  assert.ok(out["Matin - Coro"].MARDI.value.includes("W"), "affectation forcée conservée")
  const noForce: any = structuredClone(f); delete noForce["Matin - Coro"].MARDI.forced
  assert.ok(!applyStructuralConstraints(noForce, "2026-W48", [], { isFreshWeek: false })["Matin - Coro"].MARDI.value.includes("W"), "sans forçage : retiré par la règle")
  const vac: any[] = [{ id: "v", doctor_id: "W", start_date: "2026-11-24", end_date: "2026-11-24" }]
  assert.ok(!restoreForcedAssignments(f, { ...f, "Matin - Coro": { ...f["Matin - Coro"], MARDI: { ...f["Matin - Coro"].MARDI, value: [] } } }, "2026-W48", vac)["Matin - Coro"].MARDI.value.includes("W"), "en congé : jamais remis")
  console.log("✅ affectation forcée")
}

// FV (externe) en Garde Matin : ni I ni Cs PSS (4)
{
  const fv: any = generateWeekSchedule("2026-W48", [])
  fv["Garde Matin"].LUNDI = c(["FV"])
  const o = applyGardeMatinInternAndCsPss(fv, "2026-W48")
  assert.deepEqual(o["Garde Matin"].LUNDI.value, ["FV"])
  assert.equal(o["Matin - Cs PSS"].LUNDI.patientCounts, undefined)
  console.log("✅ FV exclu")
}
