'use server'

import { createClient } from '@/lib/supabase/server'
import { DoctorVacation } from '@/lib/types'

/**
 * Récupère toutes les vacances
 */
export async function getAllVacations(): Promise<DoctorVacation[]> {
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

    return data || []
  } catch (error) {
    console.error('[v0] Error in getAllVacations:', error)
    return []
  }
}

/**
 * Récupère les vacances d'un médecin
 */
export async function getDoctorVacationsList(doctorId: string): Promise<DoctorVacation[]> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('doctor_vacations')
      .select('*')
      .eq('doctor_id', doctorId)
      .order('start_date', { ascending: true })

    if (error) {
      console.error('[v0] Error fetching doctor vacations:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('[v0] Error in getDoctorVacationsList:', error)
    return []
  }
}

/**
 * Ajoute une vacation
 */
export async function addVacation(
  doctorId: string,
  startDate: string,
  endDate: string,
  reason?: string
): Promise<{ success: boolean; error?: string; data?: DoctorVacation }> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('doctor_vacations')
      .insert({
        doctor_id: doctorId,
        start_date: startDate,
        end_date: endDate,
        reason: reason || null,
      })
      .select()
      .single()

    if (error) {
      console.error('[v0] Error adding vacation:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[v0] Error in addVacation:', error)
    return { success: false, error: errorMessage }
  }
}

/**
 * Supprime une vacation
 */
export async function deleteVacation(vacationId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    const { error } = await supabase.from('doctor_vacations').delete().eq('id', vacationId)

    if (error) {
      console.error('[v0] Error deleting vacation:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[v0] Error in deleteVacation:', error)
    return { success: false, error: errorMessage }
  }
}

/**
 * Met à jour une vacation
 */
export async function updateVacation(
  vacationId: string,
  startDate: string,
  endDate: string,
  reason?: string
): Promise<{ success: boolean; error?: string; data?: DoctorVacation }> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('doctor_vacations')
      .update({
        start_date: startDate,
        end_date: endDate,
        reason: reason || null,
      })
      .eq('id', vacationId)
      .select()
      .single()

    if (error) {
      console.error('[v0] Error updating vacation:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[v0] Error in updateVacation:', error)
    return { success: false, error: errorMessage }
  }
}
