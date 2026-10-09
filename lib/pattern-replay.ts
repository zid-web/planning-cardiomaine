/**
 * Apprentissage du remplissage manuel : reproduit, sur les cases encore vides, les
 * schémas que l'admin applique d'habitude à la main.
 *
 * On compte, sur les dernières semaines **enregistrées**, qui occupe chaque case
 * (ligne × jour) et qui est le binôme de chaque infirmière. Une saisie manuelle
 * pèse plus qu'une case validée sans retouche ; les semaines récentes pèsent plus
 * que les anciennes ; les propositions non validées (`pending`) sont ignorées —
 * le générateur ne doit pas apprendre de ses propres propositions.
 *
 * Le solveur externe ne lit pas ces schémas : ils sont rejoués localement, après
 * lui, et chaque candidat reste soumis à la validation de l'affectation manuelle.
 */
import { DAYS, NURSES } from "@/lib/constants"
import { isListedDoctor } from "@/lib/doctor-code"
import type { ScheduleData } from "@/lib/types"

/** Lignes dont les schémas sont rejoués (hors Coro, gardes, ATL : rotations dédiées). */
export const REPLAY_ROWS = [
  "Matin - ETT salle 1", "Matin - ETT salle 2", "Apm - ETT salle 1", "Apm - ETT salle 2",
  "Matin - Stress", "Apm - Stress", "Apm - RÉEDUCATION",
  "Matin - EE1", "Matin - EE2", "Apm - EE1", "Apm - EE2",
  "Matin - Cs PSS", "Apm - Cs PSS", "Matin - Cs Tessée", "Apm - Cs Tessée",
  "Pré-op",
] as const

export const MANUAL_WEIGHT = 3
export const VALIDATED_WEIGHT = 1
export const DEFAULT_REPLAY_WEEKS = 26

export type PatternStats = {
  /** `${row}||${day}` → médecin → poids. */
  slots: Map<string, Map<string, number>>
  /** `${row}||${day}||${infirmière}` → médecin partenaire → poids. */
  pairs: Map<string, Map<string, number>>
  weeksUsed: number
}

const NURSE_SET = new Set<string>(NURSES)
const REPLAY_SET = new Set<string>(REPLAY_ROWS)

function bump(map: Map<string, Map<string, number>>, key: string, doc: string, w: number) {
  let bucket = map.get(key)
  if (!bucket) map.set(key, (bucket = new Map()))
  bucket.set(doc, (bucket.get(doc) || 0) + w)
}

export function isLearnableDoctor(doc: string): boolean {
  return Boolean(doc) && isListedDoctor(doc) && !NURSE_SET.has(doc) && doc !== "CH" && doc !== "FV" && doc !== "I"
}

/**
 * `weeks` : semaines passées (n'importe quel ordre). Les plus récentes pèsent jusqu'à
 * 1,5× les plus anciennes. Cases `pending` et vidées à la main ignorées.
 */
export function buildPatternStats(
  weeks: ReadonlyArray<{ weekKey: string; schedule: ScheduleData }>,
  maxWeeks: number = DEFAULT_REPLAY_WEEKS,
): PatternStats {
  const sorted = [...weeks]
    .filter((w) => w.schedule && typeof w.schedule === "object")
    .sort((a, b) => (a.weekKey < b.weekKey ? 1 : -1))
    .slice(0, maxWeeks)
  const stats: PatternStats = { slots: new Map(), pairs: new Map(), weeksUsed: sorted.length }

  sorted.forEach(({ schedule }, rank) => {
    const recency = 1 + 0.5 * (1 - rank / Math.max(1, sorted.length))
    for (const row of REPLAY_ROWS) {
      const days = schedule[row]
      if (!days) continue
      for (const day of DAYS) {
        const cell = days[day]
        if (!cell || cell.status === "pending" || cell.manuallyCleared) continue
        const values = Array.isArray(cell.value) ? cell.value : []
        if (!values.length) continue
        const w = (cell.manualAssignment ? MANUAL_WEIGHT : VALIDATED_WEIGHT) * recency
        const nurses = values.filter((v) => NURSE_SET.has(v))
        for (const doc of new Set(values)) {
          if (!isLearnableDoctor(doc)) continue
          bump(stats.slots, `${row}||${day}`, doc, w)
          for (const nurse of nurses) bump(stats.pairs, `${row}||${day}||${nurse}`, doc, w)
        }
      }
    }
  })
  return stats
}

/** Médecins appris pour une case, du plus fréquent au moins fréquent. */
export function learnedCandidates(stats: PatternStats | undefined, row: string, day: string): string[] {
  if (!stats || !REPLAY_SET.has(row)) return []
  const bucket = stats.slots.get(`${row}||${day}`)
  if (!bucket) return []
  return [...bucket.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([d]) => d)
}

/** Binômes appris pour une infirmière sur une case, du plus fréquent au moins fréquent. */
export function learnedPartners(stats: PatternStats | undefined, row: string, day: string, nurse: string): string[] {
  if (!stats) return []
  const bucket = stats.pairs.get(`${row}||${day}||${nurse}`)
  if (!bucket) return []
  return [...bucket.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([d]) => d)
}

/** Construit les stats depuis le planning complet en mémoire (semaine donnée exclue). */
export function buildPatternStatsFromFull(
  full: Record<string, ScheduleData | undefined>,
  excludeWeekKey?: string,
  maxWeeks: number = DEFAULT_REPLAY_WEEKS,
): PatternStats {
  const weeks = Object.entries(full)
    .filter(([k, s]) => /^\d{4}-W\d{2}$/.test(k) && k !== excludeWeekKey && s)
    .map(([weekKey, schedule]) => ({ weekKey, schedule: schedule as ScheduleData }))
  return buildPatternStats(weeks, maxWeeks)
}
