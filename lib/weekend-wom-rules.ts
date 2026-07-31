/**
 * Règles week-end coronarographistes M / O / W (ATL + garde).
 *
 * 1. Astreinte ATL Nuit samedi ⇒ même médecin en ATL Nuit vendredi (systématique).
 * 2. Garde samedi : un seul médecin Matin → Midi → Nuit dans la mesure du possible.
 * 3. Semaines paires (week-end ATL WOM, pas CH) :
 *    - **Exactement 5 week-ends combo / semestre** (prédéfinis) ;
 *    - Autres week-ends WOM **mono**.
 * 4. Sur week-end **combo**, croisement soft Sat → Dim (cases vides).
 *
 * **Presets** : remplissent les cases vides / retirent les absents (congés).
 * **Ne jamais** réécrire un médecin listé **disponible** (saisie manuelle).
 * **Ne jamais** placer un médecin en vacances (sinon strip + re-inject le remet).
 */

import { isDoctorUnavailable } from "@/lib/assignment-validation"
import { isListedDoctor } from "@/lib/doctor-code"
import type { EquityCounts } from "@/lib/equity-tracking"
import { dateStrForWeekDay, isOddIsoWeek } from "@/lib/fixed-assignments"
import type { DoctorVacation, ScheduleData } from "@/lib/types"
import {
  getWeekendWeekPreset,
  WOM_COMBO_WEEK_KEYS_2026,
  type WeekendSpecialCell,
} from "@/lib/weekend-wom-presets"

export const WOM_ATL_DOCTORS = ["M", "O", "W"] as const
export type WomAtlDoctor = (typeof WOM_ATL_DOCTORS)[number]

export type WeekendWomApplyOpts = {
  equity?: Record<string, EquityCounts>
  vacations?: DoctorVacation[]
}

const ATL_ROWS = [
  "Astreintes ATL Matin",
  "Astreintes ATL Midi",
  "Astreintes ATL Nuit",
] as const

const GARDE_ROWS = ["Garde Matin", "Garde Midi", "Garde Nuit"] as const

/**
 * Exactement **5** week-ends combo par semestre (~13 semaines paires WOM).
 * Indices 0..12 parmi les semaines paires du semestre — repli si pas d’override année.
 * 2026 : voir `WOM_COMBO_WEEK_KEYS_2026` / presets W40–W52.
 */
export const WOM_COMBO_PER_HALF_YEAR = 5
export const WOM_EVEN_WEEKS_PER_HALF_YEAR = 13
/** Indices prédéfinis (0-based) dans chaque bloc de 13 semaines paires (repli). */
export const WOM_COMBO_EVEN_INDICES = [1, 4, 7, 10, 12] as const

/**
 * Surcharge par année (liste explicite). 2026 = consignes H2 (W42/W44 combo).
 */
export const WOM_COMBO_WEEK_KEYS_OVERRIDE: Readonly<Record<number, readonly string[]>> = {
  2026: WOM_COMBO_WEEK_KEYS_2026,
}

export type WeekendWomPattern =
  | {
      kind: "mono"
      /** Sat + Sun ATL Matin/Midi/Nuit + Ven ATL Nuit */
      atlDoctor: WomAtlDoctor
    }
  | {
      kind: "combo"
      /** Ven ATL Nuit + Sat ATL + Dim Garde */
      atlSat: WomAtlDoctor
      /** Dim ATL + Sam Garde */
      atlSun: WomAtlDoctor
    }

function isWom(doc: string): doc is WomAtlDoctor {
  return (WOM_ATL_DOCTORS as readonly string[]).includes(doc)
}

/** Médecin absents ce jour (table vacations). CH toujours dispo. */
function isDoctorAway(
  doctor: string,
  day: string,
  weekKey: string,
  vacations: DoctorVacation[] | undefined,
): boolean {
  if (!vacations?.length) return false
  const dateStr = dateStrForWeekDay(weekKey, day)
  if (!dateStr) return false
  return isDoctorUnavailable(doctor, dateStr, vacations)
}

function doctorAvailable(
  doctor: string,
  day: string,
  weekKey: string,
  vacations: DoctorVacation[] | undefined,
): boolean {
  return !isDoctorAway(doctor, day, weekKey, vacations)
}

function listedInCell(schedule: ScheduleData, row: string, day: string): string[] {
  return (schedule[row]?.[day]?.value || []).filter((d) => isListedDoctor(d))
}

