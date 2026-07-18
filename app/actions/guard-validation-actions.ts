'use server'

import { createClient } from '@/lib/supabase/server'
import { canAssignDoctorToDate, isDoctorOnVacation } from '@/lib/guard-generation'
import { DoctorVacation } from '@/lib/types'

/**
 * Valide si un médecin peut être assigné à une date spécifique pour une activité
 */
export async function validateDoctorAssignment(
  doctorId: string,
  dateStr: string,
  activity: string
): Promise<{
  allowed: boolean
  reason?: string
}> {
  try {
    // Récupérer toutes les vacances depuis Supabase
    const supabase = await createClient()

    const { data: vacations, error } = await supabase
      .from('doctor_vacations')
      .select('*')
      .order('start_date', { ascending: true })

    if (error) {
      console.error('[v0] Error fetching vacations:', error)
      return { allowed: false, reason: 'Erreur lors de la vérification des vacances' }
    }

    // Utiliser la logique de validation
    const result = canAssignDoctorToDate(doctorId, dateStr, activity, (vacations || []) as DoctorVacation[])

    return result
  } catch (error) {
    console.error('[v0] Error in validateDoctorAssignment:', error)
    return { allowed: false, reason: 'Erreur lors de la validation' }
  }
}

/**
 * Récupère toutes les vacances pour affichage dans l'interface
 */
export async function getAllVacationsForPlanning(): Promise<DoctorVacation[]> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('doctor_vacations')
      .select('*')
      .order('start_date', { ascending: true })

    if (error) {
      console.error('[v0] Error fetching vacations:', error)
      return []
    }

    return (data || []) as DoctorVacation[]
  } catch (error) {
    console.error('[v0] Error in getAllVacationsForPlanning:', error)
    return []
  }
}
