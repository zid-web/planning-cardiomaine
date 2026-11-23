/**
 * Run: npx tsx lib/__tests__/atl-night-calendar.test.ts
 */
import assert from "node:assert/strict"
import {
  applyAtlNightCalendarToWeek,
  applyWeekendComboFromGardes,
  isUnavailableForWeekendAstreinte,
  countAtlNightsInSchedules,
  autoFillAtlNightMonth,
  cycleAtlNightUser,
  expectedAtlNightGroup,
  fillEmptyAtlNights,
  normalizeAtlNightCalendar,
  proposeAtlNightDoctor,
  setAtlNightCalendar,
  withAtlNightEntry,
} from "@/lib/atl-night-calendar"
import { generateWeekSchedule } from "@/lib/schedule-utils"
import { applyStructuralConstraints } from "@/lib/apply-structural-constraints"

/** Semaine générée, ligne ATL Nuit vidée (le squelette pré-remplit un modèle de nuits). */
function blankWeek(wk: string) {
  const w = generateWeekSchedule(wk, [])
  for (const day of Object.keys(w["Astreintes ATL Nuit"])) w["Astreintes ATL Nuit"][day] = { value: [], type: "empty", status: "validated" }
  return w
}
const c = (value: string[], status: "validated" | "pending" = "validated") => ({ value, type: "doctor" as const, status })

