/**
 * Run: bunx tsx lib/__tests__/holiday-closed.test.ts
 * Règle absolue : jour férié → tout fermé sauf Astreintes ATL et Gardes.
 */
import assert from "node:assert/strict"
import { applyStructuralConstraints } from "@/lib/apply-structural-constraints"
import { applyHolidayClosedClear, holidayNameForWeekDay, isHolidayClosedSlot } from "@/lib/holiday-closed"
import { canAssignDoctorToSlot } from "@/lib/slot-blocking"
import { generateWeekSchedule } from "@/lib/schedule-utils"
import { DAYS } from "@/lib/constants"

function main() {
  // 11/11/2026 = mercredi de la S46
  const wk = "2026-W46"
  assert.equal(holidayNameForWeekDay(wk, "MERCREDI"), "Armistice 1918")
  assert.equal(holidayNameForWeekDay(wk, "JEUDI"), null)

  assert.equal(isHolidayClosedSlot("Matin - Cs PSS", "Noël"), true)
  assert.equal(isHolidayClosedSlot("Hors site - NCT", "Noël"), true)
  assert.equal(isHolidayClosedSlot("Congés", "Noël"), true)
  assert.equal(isHolidayClosedSlot("Astreintes ATL Nuit", "Noël"), false)
  assert.equal(isHolidayClosedSlot("Garde Midi", "Noël"), false)
  assert.equal(isHolidayClosedSlot("Matin - Cs PSS", null), false)

  const base = generateWeekSchedule(wk, [])
  const s = structuredClone(base)
  const put = (row: string, day: string, value: string[]) => {
    s[row][day] = { value, type: "doctor", status: "validated", manualAssignment: true }
  }
  put("Matin - Cs PSS", "MERCREDI", ["P"])
  put("Apm - Stress", "MERCREDI", ["B"])
  put("Matin - Cs PSS", "JEUDI", ["P"])
  put("Astreintes ATL Nuit", "MERCREDI", ["M"])
  put("Garde Nuit", "MERCREDI", ["W"])

  const cleared = applyHolidayClosedClear(s, wk)
  assert.deepEqual(cleared["Matin - Cs PSS"].MERCREDI.value, [])
  assert.deepEqual(cleared["Apm - Stress"].MERCREDI.value, [])
  assert.deepEqual(cleared["Matin - Cs PSS"].JEUDI.value, ["P"])
  assert.deepEqual(cleared["Astreintes ATL Nuit"].MERCREDI.value, ["M"])
  assert.deepEqual(cleared["Garde Nuit"].MERCREDI.value, ["W"])

  // Le moteur complet ne repose rien sur un jour férié (hors ATL / Gardes)
  const full = applyStructuralConstraints(s, wk, [])
  for (const [row, days] of Object.entries(full)) {
    if (row === "Notes du jour" || row.includes("Astreintes ATL") || row.includes("Garde")) continue
    assert.deepEqual(days.MERCREDI?.value ?? [], [], `${row} doit être vide le 11/11`)
  }
  assert.deepEqual(full["Astreintes ATL Nuit"].MERCREDI.value.includes("M"), true)

  // Validation d'assignation : refus un jour férié, accepté ailleurs / sur ATL
  const refused = canAssignDoctorToSlot("P", "2026-11-11", "Matin - Cs PSS", "MERCREDI", base, [])
  assert.equal(refused.allowed, false)
  assert.match(refused.reason || "", /férié/i)
  assert.equal(canAssignDoctorToSlot("Dupont", "2026-11-11", "Matin - Cs PSS", "MERCREDI", base, []).allowed, false)
  assert.equal(canAssignDoctorToSlot("M", "2026-11-11", "Garde Nuit", "MERCREDI", base, []).reason?.includes("férié") ?? false, false)
  assert.equal(canAssignDoctorToSlot("P", "2026-11-12", "Matin - Cs PSS", "JEUDI", base, []).allowed, true)

  assert.equal(DAYS.length, 7)
  console.log("✅ holiday-closed tests passed")
}

main()
