import { DOCTOR_METADATA } from '@/lib/constants'
import { FV_ATL_ROW } from '@/lib/group-clinical-rules'

/**
 * Filtre les médecins pouvant être assignés à une activité spécifique
 */
export function getAssignableDoctors(activity: string): string[] {
  const assignableList: string[] = []

  Object.entries(DOCTOR_METADATA).forEach(([doctorId, metadata]) => {
    if (activity === 'Garde Nuit' || activity === 'Garde Matin' || activity === 'Garde Midi') {
      if (metadata.can_be_assigned_to_guards) {
        assignableList.push(doctorId)
      }
    } else if (
      activity === 'Astreinte Nuit' ||
      activity === 'Astreinte Matin' ||
      activity === 'Astreinte Midi' ||
      activity === 'Astreinte Weekend' ||
      activity === 'Astreintes ATL Matin' ||
      activity === 'Astreintes ATL Midi' ||
      activity === 'Astreintes ATL Nuit'
    ) {
      if (metadata.can_be_assigned_to_astreinte) {
        assignableList.push(doctorId)
      }
      // FV : uniquement ATL Midi (jeudi en pratique — jour filtré à l’assignation)
      if (doctorId === 'FV' && activity === FV_ATL_ROW) {
        assignableList.push(doctorId)
      }
    } else if (activity === 'NCT') {
      if (metadata.can_be_assigned_to_nct) {
        assignableList.push(doctorId)
      }
    } else if (activity === 'CORO' || activity === 'Matin - Coro' || activity === 'Apm - Coro') {
      // Coronarographistes salle (pas CH)
      if (doctorId === 'W' || doctorId === 'M' || doctorId === 'O' || doctorId === 'FV') {
        assignableList.push(doctorId)
      }
    } else if (activity === 'CS' || activity === 'RYTHMO') {
      // Consultations - tous les médecins internes
      if (!metadata.is_externe) {
        assignableList.push(doctorId)
      }
    }
  })

  return assignableList
}

/**
 * Vérifie si un médecin peut être assigné à une activité
 */
export function canAssignDoctorToActivity(doctorId: string, activity: string): boolean {
  const metadata = DOCTOR_METADATA[doctorId]
  if (!metadata) return false

  if (activity === 'Garde Nuit' || activity === 'Garde Matin' || activity === 'Garde Midi') {
    return metadata.can_be_assigned_to_guards
  } else if (
    activity === 'Astreinte Nuit' ||
    activity === 'Astreinte Matin' ||
    activity === 'Astreinte Midi' ||
    activity === 'Astreinte Weekend' ||
    activity === 'Astreintes ATL Matin' ||
    activity === 'Astreintes ATL Midi' ||
    activity === 'Astreintes ATL Nuit'
  ) {
    if (metadata.can_be_assigned_to_astreinte) return true
    // FV listé sur ATL Midi ; le jour (jeudi) est contrôlé dans slot-blocking
    return doctorId === 'FV' && activity === FV_ATL_ROW
  } else if (activity === 'NCT') {
    return metadata.can_be_assigned_to_nct
  } else if (activity === 'CORO' || activity === 'Matin - Coro' || activity === 'Apm - Coro') {
    return doctorId === 'W' || doctorId === 'M' || doctorId === 'O' || doctorId === 'FV'
  } else if (activity === 'CS' || activity === 'RYTHMO') {
    return !metadata.is_externe
  }

  return false
}

/**
 * Récupère les médecins internes uniquement (avec compte authentifié)
 */
export function getInternalDoctors(): string[] {
  return Object.entries(DOCTOR_METADATA)
    .filter(([, metadata]) => !metadata.is_externe)
    .map(([doctorId]) => doctorId)
}

/**
 * Récupère les médecins externes
 */
export function getExternalDoctors(): string[] {
  return Object.entries(DOCTOR_METADATA)
    .filter(([, metadata]) => metadata.is_externe)
    .map(([doctorId]) => doctorId)
}

/**
 * Vérifie si un médecin est externe
 */
export function isExternalDoctor(doctorId: string): boolean {
  return DOCTOR_METADATA[doctorId]?.is_externe ?? false
}

/**
 * Récupère le statut d'un médecin
 */
export function getDoctorStatus(doctorId: string): string {
  return DOCTOR_METADATA[doctorId]?.status ?? 'unknown'
}

/**
 * Récupère le nom complet d'un médecin
 */
export function getDoctorName(doctorId: string): string {
  return DOCTOR_METADATA[doctorId]?.name ?? doctorId
}
