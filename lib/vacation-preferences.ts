/**
 * Préférences de vacation **souples** (« souvent » / « rarement ») — consignes
 * groupe, distinctes des créneaux fixes (`DOC022_FIXED_CLINICAL_SLOTS`) et des
 * blocages durs (`lib/slot-blocking.ts`).
 *
 * - `souvent`  : le médecin est le candidat privilégié de la case (le solveur
 *                peut toujours choisir quelqu’un d’autre si nécessaire).
 * - `rarement` : le médecin est écarté de la case **tant qu’un autre candidat
 *                existe** (« rarement » ≠ « jamais »).
 *
 * Deux points d’application :
 * 1. `applyPreferenceBias` biaise `historical_patterns` envoyé au solveur
 *    (`/generate-week`) — c’est le levier principal de la génération.
 * 2. `preferredPartnerForNurseSlot` oriente le choix du médecin partenaire
 *    quand une infirmière est posée seule sur Stress/EE (voir `nurse-rules.ts`).
 */

import { DAYS } from "@/lib/constants"
import { isDoctorOnVacationForFixed } from "@/lib/fixed-assignments"
import type { HistoricalPatternsPayload } from "@/lib/pattern-analysis"
import type { DoctorVacation, ScheduleData } from "@/lib/types"

export type PreferenceStrength = "souvent" | "rarement"

export type VacationPreference = {
  row: string
  day: string
  doctor: string
  strength: PreferenceStrength
  /** Infirmière habituellement en binôme sur cette case (Stress / EE). */
  nurse?: string
  /**
   * Préférence annulée si le médecin est au lendemain d’une garde de nuit
   * (la ½ off de récupération ne couvre que l’après-midi).
   */
  notAfterNightGuard?: boolean
  note?: string
}

/**
 * Consignes utilisateur (26/08/2026) :
 * - K souvent au Stress le mardi matin, en binôme avec Véro.
 * - K rarement au Stress le mercredi matin.
 * - S souvent au Stress le vendredi matin, sauf lendemain de garde ou congés.
 */
export const VACATION_PREFERENCES: readonly VacationPreference[] = [
  {
    row: "Matin - Stress",
    day: "MARDI",
    doctor: "K",
    strength: "souvent",
    nurse: "Véro",
    note: "K souvent au Stress mardi matin (binôme Véro)",
  },
  {
    row: "Matin - Stress",
    day: "MERCREDI",
    doctor: "K",
    strength: "rarement",
    note: "K rarement au Stress mercredi matin",
  },
  {
    row: "Matin - Stress",
    day: "VENDREDI",
    doctor: "S",
    strength: "souvent",
    notAfterNightGuard: true,
    note: "S souvent au Stress vendredi matin, sauf lendemain de garde ou congés",
  },
] as const

/**
 * Écart de fréquence appliqué à un « souvent » par rapport au meilleur autre
 * candidat de la case : assez pour mener, pas assez pour figer la case.
 */
export const PREFERENCE_BONUS = 2

const NIGHT_GUARD_ROW = "Garde Nuit"

/** Le médecin sortait-il d’une garde de nuit la veille de `day` ? */
export function isDayAfterNightGuard(
  schedule: ScheduleData | undefined,
  day: string,
  doctorId: string,
): boolean {
  if (!schedule) return false
  const idx = DAYS.indexOf(day as (typeof DAYS)[number])
  if (idx <= 0) return false
  const previous = DAYS[idx - 1]
  return (schedule[NIGHT_GUARD_ROW]?.[previous]?.value || []).includes(doctorId)
}

export type PreferenceContext = {
  weekKey?: string
  schedule?: ScheduleData
  vacations?: DoctorVacation[]
  /** Résout la date ISO d’un jour de la semaine (injecté pour les tests). */
  dateStrForDay?: (day: string) => string | null
}

/**
 * Une préférence est-elle applicable cette semaine ? Un « souvent » saute si le
 * médecin est en congés ou (quand `notAfterNightGuard`) au lendemain de garde.
 * Un « rarement » reste applicable : il ne fait qu’écarter un candidat.
 */
