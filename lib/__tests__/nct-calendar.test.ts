/**
 * Run: bunx tsx lib/__tests__/nct-calendar.test.ts
 */
import assert from "node:assert/strict"
import {
  buildMonthGrid,
  cycleNctUser,
  shiftMonth,
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
import {
  easterSunday,
  publicHolidayName,
  publicHolidays,
  SCHOOL_HOLIDAYS_ZONE_B,
  schoolHolidayZoneB,
} from "@/lib/french-calendar"

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

  // --- Aides d'affichage calendrier ---
  assert.deepEqual(shiftMonth(2026, 11, 1), { year: 2027, month0: 0 })
  assert.deepEqual(shiftMonth(2027, 0, -1), { year: 2026, month0: 11 })
  assert.deepEqual(shiftMonth(2026, 5, 14), { year: 2027, month0: 7 })
  assert.equal(cycleNctUser(null), "W")
  assert.equal(cycleNctUser("W"), "M")
  assert.equal(cycleNctUser("M"), null)
  assert.equal(cycleNctUser("O"), "W")

  // Octobre 2026 : le 1er est un jeudi → 3 cases vides avant, grille lundi→dimanche
  const oct = buildMonthGrid(2026, 9)
  assert.equal(oct.length, 5)
  assert.ok(oct.every((w) => w.length === 7))
  assert.equal(oct[0][3].date, "2026-10-01")
  assert.equal(oct[0][3].inMonth, true)
  assert.equal(oct[0][2].inMonth, false)
  assert.equal(oct[0][0].date, "2026-09-28")
  assert.equal(oct[4][6].date, "2026-11-01")
  // Février 2027 : commence un lundi, 28 jours → 4 lignes exactement
  assert.equal(buildMonthGrid(2027, 1).length, 4)

  // --- Jours fériés ---
  assert.equal(easterSunday(2025).toISOString().slice(0, 10), "2025-04-20")
  assert.equal(easterSunday(2026).toISOString().slice(0, 10), "2026-04-05")
  assert.equal(easterSunday(2027).toISOString().slice(0, 10), "2027-03-28")
  assert.equal(publicHolidays(2026).size, 11)
  assert.equal(publicHolidayName("2026-04-06"), "Lundi de Pâques")
  assert.equal(publicHolidayName("2026-05-14"), "Ascension")
  assert.equal(publicHolidayName("2026-05-25"), "Lundi de Pentecôte")
  assert.equal(publicHolidayName("2027-03-29"), "Lundi de Pâques")
  assert.equal(publicHolidayName("2027-05-06"), "Ascension")
  assert.equal(publicHolidayName("2027-05-17"), "Lundi de Pentecôte")
  assert.equal(publicHolidayName("2027-01-01"), "Jour de l'an")
  assert.equal(publicHolidayName("2026-09-10"), null)

  // --- Vacances scolaires zone B ---
  assert.equal(schoolHolidayZoneB("2026-10-17")?.name, "Toussaint")
  assert.equal(schoolHolidayZoneB("2026-11-01")?.name, "Toussaint")
  assert.equal(schoolHolidayZoneB("2026-11-02"), null) // reprise des cours
  assert.equal(schoolHolidayZoneB("2026-10-16"), null)
  assert.equal(schoolHolidayZoneB("2027-02-22")?.name, "Hiver") // zone B 2027 : 20/02 → 8/03
  assert.equal(schoolHolidayZoneB("2027-03-08"), null)
  assert.equal(schoolHolidayZoneB("2026-07-14")?.name, "Été")
  assert.equal(schoolHolidayZoneB("2026-09-10"), null)
  for (const h of SCHOOL_HOLIDAYS_ZONE_B) {
    assert.ok(h.start <= h.end, h.name)
    // Début un samedi (fin des cours), fin un dimanche (reprise le lundi) — sauf été
    if (h.name !== "Été") {
      assert.equal(new Date(h.start + "T00:00:00Z").getUTCDay(), 6, `${h.name} ${h.start} doit être un samedi`)
      assert.equal(new Date(h.end + "T00:00:00Z").getUTCDay(), 0, `${h.name} ${h.end} doit être un dimanche`)
    }
  }
  for (let i = 1; i < SCHOOL_HOLIDAYS_ZONE_B.length; i++) {
    assert.ok(SCHOOL_HOLIDAYS_ZONE_B[i].start > SCHOOL_HOLIDAYS_ZONE_B[i - 1].end, "périodes triées et disjointes")
  }

  console.log("✅ nct-calendar tests passed")
}

main()
