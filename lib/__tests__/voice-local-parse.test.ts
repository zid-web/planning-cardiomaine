/**
 * Run: bunx tsx lib/__tests__/voice-local-parse.test.ts
 */
import assert from "node:assert/strict"
import {
  isDoctorInValidationError,
  isUnrecognizedSlotActivityError,
  parseVoiceCommandLocally,
  shouldUseLocalVoiceFallback,
} from "@/lib/voice-local-parse"
import { applyParsedCommandToSchedule, resolveRowKey } from "@/lib/guard-api-mapping"
import { generateWeekSchedule } from "@/lib/schedule-utils"

function main() {
  const known = ["W", "O", "M", "S", "B", "Val", "DAAS", "FV", "CH"]

  const a = parseVoiceCommandLocally("S est de garde demain soir", "2026-07-28", known)
  assert.ok(a)
  assert.equal(a!.doctor_in, "S")
  assert.equal(a!.date, "2026-07-29")
  assert.equal(a!.activity, "GARDE")
  assert.equal(a!.slot, "nuit")

  const b = parseVoiceCommandLocally("W remplace M en coro jeudi", "2026-07-28", known)
  assert.ok(b)
  assert.equal(b!.doctor_in, "W")
  assert.equal(b!.doctor_out, "M")
  assert.equal(b!.activity, "CORO")

  const c = parseVoiceCommandLocally("Val en congés vendredi", "2026-07-28", known)
  assert.ok(c)
  assert.equal(c!.doctor_in, "Val")
  assert.equal(c!.activity, "VACANCES")

  // Week-end ATL : slot=weekend pour mapping front (Render 422 sinon)
  // 2026-07-28 = mardi → samedi = 2026-08-01
  const we = parseVoiceCommandLocally("M est d'astreinte samedi", "2026-07-28", known)
  assert.ok(we)
  assert.equal(we!.doctor_in, "M")
  assert.equal(we!.activity, "ASTREINTE")
  assert.equal(we!.slot, "weekend")
  assert.equal(we!.date, "2026-08-01")
  assert.equal(resolveRowKey(we!.slot, we!.activity, "SAMEDI"), "Astreintes ATL Matin")

  const week = generateWeekSchedule("2026-W31", [])
  const after = applyParsedCommandToSchedule(week, {
    date: "2026-08-01",
    slot: "weekend",
    activity: "ASTREINTE",
    doctor_in: "M",
  })
  assert.ok(after["Astreintes ATL Matin"].SAMEDI.value.includes("M"))

  assert.equal(
    isDoctorInValidationError(
      "Impossible d'interpréter la consigne vocale : 1 validation error for ParsedCommand\ndoctor_in\n  Input should be a valid string [type=string_type, input_value=None, input_type=NoneType]",
    ),
    true,
  )
  assert.equal(isDoctorInValidationError("timeout"), false)

  assert.equal(
    isUnrecognizedSlotActivityError(
      "Combinaison créneau/activité non reconnue : weekend / ASTREINTE",
    ),
    true,
  )
  assert.equal(
    shouldUseLocalVoiceFallback(
      "Combinaison créneau/activité non reconnue : weekend / ASTREINTE",
    ),
    true,
  )
  assert.equal(isUnrecognizedSlotActivityError("timeout"), false)

  assert.equal(parseVoiceCommandLocally("bonjour", "2026-07-28", known), null)

  console.log("✅ voice-local-parse tests passed")
}

main()