function hasListedDoctor(schedule: ScheduleData, row: string, day: string): boolean {
  return listedInCell(schedule, row, day).length > 0
}

function remplacantsInCell(schedule: ScheduleData, row: string, day: string): string[] {
  return (schedule[row]?.[day]?.value || []).filter((d) => d && !isListedDoctor(d))
}

function cellStatus(
  schedule: ScheduleData,
  rows: readonly string[],
  day: string,
): "validated" | "pending" {
  for (const row of rows) {
    if (schedule[row]?.[day]?.status === "pending") return "pending"
  }
  return "validated"
}

function setCellDoctors(
  schedule: ScheduleData,
  rowKey: string,
  day: string,
  doctors: string[],
  status: "validated" | "pending",
): ScheduleData {
  if (!schedule[rowKey]?.[day]) return schedule
  const unique = [...new Set(doctors.filter(Boolean))]
  return {
    ...schedule,
    [rowKey]: {
      ...schedule[rowKey],
      [day]: {
        ...schedule[rowKey][day],
        value: unique,
        type: unique.length ? "doctor" : "empty",
        status,
      },
    },
  }
}

function fillEmptyCell(
  schedule: ScheduleData,
  row: string,
  day: string,
  doctors: string[],
  status: "validated" | "pending",
  weekKey?: string,
  vacations?: DoctorVacation[],
): ScheduleData {
  if (!schedule[row]?.[day]) return schedule
  if (hasListedDoctor(schedule, row, day)) return schedule
  const available = doctors.filter(
    (d) => d && (!weekKey || doctorAvailable(d, day, weekKey, vacations)),
  )
  if (!available.length) return schedule
  const remplacants = remplacantsInCell(schedule, row, day)
  return setCellDoctors(schedule, row, day, [...available, ...remplacants], status)
}

function fillEmptyAtlDay(
  schedule: ScheduleData,
  day: "SAMEDI" | "DIMANCHE",
  doctor: string,
  status: "validated" | "pending",
  weekKey?: string,
  vacations?: DoctorVacation[],
): ScheduleData {
  let next = schedule
  for (const row of ATL_ROWS) {
    next = fillEmptyCell(next, row, day, [doctor], status, weekKey, vacations)
  }
  return next
}

function fillEmptyGardeDay(
  schedule: ScheduleData,
  day: "SAMEDI" | "DIMANCHE",
  doctor: string,
  status: "validated" | "pending",
  weekKey?: string,
  vacations?: DoctorVacation[],
): ScheduleData {
  let next = schedule
  for (const row of GARDE_ROWS) {
    next = fillEmptyCell(next, row, day, [doctor], status, weekKey, vacations)
  }
  return next
}

function firstWomOnAtlDay(
  schedule: ScheduleData,
  day: "SAMEDI" | "DIMANCHE",
): WomAtlDoctor | null {
  for (const row of ["Astreintes ATL Nuit", "Astreintes ATL Midi", "Astreintes ATL Matin"] as const) {
    for (const d of listedInCell(schedule, row, day)) {
      if (isWom(d)) return d
    }
  }
  return null
}

/** Priorité Midi/Nuit (associé week-end) avant Matin (peut inclure Ven Garde Nuit). */
function firstWomOnGardeDay(
  schedule: ScheduleData,
  day: "SAMEDI" | "DIMANCHE",
): WomAtlDoctor | null {
  for (const row of ["Garde Nuit", "Garde Midi", "Garde Matin"] as const) {
    for (const d of listedInCell(schedule, row, day)) {
      if (isWom(d)) return d
    }
  }
  return null
}

function atlDayFullyEmpty(schedule: ScheduleData, day: "SAMEDI" | "DIMANCHE"): boolean {
  return ATL_ROWS.every((row) => !hasListedDoctor(schedule, row, day))
}

function otherWom(primary: WomAtlDoctor, preferred?: WomAtlDoctor): WomAtlDoctor {
  if (preferred && preferred !== primary) return preferred
  return (WOM_ATL_DOCTORS.find((d) => d !== primary) || "O") as WomAtlDoctor
}

/**
 * Index 0..12 de la semaine paire dans son semestre (H1 = W02…W26, H2 = W28…W52).
 * Retourne null si semaine impaire / invalide.
 */
