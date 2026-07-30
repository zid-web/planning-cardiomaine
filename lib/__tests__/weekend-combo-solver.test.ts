/**
 * Run: bunx tsx lib/__tests__/weekend-combo-solver.test.ts
 */
import assert from "node:assert/strict"
import {
  buildWeekendComboSolverFields,
  extractComboGardeDoctor,
  resolveLastComboGardeFromSchedule,
  saturdayIsoForWeekKey,
} from "@/lib/weekend-combo-solver"
import { buildCurrentWeekRequestPayload } from "@/lib/guard-api-mapping"
import { generateWeekSchedule } from "@/lib/schedule-utils"

function main() {
  // Non-combo → null (ne rien envoyer)
  assert.equal(buildWeekendComboSolverFields("2026-W40"), null, "W40 mono")
  assert.equal(buildWeekendComboSolverFields("2026-W31"), null, "impaire")

  // Combo preset W42 : O ATL, M Garde
  const w42 = buildWeekendComboSolverFields("2026-W42", {
    doctor: "W",
    date: "2026-09-05",
  })
  assert.ok(w42)
  assert.equal(w42!.weekend_astreinte_combo, true)
  assert.equal(w42!.weekend_combo_astreinte_anchor, "O")
  assert.equal(w42!.weekend_combo_garde_anchor, "M")
  assert.equal(w42!.last_combo_garde_doctor, "W")
  assert.equal(w42!.last_combo_garde_date, "2026-09-05")

  // Combo W44
  const w44 = buildWeekendComboSolverFields("2026-W44")
  assert.ok(w44)
  assert.equal(w44!.weekend_combo_astreinte_anchor, "W")
  assert.equal(w44!.weekend_combo_garde_anchor, "O")
  assert.equal(w44!.last_combo_garde_doctor, undefined)

  // H1 combo sans preset médecins explicites mais calendrier combo
  const w16 = buildWeekendComboSolverFields("2026-W16")
  assert.ok(w16?.weekend_astreinte_combo)
  assert.ok(["M", "O", "W"].includes(w16!.weekend_combo_astreinte_anchor))
  assert.ok(["M", "O", "W"].includes(w16!.weekend_combo_garde_anchor))
  assert.notEqual(w16!.weekend_combo_astreinte_anchor, w16!.weekend_combo_garde_anchor)

  // Samedi ISO
  assert.equal(saturdayIsoForWeekKey("2026-W42"), "2026-10-17")

  // Extract garde réel
  let schedule = generateWeekSchedule("2026-W42", [])
  schedule["Garde Midi"].SAMEDI = { value: ["M"], type: "doctor", status: "pending" }
  assert.equal(extractComboGardeDoctor(schedule), "M")
  const resolved = resolveLastComboGardeFromSchedule("2026-W42", schedule)
  assert.deepEqual(resolved, { doctor: "M", date: "2026-10-17" })
  assert.equal(resolveLastComboGardeFromSchedule("2026-W40", schedule), null)

  // Payload voice/generate builder inclut combo
  const payloadCombo = buildCurrentWeekRequestPayload({
    weekStartDate: "2026-10-12",
    weekNumber: 42,
    weekKey: "2026-W42",
    lastComboGardeDoctor: "O",
    lastComboGardeDate: "2026-09-19",
  })
  assert.equal(payloadCombo.weekend_astreinte_combo, true)
  assert.equal(payloadCombo.weekend_combo_astreinte_anchor, "O")
  assert.equal(payloadCombo.weekend_combo_garde_anchor, "M")
  assert.equal(payloadCombo.last_combo_garde_doctor, "O")
  assert.equal(payloadCombo.last_combo_garde_date, "2026-09-19")

  const payloadMono = buildCurrentWeekRequestPayload({
    weekStartDate: "2026-09-28",
    weekNumber: 40,
    weekKey: "2026-W40",
  })
  assert.equal(payloadMono.weekend_astreinte_combo, undefined)
  assert.equal(payloadMono.weekend_combo_astreinte_anchor, undefined)

  console.log("✅ weekend-combo-solver tests passed")
}

main()
