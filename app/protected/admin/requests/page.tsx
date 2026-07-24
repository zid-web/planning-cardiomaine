'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { applyChangeRequest, rejectChangeRequest } from '@/app/actions/change-request-actions';

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

  // Approbation/refus via la Server Action centralisée
  const handleApprove = async (id: string) => {
    const result = await applyChangeRequest(id);
    if (result.success) {
      toast.success(result.message);
      loadRequests();
    } else {
      toast.error(result.error);
    }
  };

  const handleReject = async (id: string, comment?: string) => {
    const result = await rejectChangeRequest(id, comment);
    if (result.success) {
      toast.success(result.message);
      loadRequests();
    } else {
      toast.error(result.error);
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
                onClick={() => handleApprove(req.id)}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-1 rounded text-sm transition-colors"
              >
                ✅ Accepter
              </button>
              <button
                onClick={() => handleReject(req.id)}
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
