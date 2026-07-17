import { DoctorVacation } from '@/lib/types'
import { parseISO, isAfter, isBefore } from 'date-fns'

/**
 * Vérifie si un médecin est indisponible (en vacances) à une date donnée
 */
export function isDoctorUnavailable(
  doctorId: string,
  dateStr: string,
  vacations: DoctorVacation[]
): boolean {
  // CH et FV n'ont pas de vacances
  if (doctorId === 'CH' || doctorId === 'FV') return false

  const doctorVacations = vacations.filter((v) => v.doctor_id === doctorId)
  if (doctorVacations.length === 0) return false

  const targetDate = parseISO(dateStr)

  return doctorVacations.some((vacation) => {
    const startDate = parseISO(vacation.start_date)
    const endDate = parseISO(vacation.end_date)
    return !isBefore(targetDate, startDate) && !isAfter(targetDate, endDate)
  })
}

/**
 * Vérifie si une assignation est autorisée
 * Retourne {allowed: boolean, reason?: string}
 */
export function canAssignDoctor(
  doctorId: string,
  dateStr: string,
  activity: string,
  vacations: DoctorVacation[]
): {
  allowed: boolean
  reason?: string
} {
  if (isDoctorUnavailable(doctorId, dateStr, vacations)) {
    // Trouver la vacation pour afficher les dates exactes
    const vacation = vacations.find(
      (v) =>
        v.doctor_id === doctorId &&
        !isBefore(parseISO(dateStr), parseISO(v.start_date)) &&
        !isAfter(parseISO(dateStr), parseISO(v.end_date))
    )

    if (vacation) {
      return {
        allowed: false,
        reason: `Ce médecin est en congés du ${vacation.start_date} au ${vacation.end_date}. Assignation impossible.`,
      }
    }

    return {
      allowed: false,
      reason: `Ce médecin est indisponible ce jour. Assignation impossible.`,
    }
  }

  return { allowed: true }
}

/**
 * Détecte les conflits: un médecin assigné mais en vacances ce jour
 */
export function detectConflict(
  doctorId: string,
  dateStr: string,
  activity: string,
  vacations: DoctorVacation[]
): {
  hasConflict: boolean
  message?: string
} {
  if (isDoctorUnavailable(doctorId, dateStr, vacations)) {
    return {
      hasConflict: true,
      message: `⚠️ Conflit: ${doctorId} est assigné à ${activity} mais en congés ce jour.`,
    }
  }

  return { hasConflict: false }
}

/**
 * Liste toutes les activités couvertes par l'indisponibilité
 */
export const UNAVAILABILITY_AFFECTS_ACTIVITIES = [
  'CS', // Consultations
  'CORO', // Coronarographie
  'RYTHMO', // Rythmologie
  'Garde Nuit',
  'Astreinte Nuit',
  'Astreinte Matin',
  'Astreinte Midi',
  'Astreinte Weekend',
  'NCT', // Non-cardiac time (jeudi)
  'Coro Après-midi',
  'Congés', // Vacations
]
