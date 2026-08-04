'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { saveScheduleToDb } from '@/app/actions/schedule-actions';
import type { ScheduleData } from '@/lib/types';

const MAX_PROCESSED_REQUESTS = 10;

/**
 * Archive les demandes traitées (approuvées/rejetées) les plus anciennes
 * au-delà de MAX_PROCESSED_REQUESTS.
 */
async function archiveOldProcessedRequests() {
  try {
    const adminDb = createAdminClient();
    const { data: processed } = await adminDb
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

    const { error: insertError } = await adminDb.from('change_requests_history').insert(historyRows);
    if (insertError) {
      console.error('[change-request-actions] archive insert error:', insertError);
      return;
    }

    const idsToDelete = toArchive.map((r) => r.id);
    await adminDb.from('change_requests').delete().in('id', idsToDelete);
  } catch (err) {
    console.error('[change-request-actions] archiveOldProcessedRequests:', err);
  }
}

/**
 * Récupère l'historique archivé des demandes traitées (lecture pour tous).
 */
export async function getChangeRequestsHistory(limit = 50) {
  const adminDb = createAdminClient();
  const { data } = await adminDb
    .from('change_requests_history')
    .select('*')
    .order('archived_at', { ascending: false })
    .limit(limit);
  return data || [];
}

/**
 * Récupère les demandes de la semaine (bypasse RLS pour synchro parfaite émetteur/destinataire).
 */
export async function getChangeRequestsForWeek(weekKey: string) {
  try {
    const adminDb = createAdminClient();
    const { data } = await adminDb
      .from('change_requests')
      .select('*')
      .eq('week_key', weekKey)
      .order('created_at', { ascending: false });
    return data || [];
  } catch (err) {
    console.error('[change-request-actions] getChangeRequestsForWeek error:', err);
    return [];
  }
}

/**
 * Applique une demande de changement approuvée
 */
