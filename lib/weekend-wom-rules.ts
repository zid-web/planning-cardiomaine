/**
 * Règles week-end coronarographistes M / O / W (ATL + garde).
 *
 * 1. Astreinte ATL Nuit samedi ⇒ même médecin en ATL Nuit vendredi (systématique).
 * 2. Garde samedi : un seul médecin Matin → Midi → Nuit dans la mesure du possible.
 * 3. Semaines paires (week-end ATL WOM, pas CH) :
 *    - **Exactement 5 week-ends combo / semestre** (prédéfinis, indices espacés) :
 *      A = Ven ATL Nuit + Sat ATL Matin/Midi/Nuit + Garde Dim Matin/Midi/Nuit
 *      B = Garde Sam Matin/Midi/Nuit + Sun ATL Matin/Midi/Nuit
 *    - Autres week-ends WOM **mono** : Sat+Sun ATL (Matin/Midi/Nuit) = un seul M/O/W
 *      (équité / rotation).
 * 4. Sur week-end **combo** uniquement, croisement soft Sat → Dim (cases vides) :
 *    Sat ATL → Garde Dim ; Garde Sam → Sun ATL.
 *
 * **Priorité saisie manuelle** : jamais d’écrasement d’une case déjà pourvue
 * d’un médecin listé (soft fill uniquement) — prime sur pattern / croisement / solveur.
 */

import { isListedDoctor } from "@/lib/doctor-code"
import type { EquityCounts } from "@/lib/equity-tracking"
import { isOddIsoWeek } from "@/lib/fixed-assignments"
import type { ScheduleData } from "@/lib/types"

export const WOM_ATL_DOCTORS = ["M", "O", "W"] as const
export type WomAtlDoctor = (typeof WOM_ATL_DOCTORS)[number]

const ATL_ROWS = [
  "Astreintes ATL Matin",
  "Astreintes ATL Midi",
  "Astreintes ATL Nuit",
] as const

const GARDE_ROWS = ["Garde Matin", "Garde Midi", "Garde Nuit"] as const

/**
 * Exactement **5** week-ends combo par semestre (~13 semaines paires WOM).
 * Indices 0..12 parmi les semaines paires du semestre — prédéfinis et espacés.
 * Ex. 2026 H1 : W04, W10, W16, W22, W26 ; H2 : W30, W36, W42, W48, W52.
 */
export const WOM_COMBO_PER_HALF_YEAR = 5
export const WOM_EVEN_WEEKS_PER_HALF_YEAR = 13
/** Indices prédéfinis (0-based) dans chaque bloc de 13 semaines paires. */
export const WOM_COMBO_EVEN_INDICES = [1, 4, 7, 10, 12] as const

/**
 * Surcharge optionnelle par année (liste explicite de week keys ISO).
 * Si présente, remplace les indices pour cette année civile.
 * Laisser vide = calendrier indices (valable toute année).
 */
export const WOM_COMBO_WEEK_KEYS_OVERRIDE: Readonly<Record<number, readonly string[]>> = {
  // Exemple futur : 2026: ["2026-W04", "2026-W10", ...],
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
): ScheduleData {
  if (!schedule[row]?.[day]) return schedule
  if (hasListedDoctor(schedule, row, day)) return schedule
  const remplacants = remplacantsInCell(schedule, row, day)
  return setCellDoctors(schedule, row, day, [...doctors, ...remplacants], status)
}

function fillEmptyAtlDay(
  schedule: ScheduleData,
  day: "SAMEDI" | "DIMANCHE",
  doctor: string,
  status: "validated" | "pending",
): ScheduleData {
  let next = schedule
  for (const row of ATL_ROWS) {
    next = fillEmptyCell(next, row, day, [doctor], status)
  }
  return next
}

