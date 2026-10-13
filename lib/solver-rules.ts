/**
 * Consignes de l'application transmises au solveur externe (bloc `app_rules`).
 *
 * Tout est DÉRIVÉ des constantes de l'app (aucune règle dupliquée à la main) :
 * le solveur reçoit pour la semaine les cases fermées, les règles de garde, les
 * limites hebdomadaires et les cases déjà saisies. Les règles restent de toute
 * façon appliquées localement après le solveur (lib/clinical-priority.ts).
 * Contrat : docs/SOLVER-CONTRACT.md.
 */

import { DAYS } from "@/lib/constants"
import { dateStrForWeekDay } from "@/lib/fixed-assignments"
import { closedSlotReason, HORS_SITE_USUAL_DAYS, isSlotClosed } from "@/lib/closed-slots"
import { holidayClosedReason, holidayNameForWeekDay, isHolidayClosedSlot } from "@/lib/holiday-closed"
import { isNctClosedOnDate } from "@/lib/nct-calendar"
import { NIGHT_GUARD_DAY_RULES, NO_FRIDAY_NIGHT_GUARD } from "@/lib/guard-scheduler"
import { EE_SOLO_DOCTORS, FRIDAY_NIGHT_GUARD_POOL } from "@/lib/slot-blocking"
import { STRESS_ROWS } from "@/lib/stress-weekly"
import type { ScheduleData } from "@/lib/types"

export const SOLVER_RULES_VERSION = 1

export type SolverRulesPayload = ReturnType<typeof buildSolverRulesPayload>

export function buildSolverRulesPayload(
  weekKey: string,
  opts: { previousSundayGuardDoctor?: string | null; fridayGuardCounts?: Record<string, number>; nightGuardDayCounts?: Record<string, Record<string, number>>; schedule?: ScheduleData; rows?: string[] } = {},
) {
  const schedule = opts.schedule
  const rows = opts.rows ?? Object.keys(schedule ?? {})

  const holidays: Record<string, string> = {}
  const closed: Array<{ row: string; day: string; reason: string }> = []
  for (const day of DAYS) {
    const iso = dateStrForWeekDay(weekKey, day)
    const holiday = holidayNameForWeekDay(weekKey, day)
    if (holiday) holidays[day] = holiday
    for (const row of rows) {
      if (row === "Notes du jour") continue
      if (isHolidayClosedSlot(row, holiday)) {
        closed.push({ row, day, reason: holidayClosedReason(holiday as string) })
      } else if (isSlotClosed(row, day)) {
        closed.push({ row, day, reason: closedSlotReason(row, day) ?? "fermé" })
      } else if (row === "Hors site - NCT" && isNctClosedOnDate(iso)) {
        closed.push({ row, day, reason: "NCT : aucune vacation ouverte au calendrier NCT." })
      }
    }
  }

  // Cases déjà saisies / validées (hors propositions du solveur) à ne pas écraser
  const fixed: Array<{ row: string; day: string; doctors: string[] }> = []
  const cleared: Array<{ row: string; day: string }> = []
  if (schedule) {
    for (const row of rows) {
      for (const day of DAYS) {
        const cell = schedule[row]?.[day]
        if (!cell) continue
        if (cell.manuallyCleared) cleared.push({ row, day })
        else if (cell.status === "validated" && cell.value?.length) {
          fixed.push({ row, day, doctors: [...cell.value] })
        }
      }
    }
  }

  return {
    version: SOLVER_RULES_VERSION,
    week_key: weekKey,
    holidays,
    closed_slots: closed,
    fixed_assignments: fixed,
    cleared_cells: cleared,
    night_guard: {
      no_consecutive_nights: true,
      previous_sunday_guard_doctor: opts.previousSundayGuardDoctor ?? null,
      friday_pool: [...FRIDAY_NIGHT_GUARD_POOL],
      // gardes de nuit du vendredi déjà faites (26 sem.) : le solveur égalise entre les médecins du pool
      friday_counts: opts.fridayGuardCounts ?? {},
      never_friday: [...NO_FRIDAY_NIGHT_GUARD],
      day_preferences: NIGHT_GUARD_DAY_RULES,
      // historique par jour : le solveur égalise entre les médecins préférés du jour (ex. mercredi S / P)
      day_counts: opts.nightGuardDayCounts ?? {},
      never_doctors: ["I"],
      rest_after_night: {
        half_day_off: true,
        forbidden_rows_next_day: ["Matin - Coro", "Apm - Coro", "Astreintes ATL", "Matin - Rythmo"],
      },
    },
    weekly_limits: {
      stress: {
        rows: [...STRESS_ROWS],
        max_per_doctor_per_week: 1,
        only_if_enough_available_doctors: true,
        excluded_from_limit: ["D"],
      },
      pre_op: { distinct_doctor_per_day: true },
    },
    eligibility: {
      ett_forbidden: ["O"],
      ee_solo_doctors: [...EE_SOLO_DOCTORS],
      ee_rule: "un seul médecin par infirmière (Val/Véro), identique sur EE1 et EE2; seuls O, V, DAAS sans infirmière",
      intern_only_row: "Garde Matin",
    },
    priorities: {
      coro_first: ["M", "O", "W"],
      echo_group: ["H", "Z", "G", "B", "S"],
      echo_rows_before_cs: ["ETT", "Stress", "Rééduc"],
      cs_filled_by: "médecins sans tâche principale",
    },
    coro_one_each_per_day: {
      doctors: ["M", "O", "W"], // si les trois sont présents : chacun une seule vacation (Coro matin, Coro apm ou nuit)
      penalty: 80,
    },
    atl_night: {
      never: ["FV"], // FV ne fait jamais d'astreinte ATL Nuit
      follow_midi: true, // le médecin d'ATL Midi fait la nuit dans la mesure du possible
      not_with_night_guard: true, // jamais le médecin de garde de nuit le même soir (jeudi : W/M si O de garde)
    },
    entrees_pss: {
      row: "Entrées PSS",
      pair_days: ["LUNDI", "MARDI"], // médecin de garde d'après-midi (Garde Midi) + 1 autre médecin
      solo_days: ["MERCREDI", "JEUDI", "VENDREDI"], // uniquement le médecin de garde d'après-midi
    },
    hors_site_usual_days: HORS_SITE_USUAL_DAYS,
  }
}

/** Le solveur a-t-il accusé réception des consignes ? */
export function solverAcknowledgedRules(data: unknown): boolean {
  const d = data as { applied_rules?: unknown; rules_version?: unknown } | null
  return Boolean(d && (d.applied_rules || d.rules_version))
}
