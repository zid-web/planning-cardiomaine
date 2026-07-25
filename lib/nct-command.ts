import { DAYS } from "@/lib/constants"
import { getWeekNumber } from "@/lib/schedule-utils"
import type { FullSchedule, ScheduleData } from "@/lib/types"
import { generateWeekSchedule } from "@/lib/schedule-utils"

export type NctAssignment = {
  date: string // YYYY-MM-DD
  doctor: string
}

const DAY_FROM_JS = ["DIMANCHE", "LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI"]

/** Détecte une liste de dates NCT collée dans la dictée / saisie manuelle. */
export function looksLikeNctScheduleText(text: string): boolean {
  const t = text || ""
  const hasNctWord = /\bNCT\b/i.test(t)
  const dateHits = t.match(/\d{4}-\d{2}-\d{2}/g) || []
  const arrowHits = t.match(/\d{4}-\d{2}-\d{2}\s*(?:→|->|=>|:)\s*[A-Za-z]{1,4}/g) || []
  return (hasNctWord && dateHits.length >= 2) || arrowHits.length >= 2
}

/**
 * Parse les lignes du type :
 *   ✅ 2026-09-10 → M
 *   2026-09-17 -> W
 *   2026-09-24: M
 */
export function parseNctAssignmentsFromText(text: string): NctAssignment[] {
  const assignments: NctAssignment[] = []
  const re =
    /(\d{4}-\d{2}-\d{2})\s*(?:→|->|=>|:)\s*([A-Za-z]{1,4})\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text || "")) !== null) {
    const date = m[1]
    const doctor = m[2].toUpperCase()
    if (!assignments.some((a) => a.date === date && a.doctor === doctor)) {
      assignments.push({ date, doctor })
    }
  }
  return assignments
}

export function weekKeyFromIsoDate(isoDate: string): string {
  const [y, mo, d] = isoDate.split("-").map(Number)
  const date = new Date(y, (mo || 1) - 1, d || 1)
  const { year, week } = getWeekNumber(date)
  return `${year}-W${String(week).padStart(2, "0")}`
}

export function dayNameFromIsoDateLocal(isoDate: string): string {
  const [y, mo, d] = isoDate.split("-").map(Number)
  const date = new Date(y, (mo || 1) - 1, d || 1)
  return DAY_FROM_JS[date.getDay()] || "JEUDI"
}

/**
 * Applique des NCT (date → médecin) sur plusieurs semaines du fullSchedule.
 * Retourne les semaines modifiées (clés) + le fullSchedule mis à jour.
 */
export function applyNctAssignmentsToFullSchedule(
  fullSchedule: FullSchedule,
  assignments: NctAssignment[],
): { next: FullSchedule; touchedWeekKeys: string[]; applied: number; skipped: string[] } {
  let next: FullSchedule = { ...fullSchedule }
  const touched = new Set<string>()
  const skipped: string[] = []
  let applied = 0

  for (const { date, doctor } of assignments) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !doctor) {
      skipped.push(`${date}:${doctor}`)
      continue
    }
    const day = dayNameFromIsoDateLocal(date)
    if (!DAYS.includes(day)) {
      skipped.push(`${date} (jour invalide)`)
      continue
    }
    // NCT métier = jeudi ; on accepte quand même les autres jours si fournis
    const weekKey = weekKeyFromIsoDate(date)
    const base =
      next[weekKey] ||
      (generateWeekSchedule(weekKey) as ScheduleData)
    const row = base["Hors site - NCT"]
    if (!row?.[day]) {
      skipped.push(`${date} (ligne NCT absente)`)
      continue
    }
    const cell = row[day]
    next = {
      ...next,
      [weekKey]: {
        ...base,
        "Hors site - NCT": {
          ...row,
          [day]: {
            ...cell,
            value: [doctor],
            type: "doctor",
            status: cell.status || "validated",
          },
        },
      },
    }
    touched.add(weekKey)
    applied += 1
  }

  return { next, touchedWeekKeys: Array.from(touched), applied, skipped }
}
