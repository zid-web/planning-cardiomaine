'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDownUp, Bell, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { applyChangeRequest, rejectChangeRequest } from '@/app/actions/change-request-actions';
import { DOCTORS } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

const PAGE_SIZE = 20;

type RequestStatus = 'pending' | 'approved' | 'rejected';
type StatusFilter = 'all' | RequestStatus;

type ChangeRequestRow = {
  id: string;
  requester_id: string | null;
  week_key: string;
  day_name: string;
  row_key: string;
  slot: string | null;
  current_doctor: string | null;
  requested_doctor: string;
  reason: string | null;
  status: RequestStatus;
  admin_comment: string | null;
  created_at: string;
  updated_at: string;
  profiles?: { email?: string | null } | null;
};

type RequesterOption = {
  id: string;
  email: string;
};

/** Attache `profiles.email` sans embed PostgREST (évite 400 si FK absente en prod). */
async function withRequesterEmails(
  supabase: ReturnType<typeof createClient>,
  rows: ChangeRequestRow[],
): Promise<ChangeRequestRow[]> {
  const ids = Array.from(
    new Set(rows.map((r) => r.requester_id).filter((id): id is string => Boolean(id))),
  );
  if (ids.length === 0) return rows.map((r) => ({ ...r, profiles: r.profiles ?? null }));

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email')
    .in('id', ids);

  if (error) {
    console.warn('[admin/requests] profiles lookup', error);
    return rows.map((r) => ({ ...r, profiles: r.profiles ?? null }));
  }

  const emailById = new Map<string, string>();
  for (const p of profiles || []) {
    if (p.id && p.email) emailById.set(p.id, p.email);
  }

  return rows.map((r) => ({
    ...r,
    profiles: r.requester_id
      ? { email: emailById.get(r.requester_id) || r.profiles?.email || null }
      : null,
  }));
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncate(text: string | null | undefined, max = 48) {
  if (!text) return '—';
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function StatusBadge({ status }: { status: RequestStatus }) {
  if (status === 'pending') {
    return (
      <Badge className="border-transparent bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
        En attente
      </Badge>
    );
  }
  if (status === 'approved') {
    return (
      <Badge className="border-transparent bg-green-100 text-green-800 hover:bg-green-100">
        Approuvée
      </Badge>
    );
  }
  return (
    <Badge className="border-transparent bg-red-100 text-red-800 hover:bg-red-100">
      Refusée
    </Badge>
  );
}

export default function AdminRequestsPage() {
  // Stable browser client (avoids resubscribing Realtime on every render)
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [requests, setRequests] = useState<ChangeRequestRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [requesters, setRequesters] = useState<RequesterOption[]>([]);
  const [newRequestsCount, setNewRequestsCount] = useState(0);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(() => new Set());
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'live' | 'error'>(
    'connecting',
  );

  const loadRequestsRef = useRef<() => Promise<void>>(async () => {});
  const loadRequestersRef = useRef<() => Promise<void>>(async () => {});

  // Filters
  const [status, setStatus] = useState<StatusFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [requesterId, setRequesterId] = useState<string>('all');
  const [doctor, setDoctor] = useState<string>('all');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);

  // Detail modal
  const [selected, setSelected] = useState<ChangeRequestRow | null>(null);
  const [related, setRelated] = useState<ChangeRequestRow[]>([]);
  const [adminComment, setAdminComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const loadRequesters = useCallback(async () => {
    const { data, error } = await supabase
      .from('change_requests')
      .select('requester_id')
      .not('requester_id', 'is', null);

    if (error) {
      console.error('[admin/requests] requesters', error);
      return;
    }

    const ids = Array.from(
      new Set(
        (data || [])
          .map((row) => row.requester_id as string | null)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    if (ids.length === 0) {
      setRequesters([]);
      return;
    }

    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', ids);

    if (pErr) {
      console.error('[admin/requests] requesters profiles', pErr);
      setRequesters(ids.map((id) => ({ id, email: id.slice(0, 8) })));
      return;
    }

    setRequesters(
      (profiles || [])
        .filter((p) => p.id && p.email)
        .map((p) => ({ id: p.id as string, email: p.email as string }))
        .sort((a, b) => a.email.localeCompare(b.email, 'fr')),
    );
  }, [supabase]);

  const loadRequests = useCallback(async () => {
    setTableLoading(true);
    try {
      let query = supabase
        .from('change_requests')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: sortAsc })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (status !== 'all') query = query.eq('status', status);
      if (requesterId !== 'all') query = query.eq('requester_id', requesterId);
      if (doctor !== 'all') query = query.eq('requested_doctor', doctor);
      if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`);
      if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59.999`);

      const { data, error, count } = await query;
      if (error) {
        console.error('[admin/requests] load', error);
        toast.error(
          error.message?.includes('relationship')
            ? 'Erreur schéma demandes (relation profiles) — recharger après déploiement'
            : 'Erreur de chargement des demandes',
        );
        setRequests([]);
        setTotalCount(0);
        return;
      }

      const withEmails = await withRequesterEmails(
        supabase,
        (data as ChangeRequestRow[]) || [],
      );
      setRequests(withEmails);
      setTotalCount(count ?? 0);
    } finally {
      setTableLoading(false);
      setLoading(false);
    }
  }, [supabase, page, status, requesterId, doctor, dateFrom, dateTo, sortAsc]);

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/auth/login');
        return;
      }

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
      await loadRequesters();
    };
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!authorized) return;
    void loadRequests();
  }, [authorized, loadRequests]);

  // Keep stable refs for the realtime callback (avoids resubscribing on every filter change)
  useEffect(() => {
    loadRequestsRef.current = loadRequests;
    loadRequestersRef.current = loadRequesters;
  }, [loadRequests, loadRequesters]);

  const openDetail = useCallback(
    async (req: ChangeRequestRow) => {
      setSelected(req);
      setAdminComment(req.admin_comment || '');
      const { data } = await supabase
        .from('change_requests')
        .select('*')
        .eq('week_key', req.week_key)
        .eq('day_name', req.day_name)
        .eq('row_key', req.row_key)
        .order('created_at', { ascending: false })
        .limit(10);
      const relatedRows = await withRequesterEmails(
        supabase,
        ((data as ChangeRequestRow[]) || []).filter((r) => r.id !== req.id),
      );
      setRelated(relatedRows);
    },
    [supabase],
  );

  // Live notifications: INSERT on change_requests
  useEffect(() => {
    if (!authorized) return;

    const channel = supabase
      .channel('admin-change-requests')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'change_requests',
        },
        async (payload: { new: ChangeRequestRow }) => {
          const row = payload.new;
          if (!row?.id) return;

          setNewRequestsCount((c) => c + 1);
          setHighlightedIds((prev) => {
            const next = new Set(prev);
            next.add(row.id);
            return next;
          });
          // Auto-clear highlight after 60s
          window.setTimeout(() => {
            setHighlightedIds((prev) => {
              if (!prev.has(row.id)) return prev;
              const next = new Set(prev);
              next.delete(row.id);
              return next;
            });
          }, 60_000);

          let email = 'un utilisateur';
          if (row.requester_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('email')
              .eq('id', row.requester_id)
              .maybeSingle();
            if (profile?.email) email = profile.email;
          }

          toast.info(`Nouvelle demande de ${email}`, {
            description: `${row.day_name} – ${row.row_key} → ${row.requested_doctor}`,
            action: {
              label: 'Voir',
              onClick: () => {
                setNewRequestsCount(0);
                void (async () => {
                  const { data } = await supabase
                    .from('change_requests')
                    .select('*')
                    .eq('id', row.id)
                    .maybeSingle();
                  if (data) {
                    const [enriched] = await withRequesterEmails(supabase, [
                      data as ChangeRequestRow,
                    ]);
                    await openDetail(enriched);
                    window.setTimeout(() => {
                      document
                        .getElementById(`request-${row.id}`)
                        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 100);
                  }
                })();
              },
            },
            duration: 5000,
          });

          // Refresh list (respects current filters/page) + requester dropdown
          await loadRequestsRef.current();
          await loadRequestersRef.current();
        },
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('live');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeStatus('error');
          console.error('[admin/requests] realtime status:', status);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [authorized, supabase, openDetail]);

  const resetNewRequestsCount = () => {
    setNewRequestsCount(0);
    setHighlightedIds(new Set());
  };

  const setStatusAndReset = (value: StatusFilter) => {
    setPage(1);
    setStatus(value);
  };
  const setRequesterAndReset = (value: string) => {
    setPage(1);
    setRequesterId(value);
  };
  const setDoctorAndReset = (value: string) => {
    setPage(1);
    setDoctor(value);
  };
  const setDateFromAndReset = (value: string) => {
    setPage(1);
    setDateFrom(value);
  };
  const setDateToAndReset = (value: string) => {
    setPage(1);
    setDateTo(value);
  };
  const toggleSortAndReset = () => {
    setPage(1);
    setSortAsc((v) => !v);
  };

  const handleApprove = async (id: string) => {
    setActionLoading(true);
    try {
      const result = await applyChangeRequest(id);
      if (result.success) {
        toast.success(result.message);
        setSelected(null);
        await loadRequests();
        await loadRequesters();
      } else {
        toast.error(result.error);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoading(true);
    try {
      const result = await rejectChangeRequest(id, adminComment.trim() || undefined);
      if (result.success) {
        toast.success(result.message);
        setSelected(null);
        await loadRequests();
        await loadRequesters();
      } else {
        toast.error(result.error);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const clearFilters = () => {
    setStatus('all');
    setDateFrom('');
    setDateTo('');
    setRequesterId('all');
    setDoctor('all');
    setSortAsc(false);
    setPage(1);
  };

  const pageNumbers = useMemo(() => {
    const maxButtons = 5;
    if (totalPages <= maxButtons) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const start = Math.max(1, Math.min(page - 2, totalPages - maxButtons + 1));
    return Array.from({ length: maxButtons }, (_, i) => start + i);
  }, [page, totalPages]);

  const rangeLabel = useMemo(() => {
    if (totalCount === 0) return '0 résultat';
    const from = (page - 1) * PAGE_SIZE + 1;
    const to = Math.min(page * PAGE_SIZE, totalCount);
    return `${from}–${to} sur ${totalCount}`;
  }, [page, totalCount]);

  if (loading) return <div className="p-6">Chargement...</div>;
  if (!authorized) return null;

  return (
    // Root layout = overflow-hidden : scroller ici sinon la liste est tronquée.
    <div className="h-full overflow-y-auto overscroll-y-contain bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-4 p-4 pb-20 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Demandes de changement</h1>
            <p className="text-sm text-slate-500">
              Historique complet, filtres cumulables et pagination ({PAGE_SIZE}/page).
              {realtimeStatus === 'live' && (
                <span className="ml-2 inline-flex items-center gap-1 text-emerald-600">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                  Temps réel
                </span>
              )}
              {realtimeStatus === 'error' && (
                <span className="ml-2 text-amber-600">Temps réel indisponible</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetNewRequestsCount}
              className="relative rounded-full p-2 text-slate-600 transition-colors hover:bg-white hover:text-slate-900"
              title={
                newRequestsCount > 0
                  ? `${newRequestsCount} nouvelle(s) demande(s)`
                  : 'Aucune nouvelle demande'
              }
              aria-label="Notifications des nouvelles demandes"
            >
              <Bell className="h-5 w-5" />
              {newRequestsCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white animate-pulse">
                  {newRequestsCount > 99 ? '99+' : newRequestsCount}
                </span>
              )}
            </button>
            <Button variant="outline" onClick={() => router.push('/protected/planning')}>
              Retour au planning
            </Button>
          </div>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Search className="h-4 w-4" />
              Filtres
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1.5">
                <Label>Statut</Label>
                <Select value={status} onValueChange={(v) => setStatusAndReset(v as StatusFilter)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="pending">En attente</SelectItem>
                    <SelectItem value="approved">Approuvées</SelectItem>
                    <SelectItem value="rejected">Refusées</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Du</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFromAndReset(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Au</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateToAndReset(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Demandeur</Label>
                <Select value={requesterId} onValueChange={setRequesterAndReset}>
                  <SelectTrigger>
                    <SelectValue placeholder="Demandeur" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    {requesters.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Médecin demandé</Label>
                <Select value={doctor} onValueChange={setDoctorAndReset}>
                  <SelectTrigger>
                    <SelectValue placeholder="Médecin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    {DOCTORS.map((code) => (
                      <SelectItem key={code} value={code}>
                        {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={toggleSortAndReset}
              >
                <ArrowDownUp className="mr-1 h-4 w-4" />
                Date {sortAsc ? '↑ ancienne → récente' : '↓ récente → ancienne'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-1 h-4 w-4" />
                Réinitialiser
              </Button>
              <span className="ml-auto text-sm text-slate-500">{rangeLabel}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Demandeur</TableHead>
                  <TableHead>Case</TableHead>
                  <TableHead>Changement</TableHead>
                  <TableHead className="hidden md:table-cell">Raison</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-slate-500">
                      Chargement…
                    </TableCell>
                  </TableRow>
                )}
                {!tableLoading && requests.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-slate-500">
                      Aucune demande ne correspond aux filtres.
                    </TableCell>
                  </TableRow>
                )}
                {!tableLoading &&
                  requests.map((req) => (
                    <TableRow
                      key={req.id}
                      id={`request-${req.id}`}
                      className={`cursor-pointer transition-colors duration-500 ${
                        highlightedIds.has(req.id)
                          ? 'bg-blue-50/80 hover:bg-blue-50'
                          : ''
                      }`}
                      onClick={() => void openDetail(req)}
                    >
                      <TableCell className="whitespace-nowrap text-xs md:text-sm">
                        {formatDateTime(req.created_at)}
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate text-sm">
                        {req.profiles?.email || 'Inconnu'}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">
                          {req.day_name} – {req.row_key}
                        </div>
                        <div className="text-xs text-slate-400">{req.week_key}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="text-slate-500">{req.current_doctor || 'vide'}</span>
                        {' → '}
                        <span className="font-semibold text-blue-700">{req.requested_doctor}</span>
                      </TableCell>
                      <TableCell className="hidden max-w-[200px] truncate text-sm text-slate-500 md:table-cell">
                        {truncate(req.reason)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={req.status} />
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        {req.status === 'pending' ? (
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              disabled={actionLoading}
                              onClick={() => void handleApprove(req.id)}
                            >
                              Accepter
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={actionLoading}
                              onClick={() => void openDetail(req)}
                            >
                              Refuser
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => void openDetail(req)}>
                            Détails
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-center gap-2 pb-8">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || tableLoading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Précédent
          </Button>
          {pageNumbers.map((n) => (
            <Button
              key={n}
              size="sm"
              variant={n === page ? 'default' : 'outline'}
              disabled={tableLoading}
              onClick={() => setPage(n)}
            >
              {n}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || tableLoading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Suivant
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>Détail de la demande</DialogTitle>
                <DialogDescription>
                  {selected.day_name} – {selected.row_key} ({selected.week_key})
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">Statut</span>
                  <StatusBadge status={selected.status} />
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Demandeur</span>
                  <span className="font-medium">{selected.profiles?.email || 'Inconnu'}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Créée le</span>
                  <span>{formatDateTime(selected.created_at)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Mise à jour</span>
                  <span>{formatDateTime(selected.updated_at)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Changement</span>
                  <span>
                    {selected.current_doctor || 'vide'} →{' '}
                    <strong>{selected.requested_doctor}</strong>
                  </span>
                </div>
                {selected.slot && (
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Créneau</span>
                    <span>{selected.slot}</span>
                  </div>
                )}
                <div>
                  <div className="mb-1 text-slate-500">Raison</div>
                  <p className="rounded-md bg-slate-50 p-2 text-slate-700">
                    {selected.reason || '—'}
                  </p>
                </div>
                {selected.admin_comment && selected.status !== 'pending' && (
                  <div>
                    <div className="mb-1 text-slate-500">Commentaire admin</div>
                    <p className="rounded-md bg-slate-50 p-2 text-slate-700">
                      {selected.admin_comment}
                    </p>
                  </div>
                )}

                {selected.status === 'pending' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="admin-comment">Commentaire (refus)</Label>
                    <Textarea
                      id="admin-comment"
                      value={adminComment}
                      onChange={(e) => setAdminComment(e.target.value)}
                      placeholder="Optionnel — visible dans l’historique"
                      rows={3}
                    />
                  </div>
                )}

                {related.length > 0 && (
                  <div>
                    <div className="mb-2 font-medium text-slate-700">
                      Autres demandes sur cette case
                    </div>
                    <ul className="space-y-2">
                      {related.map((r) => (
                        <li
                          key={r.id}
                          className="rounded-md border bg-white p-2 text-xs text-slate-600"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span>{formatDateTime(r.created_at)}</span>
                            <StatusBadge status={r.status} />
                          </div>
                          <div>
                            {r.current_doctor || 'vide'} → {r.requested_doctor}
                            {r.profiles?.email ? ` · ${r.profiles.email}` : ''}
                          </div>
                          {r.admin_comment && (
                            <div className="mt-1 italic text-slate-500">« {r.admin_comment} »</div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Fermer
                </Button>
                {selected.status === 'pending' && (
                  <>
                    <Button
                      variant="destructive"
                      disabled={actionLoading}
                      onClick={() => void handleReject(selected.id)}
                    >
                      Refuser
                    </Button>
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      disabled={actionLoading}
                      onClick={() => void handleApprove(selected.id)}
                    >
                      Accepter
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
