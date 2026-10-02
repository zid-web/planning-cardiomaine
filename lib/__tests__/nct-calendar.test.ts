/**
 * Run: bunx tsx lib/__tests__/nct-calendar.test.ts
 */
import assert from "node:assert/strict"
import {
  DEFAULT_NCT_CALENDAR,
  diffNctCalendars,
  getNctCalendar,
  nctDoctorForDate,
  normalizeNctCalendar,
  parseNctCalendarSetting,
  serializeNctCalendar,
  setNctCalendar,
  withNctEntry,
} from "@/lib/nct-calendar"
import { applyStructuralConstraints } from "@/lib/apply-structural-constraints"
import { generateWeekSchedule } from "@/lib/schedule-utils"
import { NCT_DATES_2026 } from "@/lib/guard-scheduler"

const NCT = "Hors site - NCT"

function main() {
  // Défaut : identique aux anciennes constantes
  assert.equal(getNctCalendar().length, DEFAULT_NCT_CALENDAR.length)
  assert.equal(NCT_DATES_2026.length, 28)
  assert.equal(nctDoctorForDate("2026-09-10"), "W")
  assert.equal(nctDoctorForDate("2026-09-11"), null)

  // Normalisation : dates invalides retirées, doublons (dernier gagne), tri, majuscules
  assert.deepEqual(
    normalizeNctCalendar([
      { date: "2027-02-04", user: "m" },
      { date: "2027-01-14", user: "W" },
      { date: "2027-02-30", user: "W" }, // date inexistante
      { date: "pas-une-date", user: "W" },
      { date: "2027-01-14", user: "M" }, // doublon : le dernier gagne
      { date: "2027-03-04", user: "" },
    ]),
    [
      { date: "2027-01-14", user: "M" },
      { date: "2027-02-04", user: "M" },
    ],
  )
  assert.equal(parseNctCalendarSetting("pas du json"), null)
  assert.deepEqual(parseNctCalendarSetting(serializeNctCalendar([{ date: "2027-01-14", user: "W" }])), [
    { date: "2027-01-14", user: "W" },
  ])

  // Diff
  const before = [
    { date: "2027-01-14", user: "W" },
    { date: "2027-01-21", user: "M" },
    { date: "2027-01-28", user: "W" },
  ]
  const after = withNctEntry(withNctEntry(withNctEntry(before, "2027-01-21", null), "2027-01-28", "M"), "2027-02-04", "W")
  assert.deepEqual(diffNctCalendars(before, after), {
    added: [{ date: "2027-02-04", user: "W" }],
    removed: [{ date: "2027-01-21", user: "M" }],
    changed: [{ date: "2027-01-28", user: "M" }],
  })

  // --- Contraintes structurelles avec calendrier personnalisé ---
  try {
    // Semaine 2026-W37 : Jeudi 2026-09-10 = W par défaut
    const wk = "2026-W37"
    let s = applyStructuralConstraints(generateWeekSchedule(wk, []), wk, [])
    assert.deepEqual(s[NCT].JEUDI.value, ["W"])

    // Réaffectation W → M
    setNctCalendar(withNctEntry(DEFAULT_NCT_CALENDAR, "2026-09-10", "M"))
    s = applyStructuralConstraints(s, wk, [])
    assert.deepEqual(s[NCT].JEUDI.value, ["M"])

    // Date ajoutée (2027-01-14, jeudi de la S2 2027)
    setNctCalendar(withNctEntry(DEFAULT_NCT_CALENDAR, "2027-01-14", "W"))
    const wk27 = "2027-W02"
    const s27 = applyStructuralConstraints(generateWeekSchedule(wk27, []), wk27, [])
    assert.deepEqual(s27[NCT].JEUDI.value, ["W"])
    // Seed de semaine neuve : même résultat sans passer par les contraintes
    assert.deepEqual(generateWeekSchedule(wk27, [])[NCT].JEUDI.value, ["W"])

    // Date supprimée : plus injectée sur une semaine neuve
    setNctCalendar(withNctEntry(DEFAULT_NCT_CALENDAR, "2026-09-10", null))
    const fresh = applyStructuralConstraints(generateWeekSchedule(wk, []), wk, [])
    assert.deepEqual(fresh[NCT].JEUDI.value, [])
  } finally {
    setNctCalendar(null)
  }
  assert.equal(nctDoctorForDate("2026-09-10"), "W")

  console.log("✅ nct-calendar tests passed")
}

main()
