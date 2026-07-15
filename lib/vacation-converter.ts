import { DoctorVacation } from './types'

/**
 * Convertit les DoctorVacation de la base de données en format vacation2026
 * utilisé par le guard-scheduler
 */
export function convertVacationsForScheduler(vacations: DoctorVacation[]): {
  [user: string]: string[]
} {
  const result: { [user: string]: string[] } = {}

  vacations.forEach((vacation) => {
    const doctorId = vacation.doctor_id
    if (!result[doctorId]) {
      result[doctorId] = []
    }

    // Ajouter toutes les dates entre start_date et end_date
    const startDate = new Date(vacation.start_date)
    const endDate = new Date(vacation.end_date)

    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dateStr = date.toISOString().split('T')[0]
      if (!result[doctorId].includes(dateStr)) {
        result[doctorId].push(dateStr)
      }
    }
  })

  return result
}

/**
 * Fusionne les vacations statiques avec les vacations de la base de données
 */
export function mergeVacations(
  staticVacations: { [user: string]: string[] },
  dbVacations: DoctorVacation[]
): { [user: string]: string[] } {
  const convertedDb = convertVacationsForScheduler(dbVacations)
  const merged = { ...staticVacations }

  Object.entries(convertedDb).forEach(([doctorId, dates]) => {
    if (!merged[doctorId]) {
      merged[doctorId] = []
    }
    merged[doctorId] = Array.from(new Set([...merged[doctorId], ...dates]))
  })

  return merged
}
