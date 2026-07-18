import { DoctorVacation, ScheduleData } from '@/lib/types'
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
  vacations: DoctorVacation[],
  schedule?: ScheduleData
): {
  allowed: boolean
  reason?: string
} {
  // 1. Check vacations
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

  // 2. Check NCT vs Astreinte conflict (if schedule is provided)
  if (schedule) {
    const dayName = getDayNameFromDate(dateStr)
    
    // If assigning to an astreinte, check if doctor is already on NCT
    if (activity.includes("Astreintes ATL")) {
      const nctCell = schedule["Hors site - NCT"]?.[dayName]
      const nctDoctors = nctCell?.value || []
      
      if (nctDoctors.includes(doctorId)) {
        return {
          allowed: false,
          reason: `${doctorId} est assigné au NCT ce jour. Il ne peut pas faire d'astreinte en même temps.`,
        }
      }
    }
    
    // If assigning to NCT, check if doctor is already on an astreinte
    if (activity.includes("Hors site - NCT")) {
      const astreinteRows = Object.keys(schedule).filter(row => row.includes("Astreintes ATL"))
      
      for (const rowKey of astreinteRows) {
        const astreinteCell = schedule[rowKey]?.[dayName]
        const astrenteDoctors = astreinteCell?.value || []
        
        if (astrenteDoctors.includes(doctorId)) {
          return {
            allowed: false,
            reason: `${doctorId} est assigné à l'astreinte ce jour. Il ne peut pas faire de NCT en même temps.`,
          }
        }
      }
    }
  }

  return { allowed: true }
}

// Helper function to convert date string to day name
function getDayNameFromDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00Z")
  const dayIndex = date.getUTCDay()
  const days = ["DIMANCHE", "LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI"]
  return days[dayIndex]
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
