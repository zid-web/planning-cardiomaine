'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface PlanningNote {
  id: string
  content: string
  category: 'absence' | 'contrainte' | 'note_generale'
  created_by: string
  created_by_email: string
  created_at: string
  updated_at: string
}

/**
 * Récupère toutes les notes de planning (admin uniquement)
 */
export async function getPlanningNotes(): Promise<{ data: PlanningNote[] | null; error: string | null }> {
  try {
    const supabase = await createClient()

    // Vérifier que l'utilisateur est admin
    const { data: user } = await supabase.auth.getUser()
    if (!user?.user) {
      return { data: null, error: 'Non authentifié' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.user.id)
      .single()

    if (profile?.role !== 'admin') {
      return { data: null, error: 'Accès refusé - admin uniquement' }
    }

    const { data, error } = await supabase
      .from('planning_notes')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[v0] Error fetching planning notes:', error)
      return { data: null, error: error.message }
    }

    return { data: data as PlanningNote[], error: null }
  } catch (err) {
    console.error('[v0] Error in getPlanningNotes:', err)
    return { data: null, error: 'Erreur lors de la récupération des notes' }
  }
}

/**
 * Crée une nouvelle note de planning
 */
export async function createPlanningNote(
  content: string,
  category: 'absence' | 'contrainte' | 'note_generale' = 'note_generale'
): Promise<{ data: PlanningNote | null; error: string | null }> {
  try {
    if (!content || content.trim().length === 0) {
      return { data: null, error: 'Le contenu de la note ne peut pas être vide' }
    }

    const supabase = await createClient()

    const { data: user } = await supabase.auth.getUser()
    if (!user?.user) {
      return { data: null, error: 'Non authentifié' }
    }

    // Vérifier que l'utilisateur est admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.user.id)
      .single()

    if (profile?.role !== 'admin') {
      return { data: null, error: 'Accès refusé - admin uniquement' }
    }

    const { data, error } = await supabase
      .from('planning_notes')
      .insert({
        content: content.trim(),
        category,
        created_by: user.user.id,
        created_by_email: user.user.email,
      })
      .select()
      .single()

    if (error) {
      console.error('[v0] Error creating planning note:', error)
      return { data: null, error: error.message }
    }

    revalidatePath('/protected/planning-notes')
    return { data: data as PlanningNote, error: null }
  } catch (err) {
    console.error('[v0] Error in createPlanningNote:', err)
    return { data: null, error: 'Erreur lors de la création de la note' }
  }
}

/**
 * Met à jour une note de planning
 */
export async function updatePlanningNote(
  noteId: string,
  content: string,
  category: 'absence' | 'contrainte' | 'note_generale'
): Promise<{ data: PlanningNote | null; error: string | null }> {
  try {
    if (!content || content.trim().length === 0) {
      return { data: null, error: 'Le contenu de la note ne peut pas être vide' }
    }

    const supabase = await createClient()

    const { data: user } = await supabase.auth.getUser()
    if (!user?.user) {
      return { data: null, error: 'Non authentifié' }
    }

    // Vérifier que l'utilisateur est admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.user.id)
      .single()

    if (profile?.role !== 'admin') {
      return { data: null, error: 'Accès refusé - admin uniquement' }
    }

    const { data, error } = await supabase
      .from('planning_notes')
      .update({
        content: content.trim(),
        category,
        updated_at: new Date().toISOString(),
      })
      .eq('id', noteId)
      .select()
      .single()

    if (error) {
      console.error('[v0] Error updating planning note:', error)
      return { data: null, error: error.message }
    }

    revalidatePath('/protected/planning-notes')
    return { data: data as PlanningNote, error: null }
  } catch (err) {
    console.error('[v0] Error in updatePlanningNote:', err)
    return { data: null, error: 'Erreur lors de la mise à jour de la note' }
  }
}

/**
 * Supprime une note de planning
 */
export async function deletePlanningNote(noteId: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createClient()

    const { data: user } = await supabase.auth.getUser()
    if (!user?.user) {
      return { success: false, error: 'Non authentifié' }
    }

    // Vérifier que l'utilisateur est admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.user.id)
      .single()

    if (profile?.role !== 'admin') {
      return { success: false, error: 'Accès refusé - admin uniquement' }
    }

    const { error } = await supabase.from('planning_notes').delete().eq('id', noteId)

    if (error) {
      console.error('[v0] Error deleting planning note:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/protected/planning-notes')
    return { success: true, error: null }
  } catch (err) {
    console.error('[v0] Error in deletePlanningNote:', err)
    return { success: false, error: 'Erreur lors de la suppression de la note' }
  }
}
