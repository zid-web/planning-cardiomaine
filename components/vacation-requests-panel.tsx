"use client"

import { useState } from "react"
import { Calendar, Check, X, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatPersonLabel } from "@/lib/doctor-code"
import type { VacationRequest } from "@/app/actions/vacation-request-actions"

function formatDateFr(dateStr: string): string {
  try {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  } catch {
    return dateStr
  }
}

function StatusBadge({ status }: { status: VacationRequest["status"] }) {
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
        <Check className="size-3" /> Validé
      </span>
    )
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
        <X className="size-3" /> Refusé
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
      En attente
    </span>
  )
}

export function VacationRequestsPanel({
  isAdmin,
  myRequests,
  allRequests,
  onSubmit,
  onCancel,
  onDecide,
}: {
  isAdmin: boolean
  myRequests: VacationRequest[]
  allRequests: VacationRequest[]
  onSubmit: (startDate: string, endDate: string, reason: string) => Promise<void>
  onCancel: (id: string) => Promise<void>
  onDecide: (id: string, decision: "approved" | "rejected") => Promise<void>
}) {
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [decidingId, setDecidingId] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!startDate || !endDate || submitting) return
    setSubmitting(true)
    try {
      await onSubmit(startDate, endDate, reason)
      setStartDate("")
      setEndDate("")
      setReason("")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDecide = async (id: string, decision: "approved" | "rejected") => {
    setDecidingId(id)
    try {
      await onDecide(id, decision)
    } finally {
      setDecidingId(null)
    }
  }

  if (isAdmin) {
    const pending = allRequests.filter((r) => r.status === "pending")
    const decided = allRequests.filter((r) => r.status !== "pending")

    return (
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            Demandes en attente
          </p>
          {pending.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Aucune demande en attente.</p>
          ) : (
            <div className="space-y-2">
              {pending.map((r) => (
                <div key={r.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-extrabold text-slate-900">{formatPersonLabel(r.doctor_code)}</span>
                    <span className="text-slate-500">
                      {new Date(r.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                    </span>
                  </div>
                  <p className="mb-2 flex items-center gap-1.5 font-medium text-slate-700">
                    <Calendar className="size-3.5 shrink-0" />
                    {formatDateFr(r.start_date)} → {formatDateFr(r.end_date)}
                  </p>
                  {r.reason && <p className="mb-2 italic text-slate-600">« {r.reason} »</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={decidingId === r.id}
                      onClick={() => void handleDecide(r.id, "approved")}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {decidingId === r.id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                      Valider
                    </button>
                    <button
                      type="button"
                      disabled={decidingId === r.id}
                      onClick={() => void handleDecide(r.id, "rejected")}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-slate-200 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-300 disabled:opacity-50"
                    >
                      <X className="size-3.5" />
                      Refuser
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {decided.length > 0 && (
          <div className="border-t border-slate-200 pt-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Historique</p>
            <div className="max-h-[200px] space-y-1.5 overflow-y-auto pr-1">
              {decided.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
                  <span className="font-semibold text-slate-700">
                    {formatPersonLabel(r.doctor_code)} · {formatDateFr(r.start_date)} → {formatDateFr(r.end_date)}
                  </span>
                  <StatusBadge status={r.status} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          Demander des dates de congé
        </p>
        <div className="space-y-2 rounded-lg border border-slate-200 p-3">
          <div className="flex gap-2">
            <label className="flex-1 text-xs">
              <span className="mb-1 block font-medium text-slate-600">Du</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="flex-1 text-xs">
              <span className="mb-1 block font-medium text-slate-600">Au</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || undefined}
                className="w-full rounded-lg border p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>
          <textarea
            placeholder="Motif (optionnel)…"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full resize-none rounded-lg border p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            disabled={!startDate || !endDate || submitting}
            onClick={() => void handleSubmit()}
            className="w-full rounded-lg bg-blue-600 py-2 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitting ? "Envoi…" : "Envoyer la demande"}
          </button>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-3">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Mes demandes</p>
        {myRequests.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">Aucune demande envoyée pour l’instant.</p>
        ) : (
          <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
            {myRequests.map((r) => (
              <div key={r.id} className="rounded-lg border border-slate-200 p-3 text-xs">
                <div className="mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-bold text-slate-900">
                    <Calendar className="size-3.5 shrink-0" />
                    {formatDateFr(r.start_date)} → {formatDateFr(r.end_date)}
                  </span>
                  <StatusBadge status={r.status} />
                </div>
                {r.reason && <p className="italic text-slate-500">« {r.reason} »</p>}
                {r.status === "pending" && (
                  <button
                    type="button"
                    onClick={() => void onCancel(r.id)}
                    className={cn(
                      "mt-2 text-[11px] font-semibold text-red-600 underline decoration-dotted",
                      "hover:text-red-700",
                    )}
                  >
                    Annuler cette demande
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
