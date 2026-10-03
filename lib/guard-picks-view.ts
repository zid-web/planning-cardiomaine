/**
 * Aides d'affichage pour « Choix de Gardes » (calendrier mois / semestre) —
 * fonctions pures, sans dépendance React, testées dans guard-picks-view.test.ts.
 */

export type GuardPickType = "Garde Matin" | "Garde Nuit"

/** Sous-ensemble de `GuardPickRow` utilisé ici (structurel : évite d'importer une server action). */
export type PickLike = {
  date: string
  guard_type: GuardPickType
  status: "pending" | "approved" | "rejected"
  doctor_code: string
}

export type GuardSlotSummary = {
  /** attribuée (une demande approuvée) > en attente (au moins une demande) > libre */
  state: "approved" | "pending" | "free"
  /** Médecin de la demande approuvée. */
  doctor?: string
  pendingCount: number
}

export function summarizeGuardSlot(
  picks: readonly PickLike[],
  date: string,
  guardType: GuardPickType,
): GuardSlotSummary {
  const forSlot = picks.filter((p) => p.date === date && p.guard_type === guardType)
  const approved = forSlot.find((p) => p.status === "approved")
  const pendingCount = forSlot.filter((p) => p.status === "pending").length
  if (approved) return { state: "approved", doctor: approved.doctor_code, pendingCount }
  if (pendingCount > 0) return { state: "pending", pendingCount }
  return { state: "free", pendingCount: 0 }
}

export type GuardCursor = {
  semester: 1 | 2
  year: number
  /** 0 = janvier. S1 = janvier→août (0..7), S2 = septembre→décembre (8..11). */
  month0: number
}

export const SEMESTER_MONTHS: Record<1 | 2, readonly number[]> = {
  1: [0, 1, 2, 3, 4, 5, 6, 7],
  2: [8, 9, 10, 11],
}

/** Curseur d'ouverture : le mois courant, dans son semestre. */
export function defaultGuardCursor(today: Date = new Date()): GuardCursor {
  const month0 = today.getMonth()
  return { semester: month0 <= 7 ? 1 : 2, year: today.getFullYear(), month0 }
}

/**
 * Mois précédent / suivant en restant dans le calendrier des semestres :
 * août (S1) → septembre (S2), décembre (S2) → janvier de l'année suivante (S1).
 */
export function stepGuardMonth(c: GuardCursor, delta: 1 | -1): GuardCursor {
  if (delta === 1) {
    if (c.month0 === 7) return { semester: 2, year: c.year, month0: 8 }
    if (c.month0 === 11) return { semester: 1, year: c.year + 1, month0: 0 }
    return { ...c, month0: c.month0 + 1 }
  }
  if (c.month0 === 8) return { semester: 1, year: c.year, month0: 7 }
  if (c.month0 === 0) return { semester: 2, year: c.year - 1, month0: 11 }
  return { ...c, month0: c.month0 - 1 }
}

/** Semestre précédent / suivant (vue d'ensemble) : on retombe sur son premier mois. */
export function stepGuardSemester(c: GuardCursor, delta: 1 | -1): GuardCursor {
  if (delta === 1) {
    return c.semester === 1
      ? { semester: 2, year: c.year, month0: 8 }
      : { semester: 1, year: c.year + 1, month0: 0 }
  }
  return c.semester === 2
    ? { semester: 1, year: c.year, month0: 0 }
    : { semester: 2, year: c.year - 1, month0: 8 }
}

export const GUARD_MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
] as const

/** `YYYY-MM` du curseur (clé de regroupement `groupSlotsByMonth`). */
export function guardMonthKey(c: Pick<GuardCursor, "year" | "month0">): string {
  return `${c.year}-${String(c.month0 + 1).padStart(2, "0")}`
}