export async function applyChangeRequest(requestId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Non authentifié' };
  }

  const adminDb = createAdminClient();
  const { data: profile } = await adminDb
    .from('profiles')
    .select('role, doctor_code')
    .eq('id', user.id)
    .single();

  const profileRole = profile?.role?.toLowerCase() || '';
  const doctorCode = profile?.doctor_code?.toUpperCase() || '';
  const userEmail = user.email?.toLowerCase() || '';

  const isAdmin = profileRole === 'admin' || 
                  profileRole === 'administrateur' ||
                  userEmail.includes('admin') || 
                  ['M', 'Z', 'L'].includes(doctorCode) ||
                  userEmail.includes('lucie') ||
                  userEmail.includes('ouissem');

  const { data: request, error: fetchError } = await adminDb
    .from('change_requests')
    .select('*')
    .eq('id', requestId)
    .eq('status', 'pending')
    .maybeSingle();

  if (fetchError || !request) {
    return { success: false, error: 'Demande introuvable ou déjà traitée' };
  }

  const isAllowed = isAdmin || 
                    request.requester_id === user.id ||
                    (doctorCode && request.requested_doctor?.toUpperCase() === doctorCode) ||
                    (doctorCode && request.current_doctor?.toUpperCase() === doctorCode);

  if (!isAllowed) {
    return {
      success: false,
      error: `Droits insuffisants pour approuver cette demande`,
    };
  }

  const { data: currentSchedule, error: scheduleError } = await adminDb
    .from('schedules')
    .select('schedule_data')
    .eq('week_key', request.week_key)
    .maybeSingle();

  if (scheduleError) {
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

  try {
    const updatedBy =
      profile?.doctor_code || user.email?.split('@')[0]?.toUpperCase() || 'admin';
    await saveScheduleToDb(request.week_key, scheduleData, updatedBy, {
      source: 'change_request',
    });
  } catch {
    return { success: false, error: 'Erreur lors de la mise à jour du planning' };
  }

  // Supporte à la fois 'validated' et 'approved' selon la contrainte CHECK PostgreSQL
  let { error: updateError } = await adminDb
    .from('change_requests')
    .update({
      status: 'validated',
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  if (updateError) {
    const fallbackRes = await adminDb
      .from('change_requests')
      .update({
        status: 'approved',
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);
    updateError = fallbackRes.error;
  }

  if (updateError) {
    console.error('[change-request-actions] update status error:', updateError);
    return { success: false, error: `Erreur lors de la mise à jour du statut: ${updateError.message}` };
  }

  await archiveOldProcessedRequests();

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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Non authentifié' };
  }

  const adminDb = createAdminClient();
  const { data: profile } = await adminDb
    .from('profiles')
    .select('role, doctor_code')
    .eq('id', user.id)
    .single();

  const profileRole = profile?.role?.toLowerCase() || '';
  const doctorCode = profile?.doctor_code?.toUpperCase() || '';
  const userEmail = user.email?.toLowerCase() || '';

  const isAdmin = profileRole === 'admin' || 
                  profileRole === 'administrateur' ||
                  userEmail.includes('admin') || 
                  ['M', 'Z', 'L'].includes(doctorCode) ||
                  userEmail.includes('lucie') ||
                  userEmail.includes('ouissem');

  const { data: request, error: fetchError } = await adminDb
    .from('change_requests')
    .select('*')
    .eq('id', requestId)
    .eq('status', 'pending')
    .maybeSingle();

  if (fetchError || !request) {
    return { success: false, error: 'Demande introuvable ou déjà traitée' };
  }

  const isAllowed = isAdmin || 
                    request.requester_id === user.id ||
                    (doctorCode && request.requested_doctor?.toUpperCase() === doctorCode) ||
                    (doctorCode && request.current_doctor?.toUpperCase() === doctorCode);

  if (!isAllowed) {
    return {
      success: false,
      error: `Droits insuffisants pour rejeter cette demande`,
    };
  }

  const { error: updateError } = await adminDb
    .from('change_requests')
    .update({
      status: 'rejected',
      admin_comment: comment || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  if (updateError) {
    console.error('[change-request-actions] reject status error:', updateError);
    return { success: false, error: `Erreur lors de la mise à jour du statut: ${updateError.message}` };
  }

  revalidatePath('/protected/planning');
  revalidatePath('/protected/admin/requests');

  return { success: true, message: 'Demande rejetée' };
}

/**
 * Supprime une demande / message de la boîte de messagerie
 */
export async function deleteChangeRequest(requestId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Non authentifié' };
  }

  const adminDb = createAdminClient();
  const { data: profile } = await adminDb
    .from('profiles')
    .select('role, doctor_code')
    .eq('id', user.id)
    .single();

  const profileRole = profile?.role?.toLowerCase() || '';
  const doctorCode = profile?.doctor_code?.toUpperCase() || '';
  const userEmail = user.email?.toLowerCase() || '';

  const isAdmin = profileRole === 'admin' || 
                  profileRole === 'administrateur' ||
                  userEmail.includes('admin') || 
                  ['M', 'Z', 'L'].includes(doctorCode) ||
                  userEmail.includes('lucie') ||
                  userEmail.includes('ouissem');

  const { data: request } = await adminDb
    .from('change_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle();

  if (!request) {
    return { success: false, error: 'Demande introuvable' };
  }

  const isAllowed = isAdmin || 
                    request.requester_id === user.id ||
                    (doctorCode && request.requested_doctor?.toUpperCase() === doctorCode) ||
                    (doctorCode && request.current_doctor?.toUpperCase() === doctorCode);

  if (!isAllowed) {
    return { success: false, error: 'Vous n’avez pas les droits pour supprimer cette demande' };
  }

  const { error } = await adminDb
    .from('change_requests')
    .delete()
    .eq('id', requestId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/protected/planning');
  revalidatePath('/protected/admin/requests');

  return { success: true, message: 'Message supprimé avec succès' };
}
