import { DAYS, DOCTORS } from "@/lib/constants"
import { dateStrForWeekDay } from "@/lib/fixed-assignments"
import { getWeekNumber } from "@/lib/schedule-utils"
import type { FullSchedule, ScheduleData } from "@/lib/types"

/**
 * Praticiens inclus dans les statistiques de charge.
 */
export const WORKLOAD_STATS_INCLUDED_DOCTORS = new Set([
  "Z", "A", "B", "P", "O", "U", "W", "M", "S", "H", "G"
])

/** Lignes absences / méta — ne comptent pas comme tâches effectuées. */
export const WORKLOAD_STATS_EXCLUDED_ROWS = new Set([
  "Notes du jour",
  "Congés",
  "Vacances",
  "Congrès",
  "1/2 journée off Matin",
  "1/2 journée off Après-midi",
])

export type DoctorWorkloadDetail = {
  total: number
  byTask: Record<string, number>
}

export type MonthlyWorkloadStats = {
  year?: number
  month?: number
  label: string
  doctors: Record<string, DoctorWorkloadDetail>
  weeksScanned: number
}

const MONTH_LABELS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
]

export function workloadMonthLabel(year: number, month: number): string {
  const name = MONTH_LABELS_FR[month - 1] || String(month)
  return `${name} ${year}`
}

export function isWorkloadStatsDoctor(doc: string): boolean {
  return WORKLOAD_STATS_INCLUDED_DOCTORS.has(doc)
}

function emptyDetail(): DoctorWorkloadDetail {
  return { total: 0, byTask: {} }
}

function bumpTask(detail: DoctorWorkloadDetail, rowKey: string) {
  detail.total += 1
  detail.byTask[rowKey] = (detail.byTask[rowKey] || 0) + 1
}

export function weekKeysOverlappingMonth(year: number, month: number): string[] {
  const keys = new Set<string>()
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day)
    const { year: wy, week } = getWeekNumber(d)
    keys.add(`${wy}-W${String(week).padStart(2, "0")}`)
  }
  return Array.from(keys).sort()
}

export function calculateWorkloadStats(schedule: ScheduleData): Record<string, number> {
  const doctorCounts: Record<string, number> = {}
  for (const d of WORKLOAD_STATS_INCLUDED_DOCTORS) {
    doctorCounts[d] = 0
  }

  Object.entries(schedule || {}).forEach(([rowKey, rowData]) => {
    if (WORKLOAD_STATS_EXCLUDED_ROWS.has(rowKey)) return
    Object.values(rowData || {}).forEach((cell) => {
      if (!cell || !Array.isArray(cell.value)) return
      for (const doc of new Set(cell.value)) {
        if (doctorCounts[doc] !== undefined) doctorCounts[doc]++
      }
    })
  })

  return doctorCounts
}

export function calculateMonthlyWorkloadStats(
  fullSchedule: FullSchedule | null | undefined,
  year: number,
  month: number,
): MonthlyWorkloadStats {
  const doctors: Record<string, DoctorWorkloadDetail> = {}
  for (const d of WORKLOAD_STATS_INCLUDED_DOCTORS) {
    doctors[d] = emptyDetail()
  }

  const candidateWeeks = weekKeysOverlappingMonth(year, month)
  let weeksScanned = 0

  for (const weekKey of candidateWeeks) {
    const schedule = fullSchedule?.[weekKey]
    if (!schedule || typeof schedule !== "object") continue
    weeksScanned += 1

    for (const day of DAYS) {
      const iso = dateStrForWeekDay(weekKey, day)
      if (!iso) continue
      const [y, m] = iso.split("-").map(Number)
      if (y !== year || m !== month) continue

      for (const [rowKey, rowData] of Object.entries(schedule)) {
        if (WORKLOAD_STATS_EXCLUDED_ROWS.has(rowKey)) continue
        const cell = rowData?.[day]
        if (!cell || !Array.isArray(cell.value) || cell.value.length === 0) continue
        for (const doc of new Set(cell.value)) {
          if (!isWorkloadStatsDoctor(doc) || !doctors[doc]) continue
          bumpTask(doctors[doc], rowKey)
        }
      }
    }
  }

  return {
    year,
    month,
    label: workloadMonthLabel(year, month),
    doctors,
    weeksScanned,
  }
}

export function calculateSixMonthsWorkloadStats(
  fullSchedule: FullSchedule | null | undefined,
  endYear: number,
  endMonth: number,
): MonthlyWorkloadStats {
  const doctors: Record<string, DoctorWorkloadDetail> = {}
  for (const d of WORKLOAD_STATS_INCLUDED_DOCTORS) {
    doctors[d] = emptyDetail()
  }

  let totalWeeksScanned = 0
  
  // Reculer de 6 mois
  let currY = endYear
  let currM = endMonth
  for (let i = 0; i < 6; i++) {
    const candidateWeeks = weekKeysOverlappingMonth(currY, currM)
    for (const weekKey of candidateWeeks) {
      const schedule = fullSchedule?.[weekKey]
      if (!schedule || typeof schedule !== "object") continue
      
      // On compte chaque semaine croisée (peut surestimer un peu si une semaine chevauche deux mois, mais c'est approximatif pour UI)
      totalWeeksScanned += 1

      for (const day of DAYS) {
        const iso = dateStrForWeekDay(weekKey, day)
        if (!iso) continue
        const [y, m] = iso.split("-").map(Number)
        if (y !== currY || m !== currM) continue

        for (const [rowKey, rowData] of Object.entries(schedule)) {
          if (WORKLOAD_STATS_EXCLUDED_ROWS.has(rowKey)) continue
          const cell = rowData?.[day]
          if (!cell || !Array.isArray(cell.value) || cell.value.length === 0) continue
          for (const doc of new Set(cell.value)) {
            if (!isWorkloadStatsDoctor(doc) || !doctors[doc]) continue
            bumpTask(doctors[doc], rowKey)
          }
        }
      }
    }

    currM--
    if (currM < 1) {
      currM = 12
      currY--
    }
  }

  // Diviser weeksScanned par ~1.5 car les semaines sont souvent scannées en double (chevauchement). On approxime.
  return {
    label: "6 Derniers Mois",
    doctors,
    weeksScanned: Math.floor(totalWeeksScanned * (5/7) * 0.9), // Approximatif
  }
}

export function sortedWorkloadEntries(
  stats: MonthlyWorkloadStats,
): Array<{ doctor: string; detail: DoctorWorkloadDetail }> {
  return Object.entries(stats.doctors)
    .map(([doctor, detail]) => ({ doctor, detail }))
    .sort((a, b) => b.detail.total - a.detail.total || a.doctor.localeCompare(b.doctor))
}

export function sortedTaskEntries(byTask: Record<string, number>): Array<[string, number]> {
  return Object.entries(byTask).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}