function fillEmptyGardeDay(
  schedule: ScheduleData,
  day: "SAMEDI" | "DIMANCHE",
  doctor: string,
  status: "validated" | "pending",
): ScheduleData {
  let next = schedule
  for (const row of GARDE_ROWS) {
    next = fillEmptyCell(next, row, day, [doctor], status)
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
 * Week-end combo = parmi les **5 prédéfinis / semestre** (sauf override année).
 * Semaines impaires (CH) : jamais combo.
 */
export function isWomComboWeekend(weekKey: string): boolean {
  if (!weekKey || isOddIsoWeek(weekKey)) return false
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
 * Choisit le pattern WOM pour une semaine paire (équité 6 mois si fournie,
 * sinon rotation déterministe M→O→W).
 */
export function proposeWeekendWomPattern(
  weekKey: string,
  equity?: Record<string, EquityCounts>,
): WeekendWomPattern | null {
  if (isOddIsoWeek(weekKey)) return null
  const weekNum = Number.parseInt(weekKey.split("-W")[1] || "0", 10)
  if (!weekNum) return null

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
 * Ven ATL Nuit ↔ Sam ATL Nuit : même médecin (cases vides seulement).
 * Priorité : Sam Nuit gagne si non vide, sinon Ven Nuit propage vers Sam.
 */
export function applyFriSatAtlNightCoupling(schedule: ScheduleData): ScheduleData {
  const satNight = listedInCell(schedule, "Astreintes ATL Nuit", "SAMEDI")
  const friNight = listedInCell(schedule, "Astreintes ATL Nuit", "VENDREDI")
  const status = cellStatus(
    schedule,
    ["Astreintes ATL Nuit"],
    satNight.length ? "SAMEDI" : "VENDREDI",
  )

  let next = schedule
  if (satNight.length > 0 && !hasListedDoctor(next, "Astreintes ATL Nuit", "VENDREDI")) {
    next = fillEmptyCell(next, "Astreintes ATL Nuit", "VENDREDI", satNight, status)
  } else if (friNight.length > 0 && !hasListedDoctor(next, "Astreintes ATL Nuit", "SAMEDI")) {
    next = fillEmptyCell(next, "Astreintes ATL Nuit", "SAMEDI", friNight, status)
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

function applyComboPair(
  schedule: ScheduleData,
  atlSat: WomAtlDoctor,
  atlSun: WomAtlDoctor,
  status: "validated" | "pending",
): ScheduleData {
  let next = schedule
  // A = Ven ATL Nuit + Sat ATL + Garde Dim ; B = Garde Sam + Sun ATL
  next = fillEmptyAtlDay(next, "SAMEDI", atlSat, status)
  next = fillEmptyAtlDay(next, "DIMANCHE", atlSun, status)
  next = fillEmptyCell(next, "Astreintes ATL Nuit", "VENDREDI", [atlSat], status)
  next = fillEmptyGardeDay(next, "SAMEDI", atlSun, status)
  next = fillEmptyGardeDay(next, "DIMANCHE", atlSat, status)
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
): ScheduleData {
  if (!isWomComboWeekend(weekKey)) return schedule

  const status: "validated" | "pending" = "validated"
  let next = schedule

  const satAtl = firstWomOnAtlDay(next, "SAMEDI")
  if (satAtl) {
    next = fillEmptyGardeDay(next, "DIMANCHE", satAtl, status)
    next = fillEmptyCell(next, "Astreintes ATL Nuit", "VENDREDI", [satAtl], status)
  }

  const satGarde = firstWomOnGardeDay(next, "SAMEDI")
  if (satGarde) {
    next = fillEmptyAtlDay(next, "DIMANCHE", satGarde, status)
  }

  return next
}

function applyMonoDoctor(
  schedule: ScheduleData,
  doctor: WomAtlDoctor,
  status: "validated" | "pending",
): ScheduleData {
  let next = schedule
  next = fillEmptyAtlDay(next, "SAMEDI", doctor, status)
  next = fillEmptyAtlDay(next, "DIMANCHE", doctor, status)
  next = fillEmptyCell(next, "Astreintes ATL Nuit", "VENDREDI", [doctor], status)
  return next
}

/**
 * Injecte / complète le pattern WOM (mono ou combo) sur cases **vides**.
 * Semaines impaires (CH) : no-op (CH déjà injecté ailleurs).
 * Combo (croisement Garde↔ATL) **uniquement** sur les 5 week-ends prédéfinis.
 * Saisie manuelle : jamais écrasée (`fillEmpty*`).
 */
export function applyWeekendWomPattern(
  schedule: ScheduleData,
  weekKey: string,
  equity?: Record<string, EquityCounts>,
): ScheduleData {
  if (!weekKey || isOddIsoWeek(weekKey)) return schedule

  let next = schedule
  const status: "validated" | "pending" = "validated"
  const pattern = proposeWeekendWomPattern(weekKey, equity)
  const isCombo = pattern?.kind === "combo"

  const satWom = firstWomOnAtlDay(next, "SAMEDI")
  const sunWom = firstWomOnAtlDay(next, "DIMANCHE")

  // Combo prédéfini seulement : Sat≠Sun ATL → croisement Garde (cases vides)
  if (isCombo && satWom && sunWom && satWom !== sunWom) {
    next = applyComboPair(next, satWom, sunWom, status)
    return applyFriSatAtlNightCoupling(next)
  }

  if (satWom && atlDayFullyEmpty(next, "DIMANCHE")) {
    if (isCombo && pattern?.kind === "combo") {
      // B = Garde Sam si déjà saisie, sinon partenaire du pattern
      const gardeSat = firstWomOnGardeDay(next, "SAMEDI")
      const partner =
        gardeSat && gardeSat !== satWom
          ? gardeSat
          : otherWom(satWom, satWom === pattern.atlSat ? pattern.atlSun : pattern.atlSat)
      next = applyComboPair(next, satWom, partner, status)
    } else {
      next = applyMonoDoctor(next, satWom, status)
    }
    return applyFriSatAtlNightCoupling(next)
  }

  if (sunWom && atlDayFullyEmpty(next, "SAMEDI")) {
    if (isCombo && pattern?.kind === "combo") {
      // A = Garde Dim si déjà saisie, sinon partenaire du pattern
      const gardeSun = firstWomOnGardeDay(next, "DIMANCHE")
      const partner =
        gardeSun && gardeSun !== sunWom
          ? gardeSun
          : otherWom(sunWom, sunWom === pattern.atlSun ? pattern.atlSat : pattern.atlSun)
      next = applyComboPair(next, partner, sunWom, status)
    } else {
      next = applyMonoDoctor(next, sunWom, status)
    }
    return applyFriSatAtlNightCoupling(next)
  }

  if (atlDayFullyEmpty(next, "SAMEDI") && atlDayFullyEmpty(next, "DIMANCHE") && pattern) {
    if (pattern.kind === "mono") {
      next = applyMonoDoctor(next, pattern.atlDoctor, status)
    } else {
      next = applyComboPair(next, pattern.atlSat, pattern.atlSun, status)
    }
  }

  return applyFriSatAtlNightCoupling(next)
}

/**
 * Point d’entrée : pattern WOM (semaines paires) + croisement combo Sat→Dim
 * + Ven↔Sam ATL nuit + Garde Sam unifiée.
 */
export function applyWeekendWomRules(
  schedule: ScheduleData,
  weekKey: string,
  equity?: Record<string, EquityCounts>,
): ScheduleData {
  if (!schedule || !weekKey) return schedule
  let next = applyWeekendWomPattern(schedule, weekKey, equity)
  next = applyWeekendComboCrossCoupling(next, weekKey)
  next = applyFriSatAtlNightCoupling(next)
  next = applySaturdayGardeSingleDoctor(next)
  return next
}
