'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function AdminRequestsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const loadRequests = async () => {
    const { data, error } = await supabase
      .from('change_requests')
      .select('*, profiles(email)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      toast.error('Erreur de chargement');
    } else {
      setRequests(data || []);
    }
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/auth/login');
        return;
      }
      // Garde admin : seuls les administrateurs accèdent à cette page
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'admin') {
        toast.error('Accès réservé aux administrateurs');
        router.replace('/protected/planning');
        return;
      }

      setAuthorized(true);
      await loadRequests();
      setLoading(false);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Applique le médecin demandé à la grille du planning (table schedules)
  const applyToSchedule = async (req: any) => {
    const { data: existing } = await supabase
      .from('schedules')
      .select('schedule_data')
      .eq('week_key', req.week_key)
      .maybeSingle();

    const scheduleData: any = existing?.schedule_data || {};
    const row = scheduleData[req.row_key] || {};
    const cell = row[req.day_name] || { value: [], type: 'empty', status: 'validated' };
    const value: string[] = cell.value?.includes(req.requested_doctor)
      ? cell.value
      : [...(cell.value || []), req.requested_doctor];

    const nextSchedule = {
      ...scheduleData,
      [req.row_key]: {
        ...row,
        [req.day_name]: { ...cell, value, type: 'doctor', status: 'validated' },
      },
    };

    const { error } = await supabase
      .from('schedules')
      .upsert(
        { week_key: req.week_key, schedule_data: nextSchedule, updated_at: new Date().toISOString() },
        { onConflict: 'week_key' },
      );
    if (error) throw error;
  };

  const handleAction = async (req: any, action: 'approved' | 'rejected', comment?: string) => {
    try {
      // À l'acceptation, on applique le changement au planning avant de marquer la demande
      if (action === 'approved') {
        await applyToSchedule(req);
      }

      const { error } = await supabase
        .from('change_requests')
        .update({ status: action, admin_comment: comment })
        .eq('id', req.id);

      if (error) throw error;

      toast.success(`Demande ${action === 'approved' ? 'acceptée' : 'refusée'}`);
      await loadRequests();
    } catch {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  if (loading) return <div className="p-6">Chargement...</div>;
  if (!authorized) return null;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">📋 Demandes de changement</h1>
      {requests.length === 0 && (
        <p className="text-gray-500">Aucune demande en attente.</p>
      )}
      {requests.map((req) => (
        <div key={req.id} className="border p-4 rounded-lg mb-3 bg-white shadow-sm">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <p className="font-semibold">{req.profiles?.email || 'Utilisateur inconnu'}</p>
              <p className="text-sm text-gray-600">
                {req.day_name} – {req.row_key}
                {req.slot && ` (${req.slot})`}
              </p>
              <p className="text-sm">
                Actuellement: <span className="font-medium">{req.current_doctor || 'vide'}</span>
                {' → '}
                Demandé: <span className="font-medium text-blue-600">{req.requested_doctor}</span>
              </p>
              {req.reason && <p className="text-sm text-gray-500 italic">"{req.reason}"</p>}
              <p className="text-xs text-gray-400 mt-1">
                Demandé le {new Date(req.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2 ml-4">
              <button
                onClick={() => handleAction(req, 'approved')}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-1 rounded text-sm transition-colors"
              >
                ✅ Accepter
              </button>
              <button
                onClick={() => handleAction(req, 'rejected')}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-1 rounded text-sm transition-colors"
              >
                ❌ Refuser
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
