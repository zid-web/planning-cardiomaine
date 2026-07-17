'use server'

import { DoctorVacation } from '@/lib/types'
import { STAFF_INITIALS, SPECIALTIES } from './constants'
import { NCT_DATES_2026, NCT_DATES_2025_DEC } from './guard-scheduler'
import { format, parseISO, isBefore, isAfter } from 'date-fns'

// All doctors: internal (with Supabase accounts) + external (no account)
// doctor_id in doctor_vacations table can be:
// - UUID: for internal doctors (stored in profiles table)
// - TEXT CODE: for external doctors like "FV" (not in profiles table)
const AVAILABLE_DOCTORS = ['A', 'Z', 'S', 'B', 'G', 'O', 'W', 'M', 'P', 'H', 'U', 'K', 'V', 'FV']

/**
 * Vérifie si un médecin est en vacances à une date donnée
 * doctor_id peut être un UUID ou un code texte (ex: "FV")
 */
export function isDoctorOnVacation(
  doctorId: string,
  dateStr: string,
  vacations: DoctorVacation[]
): boolean {
  const doctorVacations = vacations.filter((v) => v.doctor_id === doctorId)
  const targetDate = parseISO(dateStr)

  return doctorVacations.some((vacation) => {
    const startDate = parseISO(vacation.start_date)
    const endDate = parseISO(vacation.end_date)
    return !isBefore(targetDate, startDate) && !isAfter(targetDate, endDate)
  })
}

/**
 * Vérifie si un médecin peut être assigné à une activité/jour spécifique
 */
export function canAssignDoctorToDate(
  doctorId: string,
  dateStr: string,
  activity: string,
  vacations: DoctorVacation[]
): { allowed: boolean; reason?: string } {
  // Vérifier les vacances
  if (isDoctorOnVacation(doctorId, dateStr, vacations)) {
    return {
      allowed: false,
      reason: `Ce médecin est en congés ce jour-là (${dateStr})`,
    }
  }

  // Vérifier les contraintes FV
  if (doctorId === 'FV') {
    const date = parseISO(dateStr)
    const dayOfWeek = format(date, 'EEEE', { locale: require('date-fns/locale/fr') })

    if (activity === 'Garde Nuit' && dayOfWeek !== 'lundi') {
      return {
        allowed: false,
        reason: 'FV ne peut faire de garde de nuit que le lundi',
      }
    }

    if (activity === 'Coro' && dayOfWeek !== 'jeudi') {
      return {
        allowed: false,
        reason: 'FV ne peut faire de coro que le jeudi',
      }
    }
  }

  return { allowed: true }
}

/**
 * Interface pour tracker l'équité de charge
 */
interface EquityTracker {
  [doctorId: string]: {
    count: number
    astreinteCount: number
  }
}

/**
 * Calcule l'équité de charge pour les gardes
 */
function calculateEquity(
  doctors: string[],
  existingGuards: Array<{ doctor: string; type: string }>
): EquityTracker {
  const equity: EquityTracker = {}

  doctors.forEach((doctor) => {
    equity[doctor] = { count: 0, astreinteCount: 0 }
  })

  existingGuards.forEach((guard) => {
    if (equity[guard.doctor]) {
      equity[guard.doctor].count++
      if (
        guard.type === 'Astreinte Nuit' ||
        guard.type === 'Astreinte Matin' ||
        guard.type === 'Astreinte Midi'
      ) {
        equity[guard.doctor].astreinteCount++
      }
    }
  })

  return equity
}

/**
 * Sélectionne le médecin avec la charge la plus faible (équité)
 */
function selectByEquity(eligibleDoctors: string[], equity: EquityTracker): string {
  return eligibleDoctors.sort(
    (a, b) => equity[a].count - equity[b].count || equity[a].astreinteCount - equity[b].astreinteCount
  )[0]
}

/**
 * Sélectionne aléatoirement parmi les médecins éligibles (mais favorise l'équité)
 */
function selectRandomByEquity(eligibleDoctors: string[], equity: EquityTracker): string {
  // Trier par équité et prendre les 2-3 médecins les moins chargés
  const sorted = [...eligibleDoctors].sort((a, b) => equity[a].count - equity[b].count)
  const topCandidates = sorted.slice(0, Math.min(3, sorted.length))

  return topCandidates[Math.floor(Math.random() * topCandidates.length)]
}

/**
 * Génère les gardes/astreintes pour une semaine donnée avec les règles d'équité
 */
export function generateWeeklyGuards(
  weekKey: string, // Format: "2026-W01" ou "13/07"
  vacations: DoctorVacation[],
  existingGuards?: Array<{ date: string; doctor: string; type: string }>
): {
  guards: Array<{ date: string; day: string; doctor: string; type: string }>
  equity: EquityTracker
} {
  const DAYS_OF_WEEK = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI', 'DIMANCHE']
  const GENERAL_DOCTORS = ['A', 'Z', 'S', 'B', 'G', 'O', 'W', 'M', 'P', 'H']
  const ASTREINTE_DOCTORS = ['W', 'M', 'O']
  const NCT_DOCTORS = ['W', 'M']

  const guards: Array<{ date: string; day: string; doctor: string; type: string }> = []
  const equity = calculateEquity(GENERAL_DOCTORS, existingGuards || [])

  // TODO: Implémenter la génération complète avec:
  // - Rotation des astreintes de nuit (semaine 1 vs 2)
  // - Astreintes weekend
  // - Contrainte NCT
  // - Équité générale

  return { guards, equity }
}

/**
 * Génère les gardes pour plusieurs semaines
 */
export function generateGuardsForDateRange(
  startDate: string,
  endDate: string,
  vacations: DoctorVacation[]
): Array<{ date: string; day: string; doctor: string; type: string }> {
  const allGuards: Array<{ date: string; day: string; doctor: string; type: string }> = []

  // TODO: Boucler par semaine et générer

  return allGuards
}
