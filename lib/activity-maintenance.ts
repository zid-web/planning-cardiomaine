/**
 * Suspensions d’activité (NCT / hors site PSSL·LFB·CDL) envoyées au solveur
 * via `activity_maintenance` — même idée que `room_maintenance` pour Coro.
 */

import { mondayOfIsoWeekKey } from "@/lib/fixed-assignments"

export type ActivityMaintenanceActivity = "NCT" | "PSSL" | "LFB" | "CDL"

export type ActivityMaintenancePeriod = {
  start_date: string // YYYY-MM-DD
  end_date: string // YYYY-MM-DD
  activities: ActivityMaintenanceActivity[]
  reason?: string
}

/** Activités hors site / NCT pouvant être suspendues. */
export const ACTIVITY_MAINTENANCE_ACTIVITIES: readonly ActivityMaintenanceActivity[] = [
  "NCT",
  "PSSL",
  "LFB",
  "CDL",
] as const

/** Row keys UI ↔ code activité solveur. */
export const ACTIVITY_MAINTENANCE_ROW_KEYS: Record<ActivityMaintenanceActivity, string> = {
  NCT: "Hors site - NCT",
  PSSL: "Hors site - PSSL",
  LFB: "Hors site - LFB",
  CDL: "Hors site - CDL",
}

function padWeek(week: number): string {
  return String(week).padStart(2, "0")
}

function toIsoDateUtc(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * Convertit une plage de semaines ISO inclusives en dates lundi→dimanche.
 * Ex. year=2026, startWeek=28, endWeek=36 → 2026-07-06 … 2026-09-06.
 */
export function isoWeekInclusiveRangeToDates(
  year: number,
  startWeek: number,
  endWeek: number,
): { start_date: string; end_date: string } | null {
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(startWeek) ||
    !Number.isFinite(endWeek) ||
    startWeek < 1 ||
    endWeek < startWeek
  ) {
    return null
  }
  const mondayStart = mondayOfIsoWeekKey(`${year}-W${padWeek(startWeek)}`)
  const mondayEnd = mondayOfIsoWeekKey(`${year}-W${padWeek(endWeek)}`)
  if (!mondayStart || !mondayEnd) return null
  const sundayEnd = new Date(mondayEnd.getTime())
  sundayEnd.setUTCDate(mondayEnd.getUTCDate() + 6)
  return {
    start_date: toIsoDateUtc(mondayStart),
    end_date: toIsoDateUtc(sundayEnd),
  }
}

/**
 * Calendrier métier 2026 (confirmé 29/07/2026) :
 * - PSSL / LFB / CDL : S28 → S36 inclus
 * - NCT : S31 → S36 inclus
 */
export function buildDefaultActivityMaintenance2026(): ActivityMaintenancePeriod[] {
  const horsSite = isoWeekInclusiveRangeToDates(2026, 28, 36)
  const nct = isoWeekInclusiveRangeToDates(2026, 31, 36)
  const out: ActivityMaintenancePeriod[] = []
  if (horsSite) {
    out.push({
      ...horsSite,
      activities: ["PSSL", "LFB", "CDL"],
      reason: "Suspension hors site S28–S36 2026",
    })
  }
  if (nct) {
    out.push({
      ...nct,
      activities: ["NCT"],
      reason: "Suspension NCT S31–S36 2026",
    })
  }
  return out
}

/** Payload complet pour `/generate-week` (toutes périodes connues). */
export function buildActivityMaintenancePayload(
  periods: ActivityMaintenancePeriod[] = buildDefaultActivityMaintenance2026(),
): ActivityMaintenancePeriod[] {
  return periods.map((p) => ({
    start_date: p.start_date,
    end_date: p.end_date,
    activities: [...p.activities],
    ...(p.reason ? { reason: p.reason } : {}),
  }))
}

function parseIsoDay(iso: string): number {
  // Compare YYYY-MM-DD lexicographically (UTC calendar dates)
  return iso < "0000-01-01" ? NaN : Date.parse(`${iso}T00:00:00.000Z`)
}

/** True si `isoDate` (YYYY-MM-DD) tombe dans une suspension pour `activity`. */
export function isActivitySuspendedOnDate(
  isoDate: string,
  activity: ActivityMaintenanceActivity,
  periods: ActivityMaintenancePeriod[] = buildDefaultActivityMaintenance2026(),
): boolean {
  if (!isoDate || !activity) return false
  const t = parseIsoDay(isoDate)
  if (!Number.isFinite(t)) return false
  for (const p of periods) {
    if (!p.activities.includes(activity)) continue
    const a = parseIsoDay(p.start_date)
    const b = parseIsoDay(p.end_date)
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue
    if (t >= a && t <= b) return true
  }
  return false
}

/**
 * True si la semaine ISO chevauche une suspension pour `activity`
 * (au moins un jour lun–dim).
 */
export function isActivitySuspendedInWeek(
  weekKey: string,
  activity: ActivityMaintenanceActivity,
  periods: ActivityMaintenancePeriod[] = buildDefaultActivityMaintenance2026(),
): boolean {
  const monday = mondayOfIsoWeekKey(weekKey)
  if (!monday) return false
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday.getTime())
    d.setUTCDate(monday.getUTCDate() + i)
    if (isActivitySuspendedOnDate(toIsoDateUtc(d), activity, periods)) return true
  }
  return false
}
