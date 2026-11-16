import assert from "node:assert/strict"
import { applyEntreesPssRules } from "../entrees-pss"

const c = (value: string[]) => ({ value, type: "doctor" as const, status: "pending" as const })
const s: any = {
  "Garde Midi": { LUNDI: c(["U"]), MARDI: c(["B"]), MERCREDI: c(["S"]), JEUDI: c(["G"]), VENDREDI: c(["A"]) },
  "Entrées PSS": { LUNDI: c(["H"]), MARDI: c(["B", "Z"]), MERCREDI: c(["H"]), JEUDI: c([]), VENDREDI: c(["Z"]) },
}
const r = applyEntreesPssRules(s)["Entrées PSS"]
assert.deepEqual(r.LUNDI.value, ["U", "H"])
assert.deepEqual(r.MARDI.value, ["B", "Z"])
assert.deepEqual(r.MERCREDI.value, ["S"])
assert.deepEqual(r.JEUDI.value, ["G"])
assert.deepEqual(r.VENDREDI.value, ["A"])
console.log("entrees-pss OK")

// Entrées PSS : proposée seulement avec « Générer » (fill), pas à l'ouverture d'une semaine
import { applyStructuralConstraints } from "../apply-structural-constraints"
import { generateWeekSchedule } from "../schedule-utils"
{
  const wk = "2026-W47"
  const base: any = generateWeekSchedule(wk, [])
  base["Garde Midi"].MERCREDI = { value: ["P"], type: "doctor", status: "pending" }
  base["Garde Nuit"].MERCREDI = { value: ["P"], type: "doctor", status: "pending" }
  const opened = applyStructuralConstraints(base, wk, [], { isFreshWeek: false, fill: false })
  assert.deepEqual(opened["Entrées PSS"].MERCREDI.value, [])
  const generated = applyStructuralConstraints(base, wk, [], { isFreshWeek: false })
  assert.deepEqual(generated["Entrées PSS"].MERCREDI.value, ["P"])
  console.log("entrees-pss (Générer uniquement) OK")
}
