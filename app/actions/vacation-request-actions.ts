'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { addVacation } from '@/app/actions/vacation-actions';

export type VacationRequestStatus = 'pending' | 'approved' | 'rejected';

export type VacationRequest = {
  id: string;
  doctor_code: string;
  doctor_email: string | null;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: VacationRequestStatus;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
  decision_note: string | null;
};

/**
 * Demandes de congés médecin -> admin (rubrique "Messagerie & Demandes",
 * onglet Congés). Le médecin soumet une période ; un administrateur valide
 * ou refuse. Une validation déclenche automatiquement `addVacation` (déjà
 * utilisé partout ailleurs dans l'app), qui est ensuite pris en compte par
 * `applyStructuralConstraints` dans tout le planning — aucune autre
 * modification du moteur de planning n'est nécessaire ici.
 */

async function getCallerProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

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

  return { user, doctorCode, userEmail, isAdmin };
}

function normalizeDates(startDate: string, endDate: string): { start: string; end: string } | { error: string } {
  if (!startDate || !endDate) return { error: 'Dates de début et de fin requises' };
  if (endDate < startDate) return { error: 'La date de fin doit être postérieure ou égale à la date de début' };
  return { start: startDate, end: endDate };
}

/** Soumet une nouvelle demande de congé (tout utilisateur connecté). */
export async function submitVacationRequest(
  startDate: string,
  endDate: string,
  reason?: string | null,
): Promise<{ success: boolean; error?: string }> {
  const caller = await getCallerProfile();
  if (!caller) return { success: false, error: 'Non authentifié' };
  if (!caller.doctorCode) return { success: false, error: 'Profil médecin introuvable' };

  const dates = normalizeDates(startDate, endDate);
  if ('error' in dates) return { success: false, error: dates.error };

  const adminDb = createAdminClient();
  const { error } = await adminDb.from('vacation_requests').insert({
    doctor_code: caller.doctorCode,
    doctor_email: caller.user.email,
    start_date: dates.start,
    end_date: dates.end,
    reason: reason?.trim() || null,
    status: 'pending',
  });

  if (error) return { success: false, error: error.message };

  revalidatePath('/protected/planning');
  return { success: true };
}

/** Mes propres demandes (utilisateur non-admin, historique complet). */
export async function getMyVacationRequests(): Promise<VacationRequest[]> {
  const caller = await getCallerProfile();
  if (!caller || !caller.doctorCode) return [];

  const adminDb = createAdminClient();
  const { data } = await adminDb
    .from('vacation_requests')
    .select('*')
    .eq('doctor_code', caller.doctorCode)
    .order('created_at', { ascending: false });

  return (data as VacationRequest[]) || [];
}

/** Toutes les demandes, tous médecins confondus (admin uniquement). */
export async function getAllVacationRequests(): Promise<VacationRequest[]> {
  const caller = await getCallerProfile();
  if (!caller || !caller.isAdmin) return [];

  const adminDb = createAdminClient();
  const { data } = await adminDb
    .from('vacation_requests')
    .select('*')
    .order('created_at', { ascending: false });

  return (data as VacationRequest[]) || [];
}

/**
 * Valide ou refuse une demande (admin uniquement). En cas de validation,
 * ajoute automatiquement le congé via `addVacation` (mêmes règles que si
 * l'admin l'avait saisi lui-même dans la fenêtre Congés existante).
 */
export async function decideVacationRequest(
  id: string,
  decision: 'approved' | 'rejected',
  decisionNote?: string | null,
): Promise<{ success: boolean; error?: string }> {
  const caller = await getCallerProfile();
  if (!caller || !caller.isAdmin) return { success: false, error: 'Droits administrateur requis' };

  const adminDb = createAdminClient();
  const { data: existing, error: fetchError } = await adminDb
    .from('vacation_requests')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !existing) return { success: false, error: 'Demande introuvable' };
  if (existing.status !== 'pending') return { success: false, error: 'Cette demande a déjà été traitée' };

  if (decision === 'approved') {
    const result = await addVacation(
      existing.doctor_code,
      existing.start_date,
      existing.end_date,
      existing.reason,
    );
    if (!result.success) {
      return { success: false, error: result.error || "Échec de l'ajout du congé" };
    }
  }

  const { error } = await adminDb
    .from('vacation_requests')
    .update({
      status: decision,
      decided_at: new Date().toISOString(),
      decided_by: caller.doctorCode || caller.userEmail,
      decision_note: decisionNote?.trim() || null,
    })
    .eq('id', id);

  if (error) return { success: false, error: error.message };

  revalidatePath('/protected/planning');
  return { success: true };
}

/** Supprime une demande (l'auteur, uniquement si encore en attente). */
export async function cancelVacationRequest(id: string): Promise<{ success: boolean; error?: string }> {
  const caller = await getCallerProfile();
  if (!caller || !caller.doctorCode) return { success: false, error: 'Non authentifié' };

  const adminDb = createAdminClient();
  const { data: existing } = await adminDb
    .from('vacation_requests')
    .select('doctor_code, status')
    .eq('id', id)
    .maybeSingle();

  if (!existing || existing.doctor_code !== caller.doctorCode) {
    return { success: false, error: 'Droits insuffisants' };
  }
  if (existing.status !== 'pending') {
    return { success: false, error: 'Impossible d’annuler une demande déjà traitée' };
  }

  const { error } = await adminDb.from('vacation_requests').delete().eq('id', id);
  if (error) return { success: false, error: error.message };

  revalidatePath('/protected/planning');
  return { success: true };
}
