/**
 * Run: npx tsx lib/__tests__/voice-local-parse.test.ts
 */
import assert from "node:assert/strict"
import {
  isDoctorInValidationError,
  parseVoiceCommandLocally,
} from "@/lib/voice-local-parse"

function main() {
  const known = ["W", "O", "M", "S", "B", "Val", "DAAS", "FV"]

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

  assert.equal(
    isDoctorInValidationError(
      "Impossible d'interpréter la consigne vocale : 1 validation error for ParsedCommand\ndoctor_in\n  Input should be a valid string [type=string_type, input_value=None, input_type=NoneType]",
    ),
    true,
  )
  assert.equal(isDoctorInValidationError("timeout"), false)

  assert.equal(parseVoiceCommandLocally("bonjour", "2026-07-28", known), null)

  console.log("✅ voice-local-parse tests passed")
}

main()
