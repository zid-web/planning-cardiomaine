'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * « Boîte de réception » de l'administrateur : nombre d'éléments à traiter,
 * tous médecins et toutes semaines confondus — fonctionne comme une boîte mail,
 * sans ouvrir la messagerie.
 *
 * - `vacationPending` : demandes de congés en attente (visibles par tous les admins) ;
 * - `messagesUnread` : messages privés non lus qui me sont adressés ;
 * - `changePending` : demandes de changement de planning en attente.
 *
 * Réservé aux administrateurs (rôle `admin` du profil) ; `null` pour les autres.
 */
export type AdminInboxCounts = {
  vacationPending: number;
  messagesUnread: number;
  changePending: number;
};

export async function getAdminInboxCounts(): Promise<AdminInboxCounts | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const adminDb = createAdminClient();
    const { data: profile } = await adminDb
      .from('profiles')
      .select('role, doctor_code')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') return null;
    const doctorCode = profile.doctor_code?.toUpperCase() || '';

    const count = async (
      query: PromiseLike<{ count: number | null; error: unknown }>,
    ): Promise<number> => {
      const { count: n, error } = await query;
      return error ? 0 : n ?? 0;
    };

    const [vacationPending, messagesUnread, changePending] = await Promise.all([
      count(
        adminDb.from('vacation_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ),
      doctorCode
        ? count(
            adminDb
              .from('doctor_messages')
              .select('id', { count: 'exact', head: true })
              .eq('target_admin_code', doctorCode)
              .is('read_at', null),
          )
        : Promise.resolve(0),
      count(
        adminDb.from('change_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ),
    ]);

    return { vacationPending, messagesUnread, changePending };
  } catch (error) {
    console.warn('[getAdminInboxCounts]', error);
    return null;
  }
}