async function main() {
  // Roulement : S44 2026 (paire) = semaine WOM → CH les nuits mer/jeu ; S45 = semaine CH → CH lun/mar/ven + WE
  assert.equal(expectedAtlNightGroup("2026-10-26"), "WOM") // lundi S44
  assert.equal(expectedAtlNightGroup("2026-10-28"), "CH") // mercredi S44
  assert.equal(expectedAtlNightGroup("2026-11-02"), "CH") // lundi S45
  assert.equal(expectedAtlNightGroup("2026-11-05"), "WOM") // jeudi S45
  assert.equal(proposeAtlNightDoctor("2026-11-02"), "CH")

  // Lundi : le médecin de l'ATL nuit du week-end est écarté (équité M/O/W)
  const wk = blankWeek("2026-W44")
  wk["Astreintes ATL Nuit"].SAMEDI = c(["W"])
  wk["Astreintes ATL Nuit"].DIMANCHE = c(["O"])
  assert.equal(proposeAtlNightDoctor("2026-10-26", { schedule: wk }), "M")

  // Nuit W/O/M : le médecin d'ATL Midi fait la nuit
  const w44 = blankWeek("2026-W44")
  w44["Astreintes ATL Midi"].LUNDI = c(["O"])
  assert.equal(proposeAtlNightDoctor("2026-10-26", { schedule: w44 }), "O")
  // … sauf s'il est de garde de nuit ce soir-là
  w44["Garde Nuit"].LUNDI = c(["O"])
  assert.notEqual(proposeAtlNightDoctor("2026-10-26", { schedule: w44 }), "O")
  // … ou en congé
  const w44b = blankWeek("2026-W44")
  w44b["Astreintes ATL Midi"].LUNDI = c(["W"])
  const vac = [{ id: "1", doctor_id: "W", start_date: "2026-10-26", end_date: "2026-10-26" } as any]
  assert.notEqual(proposeAtlNightDoctor("2026-10-26", { schedule: w44b, vacations: vac }), "W")

  // Jeudi avec FV présent (FV en ATL Midi) : jamais FV ; O de garde → W ou M ; sinon M, W ou O
  const w45 = blankWeek("2026-W45")
  w45["Astreintes ATL Midi"].JEUDI = c(["FV"])
  w45["Garde Nuit"].JEUDI = c(["O"])
  const thuGarde = proposeAtlNightDoctor("2026-11-05", { schedule: w45 })
  assert.ok(thuGarde === "W" || thuGarde === "M", String(thuGarde))
  w45["Garde Nuit"].JEUDI = c(["G"])
  const thuFree = proposeAtlNightDoctor("2026-11-05", { schedule: w45, counts: { M: 3, W: 3, O: 0 } })
  assert.equal(thuFree, "O")

  // Calendrier : saisie manuelle → case validée et protégée, même un jour du roulement CH
  const cal = withAtlNightEntry([], "2026-11-02", "W", true) // lundi S45, nuit CH habituellement
  setAtlNightCalendar(cal)
  const w45b = applyStructuralConstraints(generateWeekSchedule("2026-W45", []), "2026-W45", [], { isFreshWeek: true })
  assert.deepEqual(w45b["Astreintes ATL Nuit"].LUNDI.value, ["W"])
  assert.equal(w45b["Astreintes ATL Nuit"].LUNDI.status, "validated")
  assert.ok(!w45b["Astreintes ATL Nuit"].MARDI.value.includes("W"))

  // Entrée automatique : proposition, ne remplace pas une saisie admin
  const auto = applyAtlNightCalendarToWeek(
    { "Astreintes ATL Nuit": { LUNDI: { ...c(["M"]), manualAssignment: true } } } as any,
    "2026-W44",
    [{ date: "2026-10-26", user: "O" }],
  )
  assert.deepEqual(auto["Astreintes ATL Nuit"].LUNDI.value, ["M"])
  // … ni une nuit déjà validée (même sans marque de saisie admin)
  const keepValidated = applyAtlNightCalendarToWeek(
    { "Astreintes ATL Nuit": { LUNDI: c(["W"]), MARDI: c(["W"], "pending") } } as any,
    "2026-W44",
    [{ date: "2026-10-26", user: "O" }, { date: "2026-10-27", user: "O" }],
  )
  assert.deepEqual(keepValidated["Astreintes ATL Nuit"].LUNDI.value, ["W"])
  assert.deepEqual(keepValidated["Astreintes ATL Nuit"].MARDI.value, ["O"]) // une proposition, elle, est remplacée
  // une saisie manuelle du calendrier remplace la nuit validée
  const manual = applyAtlNightCalendarToWeek(
    { "Astreintes ATL Nuit": { LUNDI: c(["W"]) } } as any,
    "2026-W44",
    [{ date: "2026-10-26", user: "O", manual: true }],
  )
  assert.deepEqual(manual["Astreintes ATL Nuit"].LUNDI.value, ["O"])
  setAtlNightCalendar([])

  // Remplissage des nuits vides : pending, jamais FV
  const filled = fillEmptyAtlNights(blankWeek("2026-W44"), "2026-W44")
  for (const day of ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI", "DIMANCHE"]) {
    const v = filled["Astreintes ATL Nuit"][day].value
    assert.equal(v.length, 1, day)
    assert.notEqual(v[0], "FV")
  }
  assert.deepEqual(filled["Astreintes ATL Nuit"].MERCREDI.value, ["CH"])
  assert.equal(filled["Astreintes ATL Nuit"].LUNDI.status, "pending")

  // Mois auto : toutes les dates, équité entre M/W/O, saisies conservées
  const month = autoFillAtlNightMonth([{ date: "2026-11-02", user: "O", manual: true }], 2026, 10, () => ({}))
  assert.equal(month.length, 30)
  assert.deepEqual(month.find((e) => e.date === "2026-11-02"), { date: "2026-11-02", user: "O", manual: true })
  const wom = month.filter((e) => e.user !== "CH").map((e) => e.user)
  const counts = ["M", "W", "O"].map((d) => wom.filter((u) => u === d).length)
  // week-ends mono = 3 nuits d'affilée au même médecin : écart toléré d'un week-end
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 3, String(counts))
  // Lun → jeu : jamais deux nuits consécutives pour le même M/W/O
  const byDate = new Map(month.map((e) => [e.date, e.user]))
  for (const e of month) {
    const [y, m, d] = e.date.split("-").map(Number)
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
    if (dow < 1 || dow > 3 || e.user === "CH") continue // lun, mar, mer → comparer au lendemain
    const next = `${y}-${String(m).padStart(2, "0")}-${String(d + 1).padStart(2, "0")}`
    assert.notEqual(byDate.get(next), e.user, `${e.date} et ${next}`)
  }

  // Week-end combo : M de garde samedi → M astreinte dimanche ; O de garde dimanche → O vendredi + samedi
  const wc = blankWeek("2026-W44") // semaine W/O/M
  wc["Garde Midi"].SAMEDI = c(["M"])
  wc["Garde Nuit"].DIMANCHE = c(["O"])
  assert.equal(proposeAtlNightDoctor("2026-10-30", { schedule: wc }), "O") // vendredi
  assert.equal(proposeAtlNightDoctor("2026-10-31", { schedule: wc }), "O") // samedi
  assert.equal(proposeAtlNightDoctor("2026-11-01", { schedule: wc }), "M") // dimanche
  // Un seul M/W/O de garde (samedi W) : W fait le dimanche, un autre fait vendredi + samedi
  const w1 = blankWeek("2026-W44")
  w1["Garde Matin"].SAMEDI = c(["W"])
  assert.equal(proposeAtlNightDoctor("2026-11-01", { schedule: w1 }), "W")
  const friSat = proposeAtlNightDoctor("2026-10-30", { schedule: w1 })
  assert.ok(friSat && friSat !== "W" && friSat === proposeAtlNightDoctor("2026-10-31", { schedule: w1 }))
  // Combo posé automatiquement dans le planning (cases non saisies)
  const planned = applyWeekendComboFromGardes(wc, "2026-W44")
  assert.deepEqual(planned["Astreintes ATL Nuit"].VENDREDI.value, ["O"])
  assert.deepEqual(planned["Astreintes ATL Matin"].SAMEDI.value, ["O"])
  assert.deepEqual(planned["Astreintes ATL Nuit"].DIMANCHE.value, ["M"])
  // … sauf une saisie admin
  wc["Astreintes ATL Nuit"].DIMANCHE = { ...c(["W"]), manualAssignment: true }
  assert.deepEqual(applyWeekendComboFromGardes(wc, "2026-W44")["Astreintes ATL Nuit"].DIMANCHE.value, ["W"])
  // Semaine CH : pas de combo W/O/M
  const ch = blankWeek("2026-W45")
  ch["Garde Midi"].SAMEDI = c(["M"])
  assert.equal(applyWeekendComboFromGardes(ch, "2026-W45"), ch)

  // Mono (aucun M/W/O de garde) : même médecin vendredi → dimanche
  const mono = blankWeek("2026-W44")
  mono["Astreintes ATL Nuit"].VENDREDI = c(["W"])
  assert.equal(proposeAtlNightDoctor("2026-10-31", { schedule: mono }), "W")
  assert.equal(proposeAtlNightDoctor("2026-11-01", { schedule: mono }), "W")

  // Consécutives : mardi = M → ni lundi ni mercredi pour M
  const cons = blankWeek("2026-W45") // semaine CH : nuits W/O/M = mercredi, jeudi
  cons["Astreintes ATL Nuit"].MERCREDI = c(["M"])
  cons["Astreintes ATL Midi"].JEUDI = c(["M"])
  assert.notEqual(proposeAtlNightDoctor("2026-11-05", { schedule: cons }), "M")

  // Week-end : pas d'astreinte en semaine de vacances ni la veille des vacances
  const v = (doc: string, a: string, b: string) => ({ id: doc + a, doctor_id: doc, start_date: a, end_date: b }) as any
  assert.equal(isUnavailableForWeekendAstreinte("M", "2026-W44", [v("M", "2026-11-02", "2026-11-08")]), true) // vacances dès le lundi suivant
  assert.equal(isUnavailableForWeekendAstreinte("M", "2026-W44", [v("M", "2026-10-28", "2026-10-28")]), true) // vacances mercredi de la semaine
  assert.equal(isUnavailableForWeekendAstreinte("M", "2026-W44", [v("M", "2026-11-09", "2026-11-15")]), false) // deux semaines plus tard
  const veille = [v("W", "2026-11-02", "2026-11-08")]
  const wkv = blankWeek("2026-W44")
  wkv["Astreintes ATL Nuit"].VENDREDI = c(["W"])
  for (const date of ["2026-10-30", "2026-10-31", "2026-11-01"]) {
    assert.notEqual(proposeAtlNightDoctor(date, { schedule: wkv, vacations: veille }), "W", date)
  }
  // Week-end W/O/M sans préréglage : le médecin à la veille de ses vacances n'est pas proposé
  const { proposeWeekendWomPattern } = await import("@/lib/weekend-wom-rules")
  for (const doc of ["M", "O", "W"]) {
    const pat = proposeWeekendWomPattern("2027-W03", undefined, [v(doc, "2027-01-25", "2027-01-31")])
    if (pat?.kind === "mono") assert.notEqual(pat.atlDoctor, doc)
    if (pat?.kind === "combo") assert.ok(pat.atlSat !== doc && pat.atlSun !== doc)
  }

  // Équité : l'historique du planning compte (le moins chargé passe en premier)
  const hist = blankWeek("2026-W40")
  for (const day of ["LUNDI", "MARDI", "VENDREDI", "SAMEDI", "DIMANCHE"]) hist["Astreintes ATL Nuit"][day] = c(["M"])
  assert.equal(countAtlNightsInSchedules([hist]).M, 5)
  const eq = autoFillAtlNightMonth([], 2026, 10, () => ({}), { M: 30, W: 0, O: 0 })
  const firstWom = eq.find((e) => e.user !== "CH")
  assert.notEqual(firstWom?.user, "M")

  // Divers
  assert.equal(cycleAtlNightUser(null), "M")
  assert.equal(cycleAtlNightUser("CH"), null)
  assert.deepEqual(normalizeAtlNightCalendar([{ date: "2026-11-02", user: "FV" }]), [])

  // Astreintes posées à la main dans le planning : jamais modifiées par le remplissage auto
  {
    const manualPlanning: Record<string, string> = { "2026-11-10": "W", "2026-11-12": "O" }
    const auto = [{ date: "2026-11-10", user: "M" }] // ancienne proposition auto, contraire au planning
    const filled = autoFillAtlNightMonth(auto, 2026, 10, () => ({}), {}, (d) => manualPlanning[d] ?? null)
    const at = (d: string) => filled.find((e) => e.date === d)
    assert.equal(at("2026-11-10")?.user, "W", "planning manuel prioritaire sur la proposition auto")
    assert.equal(at("2026-11-10")?.manual, true)
    assert.equal(at("2026-11-12")?.user, "O")
    assert.notEqual(at("2026-11-11")?.user, "W", "pas deux nuits de suite (W le 10)")
    assert.notEqual(at("2026-11-11")?.user, "O", "pas deux nuits de suite (O le 12)")
    // une saisie manuelle du calendrier prime sur le planning
    const cal = autoFillAtlNightMonth([{ date: "2026-11-10", user: "M", manual: true }], 2026, 10, () => ({}), {}, (d) => manualPlanning[d] ?? null)
    assert.equal(cal.find((e) => e.date === "2026-11-10")?.user, "M")
  }

  console.log("✅ atl-night-calendar tests passed")
}

main()
