/**
 * Roulement des astreintes ATL entre les coronarographistes W/O/M et CH.
 *
 * Deux types de semaine alternent :
 * - semaine **WOM** : W/O/M = nuits Lun/Mar/Ven + week-end ATL ; CH = nuits Mer/Jeu ;
 * - semaine **CH**  : CH = nuits Lun/Mar/Ven + week-end ATL ; W/O/M = nuits Mer/Jeu.
 *
 * Jusqu'à fin 2026 : semaine WOM = n° ISO **pair** (week_type solveur = 2).
 *
 * À partir de **2027-W01** (consigne 02/10/2026) : le roulement est inversé —
 * la S1 2027 est une semaine WOM, puis l'alternance reprend une semaine sur
 * deux. 2026 compte 53 semaines ISO : la S53 2026 (impaire) est une semaine CH,
 * la S1 2027 enchaîne donc naturellement sur une semaine WOM. L'alternance est
 * calculée depuis la S1 2027 (et non par parité) pour rester correcte au-delà
 * des années à 53 semaines (prochaine : 2032).
 *
 * Le roulement est indépendant de la parité utilisée par Rythmo / infirmières /
 * Coro vendredi (`isOddIsoWeek`), qui ne change pas.
 */

import { mondayOfIsoWeekKey } from "@/lib/fixed-assignments"

/** Première semaine du roulement inversé (semaine WOM). */
export const ASTREINTE_CYCLE_2027_ANCHOR = "2027-W01"

const WEEK_MS = 7 * 86400000

function parseWeekKey(weekKey: string): { year: number; week: number } | null {
  const [yearStr, weekStr] = (weekKey || "").split("-W")
  const year = Number.parseInt(yearStr, 10)
  const week = Number.parseInt(weekStr, 10)
  if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1) return null
  return { year, week }
}

/**
 * Semaine où W/O/M assurent les nuits Lun/Mar/Ven + le week-end ATL
 * (CH = nuits Mer/Jeu).
 */
export function isWomAstreinteWeek(weekKey: string): boolean {
  const parsed = parseWeekKey(weekKey)
  if (!parsed) return false
  if (parsed.year < 2027) return parsed.week % 2 === 0

  const monday = mondayOfIsoWeekKey(weekKey)
  const anchor = mondayOfIsoWeekKey(ASTREINTE_CYCLE_2027_ANCHOR)
  if (!monday || !anchor) return false
  const weeksSinceAnchor = Math.round((monday.getTime() - anchor.getTime()) / WEEK_MS)
  return weeksSinceAnchor % 2 === 0
}

/** Semaine où CH assure les nuits Lun/Mar/Ven + le week-end ATL. */
export function isChAstreinteWeek(weekKey: string): boolean {
  return parseWeekKey(weekKey) !== null && !isWomAstreinteWeek(weekKey)
}

/**
 * Valeur `week_type` correspondant au roulement d'astreinte (1 = semaine CH,
 * 2 = semaine WOM), envoyée au solveur dans `astreinte_week_type`. Diffère du
 * `week_type` (parité ISO) à partir de 2027.
 */
export function astreinteWeekTypeForWeek(weekKey: string): 1 | 2 {
  return isWomAstreinteWeek(weekKey) ? 2 : 1
}

/** Nuits ATL Lun–Ven attribuées à CH par le roulement. */
export function chNightWeekdaysForWeek(weekKey: string): Set<string> {
  return isChAstreinteWeek(weekKey)
    ? new Set(["LUNDI", "MARDI", "VENDREDI"])
    : new Set(["MERCREDI", "JEUDI"])
}

/** Nombre de semaines ISO de l'année (52 ou 53). */
function isoWeeksInYear(year: number): number {
  // Le 28 décembre est toujours dans la dernière semaine ISO de l'année.
  const dec28 = new Date(Date.UTC(year, 11, 28))
  const monday = mondayOfIsoWeekKey(`${year}-W01`)
  if (!monday) return 52
  return Math.floor((dec28.getTime() - monday.getTime()) / WEEK_MS) + 1
}

/** Semaines WOM de l'année, dans l'ordre (ex. 2026 : W02…W52 ; 2027 : W01…W51). */
export function listWomAstreinteWeekKeys(year: number): string[] {
  const keys: string[] = []
  const total = isoWeeksInYear(year)
  for (let w = 1; w <= total; w++) {
    const key = `${year}-W${String(w).padStart(2, "0")}`
    if (isWomAstreinteWeek(key)) keys.push(key)
  }
  return keys
}

/**
 * Rang (0-based) de la semaine WOM dans son semestre (H1 = S1–S26,
 * H2 = S27+). `null` si ce n'est pas une semaine WOM.
 */
export function womWeekIndexInHalfYear(weekKey: string): number | null {
  const parsed = parseWeekKey(weekKey)
  if (!parsed || !isWomAstreinteWeek(weekKey)) return null
  const inH1 = parsed.week <= 26
  const sameHalf = listWomAstreinteWeekKeys(parsed.year).filter((k) => {
    const w = Number.parseInt(k.split("-W")[1], 10)
    return inH1 ? w <= 26 : w > 26
  })
  const idx = sameHalf.indexOf(weekKey)
  return idx < 0 ? null : idx
}
