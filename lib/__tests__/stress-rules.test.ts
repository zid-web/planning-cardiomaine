/**
 * Run: bunx tsx lib/__tests__/stress-rules.test.ts
 */
import assert from "node:assert/strict"
import {
  applyStressAndDRules,
  applyStressClosedClear,
  isFirstThursdayOfMonth,
  isStressSlotClosed,
} from "@/lib/stress-rules"
import { applyStructuralConstraints } from "@/lib/apply-structural-constraints"
import { canAssignDoctorToSlot } from "@/lib/slot-blocking"
import { generateWeekSchedule } from "@/lib/schedule-utils"
import { dateStrForWeekDay } from "@/lib/fixed-assignments"

function main() {
  assert.equal(isStressSlotClosed("Apm - Stress", "MERCREDI"), true)
  assert.equal(isStressSlotClosed("Apm - Stress", "VENDREDI"), true)
  assert.equal(isStressSlotClosed("Apm - Stress", "JEUDI"), false)
  assert.equal(isStressSlotClosed("Matin - Stress", "MERCREDI"), false)

  assert.equal(isFirstThursdayOfMonth("2026-08-06"), true) // 1er jeudi août 2026
  assert.equal(isFirstThursdayOfMonth("2026-08-13"), false)
  assert.equal(isFirstThursdayOfMonth("2026-07-02"), true) // 1er jeudi juillet
  assert.equal(isFirstThursdayOfMonth("2026-07-09"), false)

  // Clear Mer/Ven Apm Stress
  let schedule = generateWeekSchedule("2026-W32", [])
  schedule["Apm - Stress"].MERCREDI = { value: ["G"], type: "doctor", status: "validated" }
  schedule["Apm - Stress"].VENDREDI = { value: ["S"], type: "doctor", status: "validated" }
  schedule = applyStressClosedClear(schedule)
  assert.deepEqual(schedule["Apm - Stress"].MERCREDI.value, [])
  assert.deepEqual(schedule["Apm - Stress"].VENDREDI.value, [])

  // W32 = 2026-08-03 → 2026-08-09 ; jeudi = 2026-08-06 = 1er jeudi du mois
  const w32Thu = dateStrForWeekDay("2026-W32", "JEUDI")
  assert.equal(w32Thu, "2026-08-06")
  assert.equal(isFirstThursdayOfMonth(w32Thu!), true)

  let first = generateWeekSchedule("2026-W32", [])
  first = applyStressAndDRules(first, "2026-W32", [])
  assert.deepEqual(first["Matin - Stress"].JEUDI.value, ["D"], "D Stress matin 1er jeudi")
  assert.deepEqual(first["Apm - Stress"].JEUDI.value, ["D"], "D Stress apm 1er jeudi")
  assert.ok(!(first["Apm - EE1"].JEUDI.value || []).includes("D"))
  assert.ok(!(first["Apm - EE2"].JEUDI.value || []).includes("D"))

  // W33 = jeudi 2026-08-13 = 2e jeudi → Stress matin + EE1/EE2 apm
  const w33Thu = dateStrForWeekDay("2026-W33", "JEUDI")
  assert.equal(w33Thu, "2026-08-13")
  assert.equal(isFirstThursdayOfMonth(w33Thu!), false)

  let other = generateWeekSchedule("2026-W33", [])
  other = applyStressAndDRules(other, "2026-W33", [])
  assert.deepEqual(other["Matin - Stress"].JEUDI.value, ["D"])
  assert.ok(!(other["Apm - Stress"].JEUDI.value || []).includes("D"))
  assert.deepEqual(other["Apm - EE1"].JEUDI.value, ["D"])
  assert.deepEqual(other["Apm - EE2"].JEUDI.value, ["D"])

  // Structural + canAssign
  let blocked = generateWeekSchedule("2026-W32", [])
  blocked["Apm - Stress"].MERCREDI = { value: ["G"], type: "doctor", status: "pending" }
  blocked = applyStructuralConstraints(blocked, "2026-W32", [])
  assert.deepEqual(blocked["Apm - Stress"].MERCREDI.value, [])
  assert.ok(blocked["Matin - Stress"].JEUDI.value.includes("D"))
  assert.ok(blocked["Matin - Stress"].JEUDI.value.includes("Véro"))

  const deny = canAssignDoctorToSlot(
    "G",
    "2026-08-05",
    "Apm - Stress",
    "MERCREDI",
    blocked,
    [],
  )
  assert.equal(deny.allowed, false)

  console.log("✅ stress-rules tests passed")
}

main()
