/**
 * Champs solveur weekend combo (M/O/W) pour POST /generate-week.
 *
 * - `weekend_astreinte_combo=true` uniquement si la semaine est dans le
 *   calendrier des 5 combos / semestre (`isWomComboWeekend`).
 * - Ancres = préférences fortes (rôle A = ATL, rôle B = Garde Sam), souples
 *   si congés côté solveur.
 * - `last_combo_garde_*` : espacement 15 j. — lire le résultat réel après
 *   Générer/validation, pas seulement les ancres envoyées.
 */

import { isListedDoctor } from "@/lib/doctor-code"
import type { EquityCounts } from "@/lib/equity-tracking"
import { dateStrForWeekDay } from "@/lib/fixed-assignments"
import type { ScheduleData } from "@/lib/types"
import {
  isWomComboWeekend,
  proposeWeekendWomPattern,
  WOM_ATL_DOCTORS,
  type WomAtlDoctor,
} from "@/lib/weekend-wom-rules"

export const LAST_COMBO_GARDE_DOCTOR_KEY = "last_combo_garde_doctor"
export const LAST_COMBO_GARDE_DATE_KEY = "last_combo_garde_date"

export type WeekendComboSolverFields = {
  weekend_astreinte_combo: true
  weekend_combo_astreinte_anchor: WomAtlDoctor
  weekend_combo_garde_anchor: WomAtlDoctor
  last_combo_garde_doctor?: string
  last_combo_garde_date?: string
}

export type LastComboGardeState = {
  doctor: string | null
  date: string | null
}

function isWom(doc: string): doc is WomAtlDoctor {
  return (WOM_ATL_DOCTORS as readonly string[]).includes(doc)
}

/**
 * Construit les champs combo pour le solveur, ou `null` si la semaine
 * n’est pas un week-end combo (ne rien envoyer).
 */
export function buildWeekendComboSolverFields(
  weekKey: string,
  last?: LastComboGardeState | null,
  equity?: Record<string, EquityCounts>,
): WeekendComboSolverFields | null {
  if (!weekKey || !isWomComboWeekend(weekKey)) return null

  const pattern = proposeWeekendWomPattern(weekKey, equity)
  if (!pattern || pattern.kind !== "combo") return null

  const fields: WeekendComboSolverFields = {
    weekend_astreinte_combo: true,
    // Rôle A = ATL Ven+Sat (+ Garde Dim) ; rôle B = Garde Sam (+ ATL Dim)
    weekend_combo_astreinte_anchor: pattern.atlSat,
    weekend_combo_garde_anchor: pattern.atlSun,
  }

  if (last?.doctor && isWom(last.doctor)) {
    fields.last_combo_garde_doctor = last.doctor
  }
  if (last?.date && /^\d{4}-\d{2}-\d{2}$/.test(last.date)) {
    fields.last_combo_garde_date = last.date
  }

  return fields
}

/** Samedi ISO (YYYY-MM-DD) de la semaine — date de référence du combo. */
export function saturdayIsoForWeekKey(weekKey: string): string | null {
  return dateStrForWeekDay(weekKey, "SAMEDI")
}

/**
 * Qui a réellement le rôle « garde » combo (Garde Sam) sur le planning.
 * Priorité Nuit → Midi → Matin ; premier M/O/W listé.
 */
export function extractComboGardeDoctor(schedule: ScheduleData): WomAtlDoctor | null {
  for (const row of ["Garde Nuit", "Garde Midi", "Garde Matin"] as const) {
    const values = schedule[row]?.SAMEDI?.value || []
    for (const d of values) {
      if (isWom(d) && isListedDoctor(d)) return d
    }
  }
  return null
}

/**
 * État à persister après Générer / validation d’un week-end combo.
 * Retourne null si pas de combo ou pas de Garde Sam WOM lisible.
 */
export function resolveLastComboGardeFromSchedule(
  weekKey: string,
  schedule: ScheduleData,
): LastComboGardeState | null {
  if (!isWomComboWeekend(weekKey)) return null
  const doctor = extractComboGardeDoctor(schedule)
  const date = saturdayIsoForWeekKey(weekKey)
  if (!doctor || !date) return null
  return { doctor, date }
}