export function evenWeekIndexInHalfYear(weekKey: string): number | null {
  if (isOddIsoWeek(weekKey)) return null
  const weekNum = Number.parseInt(weekKey.split("-W")[1] || "0", 10)
  if (!weekNum || weekNum % 2 !== 0) return null
  const evenIndex = weekNum / 2 - 1
  return (
    ((evenIndex % WOM_EVEN_WEEKS_PER_HALF_YEAR) + WOM_EVEN_WEEKS_PER_HALF_YEAR) %
    WOM_EVEN_WEEKS_PER_HALF_YEAR
  )
}

/** Liste les 5 (×2 semestres) week keys combo pour une année civile. */
export function listWomComboWeekKeys(year: number): string[] {
  const override = WOM_COMBO_WEEK_KEYS_OVERRIDE[year]
  if (override?.length) return [...override]

  const keys: string[] = []
  for (const halfBase of [0, WOM_EVEN_WEEKS_PER_HALF_YEAR]) {
    for (const idx of WOM_COMBO_EVEN_INDICES) {
      const evenIndex = halfBase + idx
      const weekNum = (evenIndex + 1) * 2
      if (weekNum < 1 || weekNum > 52) continue
      keys.push(`${year}-W${String(weekNum).padStart(2, "0")}`)
    }
  }
  return keys
}

/**
 * Week-end combo = calendrier prédéfini (override année / indices) **ou**
 * preset `kind: "combo"`. Semaines impaires (CH) : jamais combo.
 */
export function isWomComboWeekend(weekKey: string): boolean {
  if (!weekKey || isOddIsoWeek(weekKey)) return false

  const preset = getWeekendWeekPreset(weekKey)
  if (preset?.kind === "combo") return true
  if (preset?.kind === "mono" || preset?.kind === "special") return false

  const year = Number.parseInt(weekKey.split("-W")[0] || "0", 10)
  if (!year) return false

  const override = WOM_COMBO_WEEK_KEYS_OVERRIDE[year]
  if (override?.length) {
    return override.includes(weekKey)
  }

  const idx = evenWeekIndexInHalfYear(weekKey)
  if (idx === null) return false
  return (WOM_COMBO_EVEN_INDICES as readonly number[]).includes(idx)
}

function pickByEquity(
  candidates: readonly WomAtlDoctor[],
  equity: Record<string, EquityCounts> | undefined,
  preferLow: "weekend_count" | "astreinte_count",
): WomAtlDoctor {
  if (!equity) return candidates[0]
  let best = candidates[0]
  let bestScore = Number.POSITIVE_INFINITY
  for (const c of candidates) {
    const e = equity[c]
    const score =
      (e?.[preferLow] ?? 0) * 100 + (e?.garde_count ?? 0) * 10 + (e?.astreinte_count ?? 0)
    if (score < bestScore) {
      bestScore = score
      best = c
    }
  }
  return best
}

/**
 * Choisit le pattern WOM : preset calendrier en priorité, sinon
 * combo/mono selon calendrier + équité / rotation.
 */
export function proposeWeekendWomPattern(
  weekKey: string,
  equity?: Record<string, EquityCounts>,
): WeekendWomPattern | null {
  if (isOddIsoWeek(weekKey)) return null
  const weekNum = Number.parseInt(weekKey.split("-W")[1] || "0", 10)
  if (!weekNum) return null

  const preset = getWeekendWeekPreset(weekKey)
  if (preset?.kind === "mono") {
    return { kind: "mono", atlDoctor: preset.atlDoctor }
  }
  if (preset?.kind === "combo") {
    return { kind: "combo", atlSat: preset.atlSat, atlSun: preset.atlSun }
  }
  if (preset?.kind === "special") {
    return null
  }

  const rot = Math.floor(weekNum / 2)
  const a = WOM_ATL_DOCTORS[rot % 3]
  const b = WOM_ATL_DOCTORS[(rot + 1) % 3]

  if (isWomComboWeekend(weekKey)) {
    const atlSat = pickByEquity([a, b], equity, "weekend_count")
    const atlSun = atlSat === a ? b : a
    return { kind: "combo", atlSat, atlSun }
  }

  const atlDoctor = pickByEquity([...WOM_ATL_DOCTORS], equity, "weekend_count")
  return { kind: "mono", atlDoctor }
}

/**
 * Consigne spéciale (ex. W52 Jeudi nuit = M) : si le titulaire est dispo,
 * l’écrase (y compris CH structurel). Si en vacances → retire le titulaire,
 * laisse les autres listés disponibles (ex. CH).
 */
