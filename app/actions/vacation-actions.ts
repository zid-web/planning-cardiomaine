'use server'

import { createClient } from '@/lib/supabase/server'
import { DoctorVacation } from '@/lib/types'

/**
 * Récupère toutes les vacances / congés
 */
export async function getAllVacations(): Promise<DoctorVacation[]> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('doctor_vacations')
      .select('*')
      .order('start_date', { ascending: true })

    if (error) {
      console.error('[app] Error fetching vacations:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('[app] Error in getAllVacations:', error)
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
      console.error('[app] Error fetching doctor vacations:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('[app] Error in getDoctorVacationsList:', error)
    return []
  }
}

export type VacationWriteInput = {
  doctorId: string
  startDate: string
  endDate: string
  reason?: string | null
}

function normalizeDates(startDate: string, endDate: string): { start: string; end: string } | { error: string } {
  if (!startDate || !endDate) {
    return { error: 'Dates de début et de fin requises' }
  }
  if (endDate < startDate) {
    return { error: 'La date de fin doit être postérieure ou égale à la date de début' }
  }
  return { start: startDate, end: endDate }
}

/**
 * Ajoute un congé
 */
export async function addVacation(
  doctorId: string,
  startDate: string,
  endDate: string,
  reason?: string | null,
): Promise<{ success: boolean; error?: string; data?: DoctorVacation }> {
  try {
    if (!doctorId?.trim()) {
      return { success: false, error: 'Médecin requis' }
    }
    const dates = normalizeDates(startDate, endDate)
    if ('error' in dates) return { success: false, error: dates.error }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('doctor_vacations')
      .insert({
        doctor_id: doctorId.trim(),
        start_date: dates.start,
        end_date: dates.end,
        reason: reason?.trim() || null,
      })
      .select()
      .single()

    if (error) {
      console.error('[app] Error adding vacation:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[app] Error in addVacation:', error)
    return { success: false, error: errorMessage }
  }
}

/**
 * Supprime un congé
 */
export async function deleteVacation(vacationId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    const { error } = await supabase.from('doctor_vacations').delete().eq('id', vacationId)

    if (error) {
      console.error('[app] Error deleting vacation:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[app] Error in deleteVacation:', error)
    return { success: false, error: errorMessage }
  }
}

/**
 * Met à jour un congé (dates, médecin, motif)
 */
export async function updateVacation(
  vacationId: string,
  startDate: string,
  endDate: string,
  opts?: { doctorId?: string; reason?: string | null },
): Promise<{ success: boolean; error?: string; data?: DoctorVacation }> {
  try {
    if (!vacationId) {
      return { success: false, error: 'Identifiant de congé manquant' }
    }
    const dates = normalizeDates(startDate, endDate)
    if ('error' in dates) return { success: false, error: dates.error }

    const supabase = await createClient()

    const payload: Record<string, string | null> = {
      start_date: dates.start,
      end_date: dates.end,
      updated_at: new Date().toISOString(),
    }
    if (opts?.doctorId !== undefined) {
      if (!opts.doctorId.trim()) {
        return { success: false, error: 'Médecin requis' }
      }
      payload.doctor_id = opts.doctorId.trim()
    }
    if (opts && 'reason' in opts) {
      payload.reason = opts.reason?.trim() || null
    }

    const { data, error } = await supabase
      .from('doctor_vacations')
      .update(payload)
      .eq('id', vacationId)
      .select()
      .single()

    if (error) {
      console.error('[app] Error updating vacation:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[app] Error in updateVacation:', error)
    return { success: false, error: errorMessage }
  }
}
