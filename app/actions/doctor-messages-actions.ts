'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export type DoctorMessage = {
  id: string;
  sender_doctor_code: string;
  sender_email: string | null;
  message_text: string;
  created_at: string;
  read_at: string | null;
  read_by: string | null;
};

/**
 * Messages médecin -> admin (rubrique "Messagerie & Demandes", onglet
 * Messages) : sens inverse des notes privées admin -> médecin. Tout
 * utilisateur authentifié (admin ou non) peut envoyer un message ; seuls les
 * administrateurs (M, Z, Lucie) peuvent voir l'ensemble des messages reçus.
 * Discussion (plusieurs messages successifs), pas une note unique remplacée.
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

/** Envoie un nouveau message vers les administrateurs (tout utilisateur connecté). */
export async function sendDoctorMessage(messageText: string): Promise<{ success: boolean; error?: string }> {
  const caller = await getCallerProfile();
  if (!caller) return { success: false, error: 'Non authentifié' };

  const text = messageText.trim();
  if (!text) return { success: false, error: 'Message vide' };

  const senderCode = caller.doctorCode || caller.userEmail.split('@')[0]?.toUpperCase() || 'INCONNU';

  const adminDb = createAdminClient();
  const { error } = await adminDb.from('doctor_messages').insert({
    sender_doctor_code: senderCode,
    sender_email: caller.user.email,
    message_text: text,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath('/protected/planning');
  return { success: true };
}

/** Mes propres messages envoyés (utilisateur non-admin, sa propre discussion). */
export async function getMyDoctorMessages(): Promise<DoctorMessage[]> {
  const caller = await getCallerProfile();
  if (!caller || !caller.doctorCode) return [];

  const adminDb = createAdminClient();
  const { data } = await adminDb
    .from('doctor_messages')
    .select('*')
    .eq('sender_doctor_code', caller.doctorCode)
    .order('created_at', { ascending: true });

  return (data as DoctorMessage[]) || [];
}

/** Tous les messages reçus, tous médecins confondus (admin uniquement). */
export async function getAllDoctorMessages(): Promise<DoctorMessage[]> {
  const caller = await getCallerProfile();
  if (!caller || !caller.isAdmin) return [];

  const adminDb = createAdminClient();
  const { data } = await adminDb
    .from('doctor_messages')
    .select('*')
    .order('created_at', { ascending: false });

  return (data as DoctorMessage[]) || [];
}

/** Marque comme lus tous les messages (admin uniquement) — appelé à l'ouverture de l'onglet. */
export async function markDoctorMessagesRead(): Promise<{ success: boolean }> {
  const caller = await getCallerProfile();
  if (!caller || !caller.isAdmin) return { success: false };

  const adminDb = createAdminClient();
  await adminDb
    .from('doctor_messages')
    .update({ read_at: new Date().toISOString(), read_by: caller.doctorCode || caller.userEmail })
    .is('read_at', null);

  return { success: true };
}

/** Supprime un message (admin, ou l'auteur du message lui-même). */
export async function deleteDoctorMessage(id: string): Promise<{ success: boolean; error?: string }> {
  const caller = await getCallerProfile();
  if (!caller) return { success: false, error: 'Non authentifié' };

  const adminDb = createAdminClient();
  const { data: existing } = await adminDb
    .from('doctor_messages')
    .select('sender_doctor_code')
    .eq('id', id)
    .maybeSingle();

  const isOwn = Boolean(caller.doctorCode && existing?.sender_doctor_code === caller.doctorCode);
  if (!caller.isAdmin && !isOwn) {
    return { success: false, error: 'Droits insuffisants pour supprimer ce message' };
  }

  const { error } = await adminDb.from('doctor_messages').delete().eq('id', id);
  if (error) return { success: false, error: error.message };

  revalidatePath('/protected/planning');
  return { success: true };
}