function forceSpecialPreferredCell(
  schedule: ScheduleData,
  row: string,
  day: string,
  preferred: string | null,
  status: "validated" | "pending",
  weekKey: string,
  vacations: DoctorVacation[] | undefined,
): ScheduleData {
  if (!schedule[row]?.[day]) return schedule
  const remplacants = remplacantsInCell(schedule, row, day)
  const listed = listedInCell(schedule, row, day)

  if (preferred && doctorAvailable(preferred, day, weekKey, vacations)) {
    return setCellDoctors(schedule, row, day, [preferred, ...remplacants], status)
  }

  const availableListed = listed.filter(
    (d) => d !== preferred && doctorAvailable(d, day, weekKey, vacations),
  )
  const preferredPresent = preferred ? listed.includes(preferred) : false
  if (!preferredPresent && availableListed.length === listed.length) return schedule
  return setCellDoctors(schedule, row, day, [...availableListed, ...remplacants], status)
}

function applySpecialCells(
  schedule: ScheduleData,
  cells: WeekendSpecialCell[],
  opts: {
    force?: boolean
    weekKey?: string
    vacations?: DoctorVacation[]
  } = {},
): ScheduleData {
  const status: "validated" | "pending" = "validated"
  let next = schedule
  for (const cell of cells) {
    if (!next[cell.row]?.[cell.day]) continue
    const target = cell.doctors.find(Boolean) || null
    if (opts.force && opts.weekKey) {
      next = forceSpecialPreferredCell(
        next,
        cell.row,
        cell.day,
        target,
        status,
        opts.weekKey,
        opts.vacations,
      )
      continue
    }
    const preferred = cell.doctors.filter((d) =>
      opts.weekKey
        ? doctorAvailable(d, cell.day, opts.weekKey, opts.vacations)
        : Boolean(d),
    )
    const existing = next[cell.row][cell.day].value || []
    const alreadyExact =
      preferred.length > 0 &&
      existing.length === preferred.length &&
      preferred.every((d) => existing.includes(d))
    if (alreadyExact) continue
    if (!opts.force && existing.some(Boolean)) continue
    if (!preferred.length) continue
    next = setCellDoctors(next, cell.row, cell.day, preferred, status)
  }
  return next
}

/**
 * Ven ATL Nuit ↔ Sam ATL Nuit : même médecin (cases vides seulement).
 * Priorité : Sam Nuit gagne si non vide, sinon Ven Nuit propage vers Sam.
 * Ne propage pas un médecin en vacances le jour cible.
 */
export function applyFriSatAtlNightCoupling(
  schedule: ScheduleData,
  weekKey?: string,
  vacations?: DoctorVacation[],
): ScheduleData {
  const satNight = listedInCell(schedule, "Astreintes ATL Nuit", "SAMEDI")
  const friNight = listedInCell(schedule, "Astreintes ATL Nuit", "VENDREDI")
  const status = cellStatus(
    schedule,
    ["Astreintes ATL Nuit"],
    satNight.length ? "SAMEDI" : "VENDREDI",
  )

  let next = schedule
  if (satNight.length > 0 && !hasListedDoctor(next, "Astreintes ATL Nuit", "VENDREDI")) {
    next = fillEmptyCell(
      next,
      "Astreintes ATL Nuit",
      "VENDREDI",
      satNight,
      status,
      weekKey,
      vacations,
    )
  } else if (friNight.length > 0 && !hasListedDoctor(next, "Astreintes ATL Nuit", "SAMEDI")) {
    next = fillEmptyCell(
      next,
      "Astreintes ATL Nuit",
      "SAMEDI",
      friNight,
      status,
      weekKey,
      vacations,
    )
  }
  return next
}

/**
 * Garde samedi : si Matin a **un seul** médecin listé, propager vers Midi/Nuit vides.
 * (Si Matin = Ven Nuit + associé week-end, on ne force pas Midi = Matin.)
 */
