/**
 * Run: bunx tsx lib/__tests__/hors-site-libre.test.ts
 * Hors site : toutes les cases sont libres (modifiables ou vides) ; NCT = calendrier NCT seul.
 */
import assert from "node:assert/strict"
import { applyStructuralConstraints } from "@/lib/apply-structural-constraints"
import { isSlotClosed } from "@/lib/closed-slots"
import { canAssignDoctorToSlot } from "@/lib/slot-blocking"
import { validateProposalsLikeManual, type RejectedProposal } from "@/lib/clinical-priority"
import { getNctCalendar, setNctCalendar, isNctClosedOnDate } from "@/lib/nct-calendar"
import { generateWeekSchedule } from "@/lib/schedule-utils"

const wk = "2026-W44"
const HS = ["Hors site - CDL", "Hors site - IRM", "Hors site - Scinti", "Hors site - LFB", "Hors site - PSSL", "Hors site - NCT"]

function main() {
  // Plus aucune fermeture structurelle sur les lignes hors site
  for (const row of HS) for (const day of ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI"])
    assert.equal(isSlotClosed(row, day), false, `${row} ${day} n'est plus fermée`)

  // Une case hors site saisie à la main un jour « inhabituel » est conservée
  const s = generateWeekSchedule(wk, [])
  s["Hors site - CDL"].LUNDI = { value: ["O"], type: "doctor", status: "validated", manualAssignment: true }
  s["Hors site - PSSL"].MARDI = { value: ["B"], type: "doctor", status: "validated", manualAssignment: true }
  const out = applyStructuralConstraints(s, wk, [])
  assert.deepEqual(out["Hors site - CDL"].LUNDI.value, ["O"])
  assert.deepEqual(out["Hors site - PSSL"].MARDI.value, ["B"])

  // Case LFB vidée par l'admin : jamais re-remplie
  const s2 = generateWeekSchedule(wk, [])
  s2["Hors site - LFB"].JEUDI = { value: [], type: "empty", status: "validated", manuallyCleared: true }
  assert.deepEqual(applyStructuralConstraints(s2, wk, [])["Hors site - LFB"].JEUDI.value, [])

  // Mais le solveur ne propose que les jours habituels
  const s3 = generateWeekSchedule(wk, [])
  s3["Hors site - LFB"].LUNDI = { value: ["H"], type: "doctor", status: "pending" }
  s3["Hors site - LFB"].JEUDI = { value: ["G"], type: "doctor", status: "pending" }
  const rej: RejectedProposal[] = []
  const v = validateProposalsLikeManual(s3, wk, [], rej)
  assert.deepEqual(v["Hors site - LFB"].LUNDI.value, [])
  assert.deepEqual(v["Hors site - LFB"].JEUDI.value, ["G"])

  // NCT : uniquement le calendrier. W44 jeudi 29/10/2026 ouvert, mardi 27/10 non.
  const prev = [...getNctCalendar()]
  setNctCalendar([{ date: "2026-10-29", user: "W" }, { date: "2026-11-03", user: "M" }])
  try {
    assert.equal(isNctClosedOnDate("2026-10-29"), false)
    assert.equal(isNctClosedOnDate("2026-10-27"), true)
    assert.equal(canAssignDoctorToSlot("W", "2026-10-27", "Hors site - NCT", "MARDI", generateWeekSchedule(wk, []), []).allowed, false)
    assert.equal(canAssignDoctorToSlot("W", "2026-10-29", "Hors site - NCT", "JEUDI", generateWeekSchedule(wk, []), []).allowed, true)

    const sn = generateWeekSchedule(wk, [])
    sn["Hors site - NCT"].MARDI = { value: ["W"], type: "doctor", status: "validated" } // date hors calendrier
    const on = applyStructuralConstraints(sn, wk, [])
    assert.deepEqual(on["Hors site - NCT"].MARDI.value, [], "NCT vidée hors calendrier")
    assert.deepEqual(on["Hors site - NCT"].JEUDI.value, ["W"], "NCT posée par le calendrier")
    // Semaine suivante : le 03/11 (mardi) est ouvert
    const on2 = applyStructuralConstraints(generateWeekSchedule("2026-W45", []), "2026-W45", [])
    assert.deepEqual(on2["Hors site - NCT"].MARDI.value, ["M"])
  } finally {
    setNctCalendar(prev)
  }

  console.log("✅ hors-site-libre tests passed")
}

main()
