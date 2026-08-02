'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { saveScheduleToDb } from '@/app/actions/schedule-actions';
import type { ScheduleData } from '@/lib/types';

/**
 * Applique une demande de changement approuvée
 * - Vérifie que l'utilisateur est admin
 * - Récupère la demande
 * - Met à jour la table schedules (via saveScheduleToDb → historique + sync blob)
 * - Marque la demande comme approved
 */
export async function applyChangeRequest(requestId: string) {
  const supabase = await createClient();

  // 1. Vérifier l'authentification et les droits admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Non authentifié' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, doctor_code')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    // DIAGNOSTIC TEMPORAIRE (confirmé utilisateur 01/08/2026) : affiche la
    // vraie erreur de la requête pour comprendre "Droits insuffisants" -
    // à retirer une fois la cause identifiée.
    console.error('[change-request-actions] profile lookup:', { userId: user.id, profile, profileError });
    return {
      success: false,
      error: `Droits insuffisants (admin requis) — diag: profile=${JSON.stringify(profile)} err=${profileError?.message || 'aucune'}`,
    };
  }

  // 2. Récupérer la demande
  const { data: request, error: fetchError } = await supabase
    .from('change_requests')
    .select('*')
    .eq('id', requestId)
    .eq('status', 'pending')
    .single();

  if (fetchError || !request) {
    return { success: false, error: 'Demande introuvable ou déjà traitée' };
  }

  // 3. Appliquer la modification dans schedules
  const { data: currentSchedule, error: scheduleError } = await supabase
    .from('schedules')
    .select('schedule_data')
    .eq('week_key', request.week_key)
    .single();

  if (scheduleError && scheduleError.code !== 'PGRST116') {
    return { success: false, error: 'Erreur lors de la récupération du planning' };
  }

  const scheduleData = (currentSchedule?.schedule_data || {}) as ScheduleData;

  if (!scheduleData[request.row_key]) {
    scheduleData[request.row_key] = {};
  }
  if (!scheduleData[request.row_key][request.day_name]) {
    scheduleData[request.row_key][request.day_name] = { value: [], type: 'empty', status: 'validated' };
  }

  const cell = scheduleData[request.row_key][request.day_name];

  if (request.current_doctor) {
    cell.value = cell.value.filter((d: string) => d !== request.current_doctor);
  }

  if (!cell.value.includes(request.requested_doctor)) {
    cell.value.push(request.requested_doctor);
    cell.type = 'doctor';
  }

  // 4. Sauvegarder via action centralisée (historique G2 + sync full_schedule G6)
  try {
    const updatedBy =
      profile.doctor_code || user.email?.split('@')[0]?.toUpperCase() || 'admin';
    await saveScheduleToDb(request.week_key, scheduleData, updatedBy, {
      source: 'change_request',
    });
  } catch {
    return { success: false, error: 'Erreur lors de la mise à jour du planning' };
  }

  // 5. Marquer la demande comme approuvée
  const { error: updateError } = await supabase
    .from('change_requests')
    .update({
      status: 'approved',
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  if (updateError) {
    return { success: false, error: 'Erreur lors de la mise à jour du statut' };
  }

  // 6. Revalider le cache
  revalidatePath('/protected/planning');
  revalidatePath('/protected/admin/requests');

  return {
    success: true,
    message: `Demande approuvée : ${request.requested_doctor} remplace ${request.current_doctor || 'vide'} dans ${request.row_key} le ${request.day_name}`,
  };
}

/**
 * Refuse une demande de changement
 */
export async function rejectChangeRequest(requestId: string, comment?: string) {
  const supabase = await createClient();

  // 1. Vérifier l'authentification et les droits admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Non authentifié' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    console.error('[change-request-actions] reject profile lookup:', { userId: user.id, profile, profileError });
    return {
      success: false,
      error: `Droits insuffisants (admin requis) — diag: profile=${JSON.stringify(profile)} err=${profileError?.message || 'aucune'}`,
    };
  }

  // 2. Vérifier que la demande existe et est en attente
  const { data: request, error: fetchError } = await supabase
    .from('change_requests')
    .select('id')
    .eq('id', requestId)
    .eq('status', 'pending')
    .single();

  if (fetchError || !request) {
    return { success: false, error: 'Demande introuvable ou déjà traitée' };
  }

  // 3. Marquer comme refusée
  const { error: updateError } = await supabase
    .from('change_requests')
    .update({
      status: 'rejected',
      admin_comment: comment || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  if (updateError) {
    return { success: false, error: 'Erreur lors de la mise à jour' };
  }

  revalidatePath('/protected/admin/requests');

  return { success: true, message: 'Demande refusée' };
}