export function applySaturdayGardeSingleDoctor(schedule: ScheduleData): ScheduleData {
  const matin = listedInCell(schedule, "Garde Matin", "SAMEDI")
  if (matin.length !== 1) {
    // Repli : Midi → Nuit
    const midi = listedInCell(schedule, "Garde Midi", "SAMEDI")
    const nuit = listedInCell(schedule, "Garde Nuit", "SAMEDI")
    const chosen = midi.length > 0 ? midi : nuit.length > 0 ? nuit : null
    if (!chosen) return schedule
    const status = cellStatus(schedule, GARDE_ROWS, "SAMEDI")
    let next = schedule
    for (const row of ["Garde Midi", "Garde Nuit"] as const) {
      next = fillEmptyCell(next, row, "SAMEDI", chosen, status)
    }
    return next
  }

  const status = cellStatus(schedule, GARDE_ROWS, "SAMEDI")
  let next = schedule
  for (const row of ["Garde Midi", "Garde Nuit"] as const) {
    next = fillEmptyCell(next, row, "SAMEDI", matin, status)
  }
  return next
}

/**
 * Croisement soft week-end combo (cases vides uniquement) :
 * - Sat ATL (A) → Garde Dim Matin/Midi/Nuit
 * - Garde Sam (B) → Sun ATL Matin/Midi/Nuit
 * Respecte aussi Ven ATL Nuit ← Sat ATL via `applyFriSatAtlNightCoupling`.
 */
export function applyWeekendComboCrossCoupling(
  schedule: ScheduleData,
  weekKey: string,
  vacations?: DoctorVacation[],
): ScheduleData {
  if (!isWomComboWeekend(weekKey)) return schedule

  const status: "validated" | "pending" = "validated"
  let next = schedule

  const satAtl = firstWomOnAtlDay(next, "SAMEDI")
  if (satAtl) {
    next = fillEmptyGardeDay(next, "DIMANCHE", satAtl, status, weekKey, vacations)
    next = fillEmptyCell(
      next,
      "Astreintes ATL Nuit",
      "VENDREDI",
      [satAtl],
      status,
      weekKey,
      vacations,
    )
  }

  const satGarde = firstWomOnGardeDay(next, "SAMEDI")
  if (satGarde) {
    next = fillEmptyAtlDay(next, "DIMANCHE", satGarde, status, weekKey, vacations)
  }

  return next
}

function applyMonoDoctor(
  schedule: ScheduleData,
  doctor: WomAtlDoctor,
  status: "validated" | "pending",
  weekKey?: string,
  vacations?: DoctorVacation[],
): ScheduleData {
  let next = schedule
  next = fillEmptyAtlDay(next, "SAMEDI", doctor, status, weekKey, vacations)
  next = fillEmptyAtlDay(next, "DIMANCHE", doctor, status, weekKey, vacations)
  next = fillEmptyCell(
    next,
    "Astreintes ATL Nuit",
    "VENDREDI",
    [doctor],
    status,
    weekKey,
    vacations,
  )
  return next
}

/**
 * Remplit / nettoie une case preset :
 * - médecins listés **disponibles** → conservés (saisie manuelle)
 * - absents (congés) retirés
 * - si vide après nettoyage → place `preferred` s’il est disponible
 */
function applyPresetCell(
  schedule: ScheduleData,
  row: string,
  day: string,
  preferred: string | null,
  status: "validated" | "pending",
  weekKey: string,
  vacations: DoctorVacation[] | undefined,
): ScheduleData {
  if (!schedule[row]?.[day]) return schedule
  // Case explicitement vidée par l'admin : ne jamais la re-remplir avec le
  // préféré du preset (confirmé utilisateur 31/07/2026).
  if (schedule[row]![day]!.manuallyCleared) return schedule
  const listed = listedInCell(schedule, row, day)
  const remplacants = remplacantsInCell(schedule, row, day)
  const availableListed = listed.filter((d) => doctorAvailable(d, day, weekKey, vacations))

  if (availableListed.length > 0) {
    if (availableListed.length === listed.length) return schedule
    return setCellDoctors(schedule, row, day, [...availableListed, ...remplacants], status)
  }

  if (preferred && doctorAvailable(preferred, day, weekKey, vacations)) {
    return setCellDoctors(schedule, row, day, [preferred, ...remplacants], status)
  }

  // Vider les absents ; laisser la case libre pour saisie manuelle
  if (listed.length > 0 || remplacants.length) {
    return setCellDoctors(schedule, row, day, remplacants, status)
  }
  return schedule
}

/** Retire M/O/W/CH d’une case Garde (résidu combo), garde remplacants + autres listés. */
function stripWomAndChFromGardeCell(
  schedule: ScheduleData,
  row: string,
  day: string,
): ScheduleData {
  if (!schedule[row]?.[day]) return schedule
  const cell = schedule[row][day]
  const kept = (cell.value || []).filter((d) => d && !isWom(d) && d !== "CH")
  if (kept.length === (cell.value || []).length) return schedule
  return setCellDoctors(
    schedule,
    row,
    day,
    kept,
    cell.status === "pending" ? "pending" : "validated",
  )
}

