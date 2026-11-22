import assert from "node:assert/strict"
import { generateWeekSchedule } from "@/lib/schedule-utils"
import { applyStructuralConstraints } from "@/lib/apply-structural-constraints"

// Visite : la semaine est remplie par la rotation ; changer un seul jour ne touche pas les autres
const w: any = applyStructuralConstraints(generateWeekSchedule("2026-W49", []), "2026-W49", [], { isFreshWeek: true })
const days = ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI"]
const titulaire = w["Matin - Visite"].LUNDI.value[0]
assert.ok(["U", "A", "B"].includes(titulaire))
for (const d of days) assert.deepEqual(w["Matin - Visite"][d].value, [titulaire], `visite ${d}`)
const autre = titulaire === "B" ? "A" : "B"
w["Matin - Visite"].MERCREDI = { ...w["Matin - Visite"].MERCREDI, value: [autre], manualAssignment: true }
const out: any = applyStructuralConstraints(w, "2026-W49", [], { isFreshWeek: false })
assert.deepEqual(out["Matin - Visite"].MERCREDI.value, [autre], "jour modifié conservé")
for (const d of days.filter((d) => d !== "MERCREDI")) assert.deepEqual(out["Matin - Visite"][d].value, [titulaire], `autre jour ${d} inchangé`)
console.log("✅ visite modifiable jour par jour")
