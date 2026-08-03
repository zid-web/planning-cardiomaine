'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type PrivateNote = {
  id: string;
  note_date: string;
  target_doctor: string;
  note_text: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

/**
 * Notes privées admin -> médecin (confirmé utilisateur 01/08/2026) :
 * visible uniquement par l'admin qui écrit et le médecin destinataire, pas
 * par les autres utilisateurs. Distinct des "Notes du jour" partagées à
 * tous (voir "Notes du jour" dans ScheduleData).
 */

/** Note privée adressée à l'utilisateur courant, pour une date donnée (RLS filtre déjà). */
export async function getMyPrivateNote(noteDate: string): Promise<PrivateNote | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('doctor_code')
    .eq('id', user.id)
    .single();
  if (!profile?.doctor_code) return null;

  const { data } = await supabase
    .from('private_notes')
    .select('*')
    .eq('note_date', noteDate)
    .eq('target_doctor', profile.doctor_code)
    .maybeSingle();

  return (data as PrivateNote) || null;
}

/** Toutes les notes privées pour une date (admin uniquement, RLS + vérif explicite). */
export async function getAllPrivateNotesForDate(noteDate: string): Promise<PrivateNote[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, doctor_code')
    .eq('id', user.id)
    .single();

  const isAdmin = profile?.role === 'admin' || user.email?.toLowerCase().includes('admin') || ['M', 'Z', 'L'].includes(profile?.doctor_code?.toUpperCase() || '');
  if (!isAdmin) return [];

  const { data } = await supabase
    .from('private_notes')
    .select('*')
    .eq('note_date', noteDate)
    .order('target_doctor', { ascending: true });

  return (data as PrivateNote[]) || [];
}

/** Crée ou met à jour la note privée pour un médecin donné, une date donnée (admin uniquement). */
export async function upsertPrivateNote(
  noteDate: string,
  targetDoctor: string,
  noteText: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Non authentifié' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, doctor_code')
    .eq('id', user.id)
    .single();
    
  const isAdmin = profile?.role === 'admin' || user.email?.toLowerCase().includes('admin') || ['M', 'Z', 'L'].includes(profile?.doctor_code?.toUpperCase() || '');
  if (!isAdmin) {
    return { success: false, error: 'Droits insuffisants (admin requis)' };
  }
  if (!targetDoctor.trim()) {
    return { success: false, error: 'Médecin destinataire requis' };
  }

  const createdBy = profile.doctor_code || user.email?.split('@')[0]?.toUpperCase() || 'admin';

  const { data: existing } = await supabase
    .from('private_notes')
    .select('id')
    .eq('note_date', noteDate)
    .eq('target_doctor', targetDoctor)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('private_notes')
      .update({ note_text: noteText, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    if (error) return { success: false, error: error.message };
  } else {
    const { error } = await supabase.from('private_notes').insert({
      note_date: noteDate,
      target_doctor: targetDoctor,
      note_text: noteText,
      created_by: createdBy,
    });
    if (error) return { success: false, error: error.message };
  }

  revalidatePath('/protected/planning');
  return { success: true };
}

/** Supprime la note privée d'un médecin pour une date donnée (admin uniquement). */
export async function deletePrivateNote(
  noteDate: string,
  targetDoctor: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Non authentifié' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, doctor_code')
    .eq('id', user.id)
    .single();
    
  const isAdmin = profile?.role === 'admin' || user.email?.toLowerCase().includes('admin') || ['M', 'Z', 'L'].includes(profile?.doctor_code?.toUpperCase() || '');
  if (!isAdmin) {
    return { success: false, error: 'Droits insuffisants (admin requis)' };
  }

  const { error } = await supabase
    .from('private_notes')
    .delete()
    .eq('note_date', noteDate)
    .eq('target_doctor', targetDoctor);
  if (error) return { success: false, error: error.message };

  revalidatePath('/protected/planning');
  return { success: true };
}