/**
 * Preset mono : ATL Sat+Sun+Ven Nuit si vides / absents ; ne touche pas une saisie
 * manuelle disponible. Ne place jamais un médecin en vacances.
 */
function applyMonoDoctorForced(
  schedule: ScheduleData,
  doctor: WomAtlDoctor,
  status: "validated" | "pending",
  weekKey: string,
  vacations: DoctorVacation[] | undefined,
): ScheduleData {
  let next = schedule
  for (const day of ["SAMEDI", "DIMANCHE"] as const) {
    for (const row of ATL_ROWS) {
      next = applyPresetCell(next, row, day, doctor, status, weekKey, vacations)
    }
  }
  next = applyPresetCell(
    next,
    "Astreintes ATL Nuit",
    "VENDREDI",
    doctor,
    status,
    weekKey,
    vacations,
  )
  for (const day of ["SAMEDI", "DIMANCHE"] as const) {
    for (const row of GARDE_ROWS) {
      next = stripWomAndChFromGardeCell(next, row, day)
    }
  }
  return next
}

/**
 * Preset combo : A/B sur ATL + Garde, avec respect vacances + saisie manuelle.
 */
function applyComboPairForced(
  schedule: ScheduleData,
  atlSat: WomAtlDoctor,
  atlSun: WomAtlDoctor,
  status: "validated" | "pending",
  weekKey: string,
  vacations: DoctorVacation[] | undefined,
): ScheduleData {
  let next = schedule
  for (const row of ATL_ROWS) {
    next = applyPresetCell(next, row, "SAMEDI", atlSat, status, weekKey, vacations)
    next = applyPresetCell(next, row, "DIMANCHE", atlSun, status, weekKey, vacations)
  }
  next = applyPresetCell(
    next,
    "Astreintes ATL Nuit",
    "VENDREDI",
    atlSat,
    status,
    weekKey,
    vacations,
  )
  for (const row of GARDE_ROWS) {
    next = applyPresetCell(next, row, "SAMEDI", atlSun, status, weekKey, vacations)
    next = applyPresetCell(next, row, "DIMANCHE", atlSat, status, weekKey, vacations)
  }
  return next
}

function applyComboPair(
  schedule: ScheduleData,
  atlSat: WomAtlDoctor,
  atlSun: WomAtlDoctor,
  status: "validated" | "pending",
  weekKey?: string,
  vacations?: DoctorVacation[],
): ScheduleData {
  let next = schedule
  next = fillEmptyAtlDay(next, "SAMEDI", atlSat, status, weekKey, vacations)
  next = fillEmptyAtlDay(next, "DIMANCHE", atlSun, status, weekKey, vacations)
  next = fillEmptyCell(
    next,
    "Astreintes ATL Nuit",
    "VENDREDI",
    [atlSat],
    status,
    weekKey,
    vacations,
  )
  next = fillEmptyGardeDay(next, "SAMEDI", atlSun, status, weekKey, vacations)
  next = fillEmptyGardeDay(next, "DIMANCHE", atlSat, status, weekKey, vacations)
  return next
}

/**
 * Injecte / complète le pattern WOM (mono ou combo).
 * Semaines impaires (CH) : no-op.
 * Presets : remplissent vides / retirent absents ; saisie manuelle disponible conservée.
 * Hors preset : soft fill cases vides (sans médecins en vacances).
 */
