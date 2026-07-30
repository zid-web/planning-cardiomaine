/**
 * Run: bunx tsx lib/__tests__/speech-recognition.test.ts
 */
import assert from "node:assert/strict"
import {
  collectSpeechTranscript,
  isRecoverableSpeechError,
  speechErrorMessage,
} from "@/lib/speech-recognition"
import { applyParsedCommandToSchedule } from "@/lib/guard-api-mapping"
import { generateWeekSchedule } from "@/lib/schedule-utils"

function main() {
  assert.match(speechErrorMessage("not-allowed"), /Micro refusé/i)
  assert.match(speechErrorMessage("not-supported"), /Chrome/i)
  assert.equal(speechErrorMessage("aborted"), "")
  assert.equal(speechErrorMessage("no-speech"), "", "no-speech non bloquant")
  assert.equal(isRecoverableSpeechError("no-speech"), true)
  assert.equal(isRecoverableSpeechError("aborted"), true)
  assert.equal(isRecoverableSpeechError("not-allowed"), false)

  const { finalText, displayText } = collectSpeechTranscript(
    {
      resultIndex: 0,
      results: [
        { isFinal: true, 0: { transcript: "demain S remplace B" } },
        { isFinal: false, 0: { transcript: " en garde" } },
      ],
    },
    "",
  )
  assert.equal(finalText.trim(), "demain S remplace B")
  assert.match(displayText, /garde/)

  // Remplacement chirurgical garde nuit
  const week = generateWeekSchedule("2026-W30")
  // Lundi 2026-07-20
  week["Garde Nuit"].LUNDI.value = ["B"]
  const after = applyParsedCommandToSchedule(week, {
    date: "2026-07-20",
    slot: "nuit",
    activity: "GARDE",
    doctor_out: "B",
    doctor_in: "S",
  })
  assert.deepEqual(after["Garde Nuit"].LUNDI.value, ["S"])
  assert.equal(after["Garde Nuit"].LUNDI.status, "validated")

  // Congés via commande vocale
  const withLeave = applyParsedCommandToSchedule(week, {
    date: "2026-07-20",
    slot: "matin",
    activity: "VACANCES",
    doctor_in: "Z",
  })
  assert.ok(withLeave["Congés"].LUNDI.value.includes("Z"))

  console.log("speech-recognition + applyParsedCommand tests OK")
}

main()