export function isPreferenceActive(
  pref: VacationPreference,
  ctx: PreferenceContext = {},
): boolean {
  if (pref.strength === "rarement") return true

  const dateStr = ctx.dateStrForDay?.(pref.day) ?? null
  if (dateStr && isDoctorOnVacationForFixed(pref.doctor, dateStr, ctx.vacations || [])) {
    return false
  }
  const conges = ctx.schedule?.["Congés"]?.[pref.day]?.value || []
  if (conges.includes(pref.doctor)) return false

  if (pref.notAfterNightGuard && isDayAfterNightGuard(ctx.schedule, pref.day, pref.doctor)) {
    return false
  }
  return true
}

/**
 * Médecin à privilégier comme partenaire d’une infirmière sur une case
 * Stress / EE, ou `null` si aucune préférence active. `pool` restreint le
 * résultat aux partenaires valides de la ligne.
 */
export function preferredPartnerForNurseSlot(
  rowKey: string,
  day: string,
  pool: readonly string[],
  ctx: PreferenceContext = {},
): string | null {
  for (const pref of VACATION_PREFERENCES) {
    if (pref.strength !== "souvent") continue
    if (pref.row !== rowKey || pref.day !== day) continue
    if (!pool.includes(pref.doctor)) continue
    if (!isPreferenceActive(pref, ctx)) continue
    return pref.doctor
  }
  return null
}

/** Médecins écartés (« rarement ») d’une case donnée. */
export function discouragedDoctorsForSlot(rowKey: string, day: string): string[] {
  return VACATION_PREFERENCES.filter(
    (p) => p.strength === "rarement" && p.row === rowKey && p.day === day,
  ).map((p) => p.doctor)
}

/**
 * Biaise `historical_patterns` avec les préférences groupe avant envoi au
 * solveur. Ne modifie pas l’objet reçu.
 *
 * - `souvent`  : le médecin est ajouté aux `eligible_doctors` et sa fréquence
 *   passe au-dessus du meilleur autre candidat (`PREFERENCE_BONUS`).
 * - `rarement` : le médecin est retiré — sauf s’il est le seul candidat connu
 *   de la case (on ne crée pas d’infaisabilité pour une préférence souple).
 */
export function applyPreferenceBias(
  patterns: HistoricalPatternsPayload,
  ctx: PreferenceContext = {},
): HistoricalPatternsPayload {
  const out: HistoricalPatternsPayload = {}
  for (const [row, days] of Object.entries(patterns || {})) {
    out[row] = {}
    for (const [day, slot] of Object.entries(days || {})) {
      out[row][day] = {
        eligible_doctors: [...slot.eligible_doctors],
        frequency: { ...slot.frequency },
      }
    }
  }

  for (const pref of VACATION_PREFERENCES) {
    if (!isPreferenceActive(pref, ctx)) continue

    if (pref.strength === "rarement") {
      const slot = out[pref.row]?.[pref.day]
      if (!slot) continue
      const others = slot.eligible_doctors.filter((d) => d !== pref.doctor)
      if (others.length === 0) continue // seul candidat connu : on le garde
      slot.eligible_doctors = others
      delete slot.frequency[pref.doctor]
      continue
    }

    if (!out[pref.row]) out[pref.row] = {}
    const slot = out[pref.row][pref.day] || { eligible_doctors: [], frequency: {} }
    const bestOther = Math.max(
      0,
      ...Object.entries(slot.frequency)
        .filter(([doc]) => doc !== pref.doctor)
        .map(([, count]) => count),
    )
    slot.frequency[pref.doctor] = Math.max(
      slot.frequency[pref.doctor] || 0,
      bestOther + PREFERENCE_BONUS,
    )
    if (!slot.eligible_doctors.includes(pref.doctor)) {
      slot.eligible_doctors = [...slot.eligible_doctors, pref.doctor].sort()
    }
    out[pref.row][pref.day] = slot
  }

  return out
}