export function applyWeekendWomPattern(
  schedule: ScheduleData,
  weekKey: string,
  opts: WeekendWomApplyOpts = {},
): ScheduleData {
  if (!weekKey || isOddIsoWeek(weekKey)) return schedule
  const { equity, vacations } = opts

  const preset = getWeekendWeekPreset(weekKey)
  if (preset?.kind === "special") {
    return applySpecialCells(schedule, preset.specialCells, {
      force: true,
      weekKey,
      vacations,
    })
  }

  const status: "validated" | "pending" = "validated"

  if (preset?.kind === "mono") {
    let next = applyMonoDoctorForced(
      schedule,
      preset.atlDoctor,
      status,
      weekKey,
      vacations,
    )
    if (preset.specialCells?.length) {
      next = applySpecialCells(next, preset.specialCells, {
        force: true,
        weekKey,
        vacations,
      })
    }
    return applyFriSatAtlNightCoupling(next, weekKey, vacations)
  }
  if (preset?.kind === "combo") {
    let next = applyComboPairForced(
      schedule,
      preset.atlSat,
      preset.atlSun,
      status,
      weekKey,
      vacations,
    )
    if (preset.specialCells?.length) {
      next = applySpecialCells(next, preset.specialCells, {
        force: true,
        weekKey,
        vacations,
      })
    }
    return applyFriSatAtlNightCoupling(next, weekKey, vacations)
  }

  // Heuristique (pas de preset) : soft fill seulement
  let next = schedule
  const pattern = proposeWeekendWomPattern(weekKey, equity)
  const isCombo = pattern?.kind === "combo"

  const satWom = firstWomOnAtlDay(next, "SAMEDI")
  const sunWom = firstWomOnAtlDay(next, "DIMANCHE")

  if (isCombo && satWom && sunWom && satWom !== sunWom) {
    next = applyComboPair(next, satWom, sunWom, status, weekKey, vacations)
    return applyFriSatAtlNightCoupling(next, weekKey, vacations)
  }

  if (satWom && atlDayFullyEmpty(next, "DIMANCHE")) {
    if (isCombo && pattern?.kind === "combo") {
      const gardeSat = firstWomOnGardeDay(next, "SAMEDI")
      const partner =
        gardeSat && gardeSat !== satWom
          ? gardeSat
          : otherWom(satWom, satWom === pattern.atlSat ? pattern.atlSun : pattern.atlSat)
      next = applyComboPair(next, satWom, partner, status, weekKey, vacations)
    } else {
      next = applyMonoDoctor(next, satWom, status, weekKey, vacations)
    }
    return applyFriSatAtlNightCoupling(next, weekKey, vacations)
  }

  if (sunWom && atlDayFullyEmpty(next, "SAMEDI")) {
    if (isCombo && pattern?.kind === "combo") {
      const gardeSun = firstWomOnGardeDay(next, "DIMANCHE")
      const partner =
        gardeSun && gardeSun !== sunWom
          ? gardeSun
          : otherWom(sunWom, sunWom === pattern.atlSun ? pattern.atlSat : pattern.atlSun)
      next = applyComboPair(next, partner, sunWom, status, weekKey, vacations)
    } else {
      next = applyMonoDoctor(next, sunWom, status, weekKey, vacations)
    }
    return applyFriSatAtlNightCoupling(next, weekKey, vacations)
  }

  if (atlDayFullyEmpty(next, "SAMEDI") && atlDayFullyEmpty(next, "DIMANCHE") && pattern) {
    if (pattern.kind === "mono") {
      next = applyMonoDoctor(next, pattern.atlDoctor, status, weekKey, vacations)
    } else {
      next = applyComboPair(
        next,
        pattern.atlSat,
        pattern.atlSun,
        status,
        weekKey,
        vacations,
      )
    }
  }

  return applyFriSatAtlNightCoupling(next, weekKey, vacations)
}

/**
 * Point d’entrée : pattern WOM (semaines paires) + croisement combo Sat→Dim
 * + Ven↔Sam ATL nuit + Garde Sam unifiée.
 *
 * `equityOrOpts` : legacy `Record<equity>` **ou** `{ equity, vacations }`.
 */
export function applyWeekendWomRules(
  schedule: ScheduleData,
  weekKey: string,
  equityOrOpts?: Record<string, EquityCounts> | WeekendWomApplyOpts,
): ScheduleData {
  if (!schedule || !weekKey) return schedule

  const opts: WeekendWomApplyOpts =
    equityOrOpts &&
    typeof equityOrOpts === "object" &&
    ("vacations" in equityOrOpts || "equity" in equityOrOpts)
      ? (equityOrOpts as WeekendWomApplyOpts)
      : { equity: equityOrOpts as Record<string, EquityCounts> | undefined }

  const preset = getWeekendWeekPreset(weekKey)
  let next = applyWeekendWomPattern(schedule, weekKey, opts)

  if (preset?.kind === "special") {
    if (preset.skipFriSatCoupling !== false) {
      return next
    }
  }

  next = applyWeekendComboCrossCoupling(next, weekKey, opts.vacations)
  next = applyFriSatAtlNightCoupling(next, weekKey, opts.vacations)
  next = applySaturdayGardeSingleDoctor(next)
  return next
}
