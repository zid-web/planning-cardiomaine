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
