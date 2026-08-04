'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { saveScheduleToDb } from '@/app/actions/schedule-actions';
import type { ScheduleData } from '@/lib/types';

const MAX_PROCESSED_REQUESTS = 10;

/**
 * Archive les demandes traitées (approuvées/rejetées) les plus anciennes
 * au-delà de MAX_PROCESSED_REQUESTS, pour garder la liste active propre
 * (confirmé utilisateur 01/08/2026). Les demandes en attente ("pending") ne
 * sont jamais archivées. Best-effort : une erreur ici ne doit jamais faire
 * échouer l'approbation/rejet en cours.
 */
async function archiveOldProcessedRequests() {
  try {
    const supabase = await createClient();
    const { data: processed } = await supabase
      .from('change_requests')
      .select('*')
      .neq('status', 'pending')
      .order('updated_at', { ascending: false });

    if (!processed || processed.length <= MAX_PROCESSED_REQUESTS) return;

    const toArchive = processed.slice(MAX_PROCESSED_REQUESTS);
    const historyRows = toArchive.map((r) => ({
      original_id: r.id,
      requester_id: r.requester_id,
      week_key: r.week_key,
      day_name: r.day_name,
      row_key: r.row_key,
      slot: r.slot,
      current_doctor: r.current_doctor,
      requested_doctor: r.requested_doctor,
      reason: r.reason,
      status: r.status,
      admin_comment: r.admin_comment,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));

    const { error: insertError } = await supabase.from('change_requests_history').insert(historyRows);
    if (insertError) {
      console.error('[change-request-actions] archive insert error:', insertError);
      return;
    }

    const idsToDelete = toArchive.map((r) => r.id);
    await supabase.from('change_requests').delete().in('id', idsToDelete);
  } catch (err) {
    console.error('[change-request-actions] archiveOldProcessedRequests:', err);
  }
}

/**
 * Récupère l'historique archivé des demandes traitées (lecture pour tous).
 */
export async function getChangeRequestsHistory(limit = 50) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('change_requests_history')
    .select('*')
    .order('archived_at', { ascending: false })
    .limit(limit);
  return data || [];
}

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

  const adminDb = createAdminClient();
  const { data: profile, error: profileError } = await adminDb
    .from('profiles')
    .select('role, doctor_code')
    .eq('id', user.id)
    .single();

  const profileRole = profile?.role?.toLowerCase() || '';
  const doctorCode = profile?.doctor_code?.toUpperCase() || '';
  const userEmail = user.email?.toLowerCase() || '';

  // Admins principaux : M, Z, Lucie (L) + tous les utilisateurs authentifiés ont accès libre
  const isAdmin = true;

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

  // 6. Archivage best-effort si trop de demandes traitées accumulées
  await archiveOldProcessedRequests();

  // 7. Revalider le cache
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

  const adminDb = createAdminClient();
  const { data: profile, error: profileError } = await adminDb
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const profileRole = profile?.role?.toLowerCase() || '';
  const userEmail = user.email?.toLowerCase() || '';

  // Admins principaux : M, Z, Lucie (L) + tous les utilisateurs authentifiés ont accès libre
  const isAdmin = true;

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

  await archiveOldProcessedRequests();

  revalidatePath('/protected/admin/requests');

  return { success: true, message: 'Demande refusée' };
}
