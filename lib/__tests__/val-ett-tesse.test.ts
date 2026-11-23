import assert from "node:assert/strict"
import { generateWeekSchedule } from "@/lib/schedule-utils"
import { applyStructuralConstraints } from "@/lib/apply-structural-constraints"
import { canAssignDoctorToSlot } from "@/lib/slot-blocking"
import { dateStrForWeekDay } from "@/lib/fixed-assignments"

// Val retirée à la main de l'ETT Tessé (case vidée) : pas remise, et réaffectable ailleurs
const wk = "2026-W50"
const w: any = applyStructuralConstraints(generateWeekSchedule(wk, []), wk, [], { isFreshWeek: true })
assert.ok(w["Matin - ETT Tessé"].MARDI.value.includes("Val"), "planning fixe : Val mardi matin à l'ETT Tessé")
w["Matin - ETT Tessé"].MARDI = { ...w["Matin - ETT Tessé"].MARDI, value: [], type: "empty", manuallyCleared: true }
const date = dateStrForWeekDay(wk, "MARDI")!
const ok = canAssignDoctorToSlot("Val", date, "Matin - ETT salle 2", "MARDI", w, [])
assert.equal(ok.allowed, true, `Val réaffectable : ${ok.reason ?? ""}`)
w["Matin - ETT salle 2"].MARDI = { value: ["Val"], type: "doctor", status: "validated", manualAssignment: true }
const out: any = applyStructuralConstraints(w, wk, [], { isFreshWeek: false })
assert.deepEqual(out["Matin - ETT Tessé"].MARDI.value, [], "pas remise à l'ETT Tessé")
assert.ok(out["Matin - ETT salle 2"].MARDI.value.includes("Val"), "nouvelle affectation conservée")
console.log("✅ Val retirée de l'ETT Tessé et réaffectée")
