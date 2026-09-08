'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { ADMIN_RECIPIENT_CODES, type AdminRecipientCode } from '@/lib/admin-recipients';

export type DoctorMessage = {
  id: string;
  sender_doctor_code: string;
  sender_email: string | null;
  message_text: string;
  target_admin_code: string | null;
  created_at: string;
  read_at: string | null;
  read_by: string | null;
};

/**
 * Messages médecin -> admin, ciblés (rubrique "Note privée pour vous" /
 * "Messagerie & Demandes") : symétrique des notes privées admin -> médecin.
 * Chaque message est adressé à UN administrateur précis (M, Z ou L) et n'est
 * visible que par son auteur et ce destinataire — pas par les autres admins.
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

/** Envoie un nouveau message privé à un administrateur précis (M, Z ou L). */
export async function sendDoctorMessage(
  messageText: string,
  targetAdminCode: string,
): Promise<{ success: boolean; error?: string }> {
  const caller = await getCallerProfile();
  if (!caller) return { success: false, error: 'Non authentifié' };

  const text = messageText.trim();
  if (!text) return { success: false, error: 'Message vide' };

  const target = targetAdminCode.trim().toUpperCase();
  if (!ADMIN_RECIPIENT_CODES.includes(target as AdminRecipientCode)) {
    return { success: false, error: 'Destinataire invalide (choisir M, Z ou L)' };
  }

  const senderCode = caller.doctorCode || caller.userEmail.split('@')[0]?.toUpperCase() || 'INCONNU';

  const adminDb = createAdminClient();
  const { error } = await adminDb.from('doctor_messages').insert({
    sender_doctor_code: senderCode,
    sender_email: caller.user.email,
    message_text: text,
    target_admin_code: target,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath('/protected/planning');
  return { success: true };
}

/** Mes propres messages envoyés (utilisateur non-admin, sa propre discussion, tous destinataires confondus). */
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

/** Messages reçus PAR MOI en tant qu'administrateur (privé : uniquement ceux qui me sont adressés). */
export async function getMyReceivedDoctorMessages(): Promise<DoctorMessage[]> {
  const caller = await getCallerProfile();
  if (!caller || !caller.isAdmin || !caller.doctorCode) return [];

  const adminDb = createAdminClient();
  const { data } = await adminDb
    .from('doctor_messages')
    .select('*')
    .eq('target_admin_code', caller.doctorCode)
    .order('created_at', { ascending: false });

  return (data as DoctorMessage[]) || [];
}

/** Marque comme lus les messages qui me sont adressés (admin uniquement) — appelé à l'ouverture de l'onglet. */
export async function markDoctorMessagesRead(): Promise<{ success: boolean }> {
  const caller = await getCallerProfile();
  if (!caller || !caller.isAdmin || !caller.doctorCode) return { success: false };

  const adminDb = createAdminClient();
  await adminDb
    .from('doctor_messages')
    .update({ read_at: new Date().toISOString(), read_by: caller.doctorCode })
    .eq('target_admin_code', caller.doctorCode)
    .is('read_at', null);

  return { success: true };
}

/** Supprime un message (l'administrateur destinataire, ou l'auteur du message lui-même). */
export async function deleteDoctorMessage(id: string): Promise<{ success: boolean; error?: string }> {
  const caller = await getCallerProfile();
  if (!caller) return { success: false, error: 'Non authentifié' };

  const adminDb = createAdminClient();
  const { data: existing } = await adminDb
    .from('doctor_messages')
    .select('sender_doctor_code, target_admin_code')
    .eq('id', id)
    .maybeSingle();

  const isOwn = Boolean(caller.doctorCode && existing?.sender_doctor_code === caller.doctorCode);
  const isRecipient = Boolean(
    caller.isAdmin && caller.doctorCode && existing?.target_admin_code === caller.doctorCode,
  );
  if (!isOwn && !isRecipient) {
    return { success: false, error: 'Droits insuffisants pour supprimer ce message' };
  }

  const { error } = await adminDb.from('doctor_messages').delete().eq('id', id);
  if (error) return { success: false, error: error.message };

  revalidatePath('/protected/planning');
  return { success: true };
}
