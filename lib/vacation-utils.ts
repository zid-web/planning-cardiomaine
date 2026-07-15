import { DoctorVacation } from './types'

/**
 * Vérifie si un médecin est en vacances à une date donnée
 */
export function isDoctorOnVacation(
  doctorId: string,
  date: Date,
  vacations: DoctorVacation[]
): boolean {
  return vacations.some((vacation) => {
    const startDate = new Date(vacation.start_date)
    const endDate = new Date(vacation.end_date)
    return doctorId === vacation.doctor_id && date >= startDate && date <= endDate
  })
}

/**
 * Obtient les médecins disponibles pour une date donnée
 */
export function getAvailableDoctorsForDate(
  allDoctors: string[],
  date: Date,
  vacations: DoctorVacation[]
): string[] {
  return allDoctors.filter((doctorId) => !isDoctorOnVacation(doctorId, date, vacations))
}

/**
 * Filtre les médecins en vacances pour une date
 */
export function getUnavailableDoctorsForDate(
  allDoctors: string[],
  date: Date,
  vacations: DoctorVacation[]
): string[] {
  return allDoctors.filter((doctorId) => isDoctorOnVacation(doctorId, date, vacations))
}

/**
 * Retourne toutes les vacances d'un médecin
 */
export function getDoctorVacations(
  doctorId: string,
  vacations: DoctorVacation[]
): DoctorVacation[] {
  return vacations.filter((v) => v.doctor_id === doctorId)
}

/**
 * Formate une plage de dates pour l'affichage
 */
export function formatDateRange(startDate: string | Date, endDate: string | Date): string {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate

  const startStr = start.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const endStr = end.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  return `${startStr} - ${endStr}`
}

/**
 * Calcule le nombre de jours de vacances
 */
export function getVacationDayCount(startDate: string | Date, endDate: string | Date): number {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate

  const diffTime = Math.abs(end.getTime() - start.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  return diffDays + 1 // Inclure le jour de début et de fin
}
