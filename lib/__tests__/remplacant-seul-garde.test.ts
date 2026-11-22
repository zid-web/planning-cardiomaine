import assert from "node:assert/strict"
import { generateWeekSchedule } from "@/lib/schedule-utils"
import { applyStructuralConstraints } from "@/lib/apply-structural-constraints"

// S47 mercredi : Z de garde matin + midi, NGOUO remplace Z la nuit → Z retiré de la Garde Nuit
const w: any = applyStructuralConstraints(generateWeekSchedule("2026-W47", []), "2026-W47", [], { isFreshWeek: true })
const c = (v: string[], extra: any = {}) => ({ value: v, type: "doctor", status: "validated", manualAssignment: true, ...extra })
w["Garde Matin"].MERCREDI = c(["Z", "I"])
w["Garde Midi"].MERCREDI = c(["Z"])
w["Garde Nuit"].MERCREDI = c(["NGOUO"], { remplacant: "NGOUO" })
const out: any = applyStructuralConstraints(w, "2026-W47", [], { isFreshWeek: false })
assert.deepEqual(out["Garde Nuit"].MERCREDI.value, ["NGOUO"], "remplaçant seul la nuit de semaine")
assert.deepEqual(out["Garde Midi"].MERCREDI.value, ["Z"])

// Case de nuit vide : le couplage continue de la remplir avec le médecin de garde
w["Garde Nuit"].MERCREDI = { value: [], type: "empty", status: "validated" }
const out2: any = applyStructuralConstraints(w, "2026-W47", [], { isFreshWeek: false })
assert.ok(out2["Garde Nuit"].MERCREDI.value.includes("Z"), "couplage normal conservé")
console.log("✅ remplaçant seul sur garde de semaine")
