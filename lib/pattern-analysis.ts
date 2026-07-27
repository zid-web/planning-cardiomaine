import { DAYS } from "@/lib/constants"
import { FREQUENCY_EXCLUDED_ROW_KEYS, isSolverHistoricalRowKey } from "@/lib/history-import"
import type { ScheduleData } from "@/lib/types"

export type PatternProposal = {
  row_key: string
  day_name: string
  doctors: string[]
  /** Fréquence du/des médecin(s) proposé(s) sur le total d'observations */
  count: number
  observations: number
  /** true si plusieurs médecins à égalité */
  tie: boolean
}

/** Payload solveur : éligibilité + fréquences déduites de l’historique. */
export type HistoricalPatternSlot = {
  eligible_doctors: string[]
  frequency: Record<string, number>
}

export type HistoricalPatternsPayload = Record<
  string,
  Record<string, HistoricalPatternSlot>
>

/**
 * Vacations cliniques matin/soir (Cs, ETT, EE, Stress) — hors Coro/Rythmo (solveur).
 * Aligné sur `isSolverHistoricalRowKey` (payload `historical_patterns`).
 */
export function isClinicalVacationRow(rowKey: string): boolean {
  return isSolverHistoricalRowKey(rowKey)
}

/** Buckets internes : clé `row||DAY` → médecin → occurrences. */
function collectFrequencyBuckets(
  schedules: ScheduleData[],
  opts?: { solverHistoricalOnly?: boolean },
): Map<string, Map<string, number>> {
  const freq = new Map<string, Map<string, number>>()
  const solverOnly = opts?.solverHistoricalOnly === true

  for (const schedule of schedules) {
    for (const [rowKey, days] of Object.entries(schedule || {})) {
      if (FREQUENCY_EXCLUDED_ROW_KEYS.has(rowKey)) continue
      if (solverOnly && !isSolverHistoricalRowKey(rowKey)) continue
      for (const day of DAYS) {
        const doctors = days?.[day]?.value || []
        if (!doctors.length) continue
        const key = `${rowKey}||${day}`
        if (!freq.has(key)) freq.set(key, new Map())
        const bucket = freq.get(key)!
        // Compte chaque médecin une fois par cellule (évite double-comptage P/P)
        for (const doc of new Set(doctors)) {
          bucket.set(doc, (bucket.get(doc) || 0) + 1)
        }
      }
    }
  }

  return freq
}

/**
 * Construit `historical_patterns` pour `/generate-week`.
 * Allowlist stricte : Cs / ETT / EE / Stress uniquement (le solveur ignore
 * ½-off, Visite, hors site, etc. avec un warning sinon).
 */
export function buildHistoricalPatternsPayload(
  schedules: ScheduleData[],
): HistoricalPatternsPayload {
  const freq = collectFrequencyBuckets(schedules, { solverHistoricalOnly: true })
  const out: HistoricalPatternsPayload = {}

  for (const [key, bucket] of freq) {
    if (bucket.size === 0) continue
    const [row_key, day_name] = key.split("||")
    if (!row_key || !day_name) continue

    const frequency: Record<string, number> = {}
    for (const [doc, count] of bucket) {
      if (count > 0) frequency[doc] = count
    }
    const eligible_doctors = Object.keys(frequency).sort()
    if (eligible_doctors.length === 0) continue

    if (!out[row_key]) out[row_key] = {}
    out[row_key][day_name] = { eligible_doctors, frequency }
  }

  return out
}

/**
 * Pour chaque (row_key, day_name) hors solveur/RYTHMO, calcule le(s) médecin(s)
 * le(s) plus fréquent(s). En cas d'ex-æquo, renvoie tous les leaders.
 */
export function computeRowPatternsFromSchedules(
  schedules: ScheduleData[],
  options?: { onlyEmptyIn?: ScheduleData | null },
): PatternProposal[] {
  const freq = collectFrequencyBuckets(schedules)
  const proposals: PatternProposal[] = []
  const onlyEmpty = options?.onlyEmptyIn

  for (const [key, bucket] of freq) {
    const [row_key, day_name] = key.split("||")
    if (!row_key || !day_name) continue

    if (onlyEmpty) {
      const existing = onlyEmpty[row_key]?.[day_name]?.value || []
      if (existing.length > 0) continue
    }

    let max = 0
    for (const c of bucket.values()) max = Math.max(max, c)
    if (max <= 0) continue
    const leaders = [...bucket.entries()]
      .filter(([, c]) => c === max)
      .map(([d]) => d)
      .sort()
    const observations = [...bucket.values()].reduce((a, b) => a + b, 0)
    proposals.push({
      row_key,
      day_name,
      doctors: leaders,
      count: max,
      observations,
      tie: leaders.length > 1,
    })
  }

  return proposals.sort((a, b) =>
    a.row_key === b.row_key
      ? DAYS.indexOf(a.day_name) - DAYS.indexOf(b.day_name)
      : a.row_key.localeCompare(b.row_key),
  )
}

/** Applique les propositions (médecins non-tie uniquement, ou tous si acceptTies). */
export function applyPatternProposals(
  schedule: ScheduleData,
  proposals: PatternProposal[],
  opts?: { acceptTies?: boolean; status?: "pending" | "validated" },
): { next: ScheduleData; applied: number; skippedTies: number } {
  let next = schedule
  let applied = 0
  let skippedTies = 0
  const acceptTies = opts?.acceptTies === true
  const status = opts?.status || "pending"

  for (const p of proposals) {
    if (p.tie && !acceptTies) {
      skippedTies += 1
      continue
    }
    if (!next[p.row_key]?.[p.day_name]) continue
    const cell = next[p.row_key][p.day_name]
    if ((cell.value || []).length > 0) continue
    const doctors = acceptTies ? p.doctors : p.doctors.slice(0, 1)
    next = {
      ...next,
      [p.row_key]: {
        ...next[p.row_key],
        [p.day_name]: {
          ...cell,
          value: doctors,
          type: "doctor",
          status,
        },
      },
    }
    applied += 1
  }
  return { next, applied, skippedTies }
}

/**
 * Remplit les cellules vides Cs/ETT/EE/Stress à partir des fréquences historiques.
 * Conservé pour tests / repli local — la génération principale envoie désormais
 * `historical_patterns` au solveur au lieu d’appliquer ceci après coup.
 */
export function fillClinicalVacationsFromPatterns(
  schedule: ScheduleData,
  historicalSchedules: ScheduleData[],
  opts?: { acceptTies?: boolean; status?: "pending" | "validated" },
): { next: ScheduleData; applied: number; skippedTies: number } {
  if (!historicalSchedules.length) {
    return { next: schedule, applied: 0, skippedTies: 0 }
  }
  const patterns = computeRowPatternsFromSchedules(historicalSchedules, {
    onlyEmptyIn: schedule,
  }).filter((p) => isClinicalVacationRow(p.row_key))
  return applyPatternProposals(schedule, patterns, {
    acceptTies: opts?.acceptTies === true,
    status: opts?.status || "pending",
  })
}
