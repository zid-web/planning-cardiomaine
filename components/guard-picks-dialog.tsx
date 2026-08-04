"use client"

import React, { useState, useMemo, useCallback, useEffect, useTransition } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  CalendarCheck2,
  CheckCircle2,
  XCircle,
  Clock3,
  ChevronDown,
  ChevronUp,
  Loader2,
  Info,
  Trash2,
  Moon,
  Sun,
  Star,
  Shield,
  Users,
  AlertCircle,
  CheckCheck,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { DOCTOR_COLORS } from "@/lib/constants"
import {
  getSemesterGuardSlots,
  groupSlotsByMonth,
  monthLabelFromKey,
  type SemesterGuardSlot,
} from "@/lib/semester-guard-slots"
import {
  getMyGuardPicks,
  getGuardPicksForSemester,
  submitGuardPick,
  deleteGuardPick,
  approveGuardPick,
  approveBulkGuardPicks,
  rejectGuardPick,
  getVacationDatesForSemester,
  type GuardPickRow,
} from "@/app/actions/guard-picks-actions"
import { toast } from "sonner"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  isAdmin: boolean
  doctorCode: string
}

type GuardType = "Garde Matin" | "Garde Nuit"
type Semester = 1 | 2

const CURRENT_YEAR = new Date().getFullYear()

const GUARD_ICON: Record<GuardType, React.ReactNode> = {
  "Garde Matin": <Sun className="h-3.5 w-3.5 text-amber-500" />,
  "Garde Nuit": <Moon className="h-3.5 w-3.5 text-indigo-400" />,
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
}

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  approved: "Approuvée",
  rejected: "Refusée",
}

// ─────────────────────────────────────────────────────────────────────────────
// Slot Card (individual date cell in the calendar)
// ─────────────────────────────────────────────────────────────────────────────
function SlotCard({
  slot,
  myPicks,
  allPicks,
  vacationDates,
  isAdmin,
  doctorCode,
  onPick,
  onDelete,
  onApprove,
  onReject,
}: {
  slot: SemesterGuardSlot
  myPicks: GuardPickRow[]
  allPicks: GuardPickRow[]
  vacationDates: Set<string>
  isAdmin: boolean
  doctorCode: string
  onPick: (slot: SemesterGuardSlot, guardType: GuardType) => void
  onDelete: (id: string) => void
  onApprove: (id: string) => void
  onReject: (id: string, note?: string) => void
}) {
  const isOnVacation = vacationDates.has(slot.date)
  const myPicksForDate = myPicks.filter(p => p.date === slot.date)
  const allPicksForDate = allPicks.filter(p => p.date === slot.date)

  const guardTypes: GuardType[] = ["Garde Matin", "Garde Nuit"]

  return (
    <div
      className={cn(
        "rounded-xl border p-3 transition-all duration-200 flex flex-col justify-between",
        slot.isWomCombo
          ? "border-purple-200 bg-purple-50/60"
          : slot.dayType === "ferie"
            ? "border-rose-200 bg-rose-50/50"
            : slot.dayType === "samedi"
              ? "border-blue-200 bg-blue-50/40"
              : "border-slate-200 bg-white",
        isOnVacation && "opacity-50 cursor-not-allowed border-slate-200 bg-slate-50",
      )}
    >
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <p className="text-[11px] font-black text-slate-700 uppercase tracking-wide">
              {slot.label}
            </p>
            {slot.isWomCombo && (
              <Badge className="mt-0.5 text-[9px] px-1.5 py-0 h-4 bg-purple-100 text-purple-700 border-purple-200 font-bold">
                <Star className="h-2.5 w-2.5 mr-0.5" /> Combo M/O/W
              </Badge>
            )}
            {slot.dayType === "ferie" && (
              <Badge className="mt-0.5 text-[9px] px-1.5 py-0 h-4 bg-rose-100 text-rose-700 border-rose-200 font-bold">
                Jour férié
              </Badge>
            )}
          </div>
          {isOnVacation && (
            <Badge className="text-[9px] px-1.5 py-0 h-4 bg-slate-100 text-slate-500 border-slate-200">
              🏖 Congé
            </Badge>
          )}
        </div>

        {/* Guard types & Choices */}
        {!isOnVacation && (
          <div className="space-y-2">
            {guardTypes.map(guardType => {
              const myPick = myPicksForDate.find(p => p.guard_type === guardType)
              const picksForThisSlot = allPicksForDate.filter(p => p.guard_type === guardType)
              const approvedPick = picksForThisSlot.find(p => p.status === "approved")

              return (
                <div
                  key={guardType}
                  className={cn(
                    "rounded-lg p-2 border text-xs space-y-1.5 transition-all",
                    approvedPick
                      ? "border-emerald-300 bg-emerald-50/90"
                      : myPick?.status === "pending"
                        ? "border-amber-300 bg-amber-50"
                        : "border-slate-200 bg-white",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800">
                      {GUARD_ICON[guardType]}
                      <span>{guardType}</span>
                    </div>

                    {/* Non-admin / my action */}
                    {!isAdmin && (
                      <div>
                        {myPick ? (
                          <div className="flex items-center gap-1">
                            <Badge
                              className={cn(
                                "text-[9px] px-1.5 py-0 h-4 font-bold border",
                                STATUS_COLORS[myPick.status],
                              )}
                            >
                              {STATUS_LABELS[myPick.status]}
                            </Badge>
                            {myPick.status === "pending" && (
                              <button
                                onClick={() => onDelete(myPick.id)}
                                className="rounded p-0.5 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                title="Annuler ma demande"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        ) : approvedPick ? (
                          <span className="text-[10px] text-emerald-700 font-semibold italic">
                            Assigné (Dr. {approvedPick.doctor_code})
                          </span>
                        ) : (
                          <button
                            onClick={() => onPick(slot, guardType)}
                            className="rounded px-2 py-0.5 text-[10px] font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                          >
                            Choisir
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ADMIN VIEW: Display all doctor proposals with validation buttons */}
                  {isAdmin && (
                    <div className="space-y-1 pt-1 border-t border-slate-100">
                      {picksForThisSlot.length === 0 ? (
                        <div className="flex items-center justify-between text-[10px] text-slate-400 italic">
                          <span>Aucune proposition</span>
                          <button
                            onClick={() => onPick(slot, guardType)}
                            className="rounded px-1.5 py-0.5 text-[9px] font-bold bg-slate-100 text-slate-600 hover:bg-blue-600 hover:text-white transition-colors"
                          >
                            + Assigner {doctorCode}
                          </button>
                        </div>
                      ) : (
                        picksForThisSlot.map(pick => (
                          <div
                            key={pick.id}
                            className={cn(
                              "flex items-center justify-between rounded px-2 py-1 gap-1.5 text-[11px] font-medium border",
                              pick.status === "approved"
                                ? "bg-emerald-100 border-emerald-300 text-emerald-900"
                                : pick.status === "rejected"
                                  ? "bg-red-50 border-red-200 text-red-700 opacity-60"
                                  : "bg-amber-50 border-amber-200 text-amber-900",
                            )}
                          >
                            <div className="flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black text-white shrink-0",
                                  DOCTOR_COLORS[pick.doctor_code] || "bg-slate-500",
                                )}
                              >
                                {pick.doctor_code}
                              </span>
                              <span className="font-bold">Dr. {pick.doctor_code}</span>
                              <Badge
                                className={cn(
                                  "text-[8px] px-1 py-0 h-3.5 border font-bold",
                                  STATUS_COLORS[pick.status],
                                )}
                              >
                                {STATUS_LABELS[pick.status]}
                              </Badge>
                            </div>

                            {/* Admin Validation Actions */}
                            <div className="flex items-center gap-1 shrink-0">
                              {pick.status === "pending" && (
                                <>
                                  <button
                                    onClick={() => onApprove(pick.id)}
                                    className="flex items-center gap-1 rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-emerald-700 shadow-xs"
                                    title="Valider et intégrer directement au planning général"
                                  >
                                    <CheckCircle2 className="h-3 w-3" />
                                    Valider
                                  </button>
                                  <button
                                    onClick={() => onReject(pick.id)}
                                    className="flex items-center gap-1 rounded bg-red-100 text-red-700 px-1.5 py-0.5 text-[10px] font-bold hover:bg-red-200"
                                    title="Refuser"
                                  >
                                    <XCircle className="h-3 w-3" />
                                    Refuser
                                  </button>
                                </>
                              )}

                              {pick.status === "approved" && (
                                <button
                                  onClick={() => onReject(pick.id)}
                                  className="text-[9px] text-red-600 hover:underline"
                                  title="Annuler l'approbation"
                                >
                                  Annuler
                                </button>
                              )}

                              {pick.status === "rejected" && (
                                <button
                                  onClick={() => onApprove(pick.id)}
                                  className="text-[9px] text-emerald-600 hover:underline font-semibold"
                                >
                                  Approuver quand même
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Month accordion section with bulk validation button
// ─────────────────────────────────────────────────────────────────────────────
function MonthSection({
  monthKey,
  slots,
  myPicks,
  allPicks,
  vacationDates,
  isAdmin,
  doctorCode,
  onPick,
  onDelete,
  onApprove,
  onReject,
  onApproveBulk,
}: {
  monthKey: string
  slots: SemesterGuardSlot[]
  myPicks: GuardPickRow[]
  allPicks: GuardPickRow[]
  vacationDates: Set<string>
  isAdmin: boolean
  doctorCode: string
  onPick: (slot: SemesterGuardSlot, guardType: GuardType) => void
  onDelete: (id: string) => void
  onApprove: (id: string) => void
  onReject: (id: string, note?: string) => void
  onApproveBulk: (ids: string[], label: string) => void
}) {
  const [open, setOpen] = useState(true)

  const monthPicks = allPicks.filter(p => slots.some(s => s.date === p.date))
  const pendingMonthPicks = monthPicks.filter(p => p.status === "pending")

  const monthLabel = monthLabelFromKey(monthKey)

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden shadow-xs bg-white">
      <div
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100 flex-wrap gap-2 cursor-pointer select-none"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-slate-800 capitalize">
            {monthLabel}
          </span>
          <Badge className="text-[10px] px-2 py-0 h-4 bg-blue-100 text-blue-700 border-blue-200 font-bold">
            {slots.length} WE/Fériés
          </Badge>
          {pendingMonthPicks.length > 0 && (
            <Badge className="text-[10px] px-2 py-0 h-4 bg-amber-100 text-amber-800 border-amber-200 font-extrabold animate-pulse">
              {pendingMonthPicks.length} en attente
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {/* Admin Bulk Action for the month */}
          {isAdmin && pendingMonthPicks.length > 0 && (
            <Button
              size="sm"
              onClick={() => onApproveBulk(pendingMonthPicks.map(p => p.id), `mois de ${monthLabel}`)}
              className="h-7 text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white gap-1 shadow-xs"
            >
              <Zap className="h-3.5 w-3.5" />
              Valider tout ce bloc ({pendingMonthPicks.length})
            </Button>
          )}

          {open ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
        </div>
      </div>

      {open && (
        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {slots.map(slot => (
            <SlotCard
              key={slot.date}
              slot={slot}
              myPicks={myPicks}
              allPicks={allPicks}
              vacationDates={vacationDates}
              isAdmin={isAdmin}
              doctorCode={doctorCode}
              onPick={onPick}
              onDelete={onDelete}
              onApprove={onApprove}
              onReject={onReject}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Dialog
// ─────────────────────────────────────────────────────────────────────────────
export function GuardPicksDialog({ open, onOpenChange, isAdmin, doctorCode }: Props) {
  const [semester, setSemester] = useState<Semester>(
    new Date().getMonth() < 8 ? 1 : 2,
  )
  const [year, setYear] = useState(CURRENT_YEAR)
  const [myPicks, setMyPicks] = useState<GuardPickRow[]>([])
  const [allPicks, setAllPicks] = useState<GuardPickRow[]>([])
  const [vacationDates, setVacationDates] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Compute all slots for the semester
  const slots = useMemo(
    () => getSemesterGuardSlots(semester, year),
    [semester, year],
  )

  const groupedSlots = useMemo(
    () => groupSlotsByMonth(slots),
    [slots],
  )

  // Load data when semester/year changes
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [myResult, allResult, vacResult] = await Promise.all([
        getMyGuardPicks(semester, year),
        getGuardPicksForSemester(semester, year),
        getVacationDatesForSemester(semester, year, doctorCode),
      ])
      setMyPicks(myResult.data || [])
      setAllPicks(allResult.data || [])
      setVacationDates(new Set(vacResult.dates || []))
    } catch {
      toast.error("Erreur lors du chargement des données")
    } finally {
      setLoading(false)
    }
  }, [semester, year, doctorCode])

  useEffect(() => {
    if (open) {
      void loadData()
    }
  }, [open, loadData])

  // Stats
  const totalPendingAll = allPicks.filter(p => p.status === "pending").length
  const totalApprovedAll = allPicks.filter(p => p.status === "approved").length

  const handlePick = (slot: SemesterGuardSlot, guardType: GuardType) => {
    startTransition(async () => {
      const res = await submitGuardPick({
        doctor_code: doctorCode,
        semester,
        year,
        date: slot.date,
        day_type: slot.dayType,
        guard_type: guardType,
        is_wom_combo: slot.isWomCombo,
        reason: undefined,
      })
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(`Préférence enregistrée pour ${slot.label}`)
        await loadData()
      }
    })
  }

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const res = await deleteGuardPick(id)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success("Préférence retirée")
        await loadData()
      }
    })
  }

  const handleApprove = (id: string) => {
    startTransition(async () => {
      const res = await approveGuardPick(id, doctorCode)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success("Choix de garde approuvé et directement intégré au planning general ! ✅")
        await loadData()
      }
    })
  }

  const handleApproveBulk = (ids: string[], label: string) => {
    if (ids.length === 0) return
    startTransition(async () => {
      const res = await approveBulkGuardPicks(ids, doctorCode)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(`${res.count} demandes pour ${label} validées et intégrées au planning ! 🎉`)
        await loadData()
      }
    })
  }

  const handleReject = (id: string, note?: string) => {
    startTransition(async () => {
      const res = await rejectGuardPick(id, doctorCode, note)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.warning("Choix de garde refusé")
        await loadData()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-hidden bg-slate-50 text-slate-900 p-0 flex flex-col">
        {/* Header */}
        <div className="flex-none p-5 border-b border-slate-200 bg-white">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
                <CalendarCheck2 className="w-5 h-5 text-blue-600" />
                Choix de Gardes — WE & Fériés
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500">
                Positionnez vos préférences de gardes de weekend et jours fériés. L'admin valide et intègre directement les choix au planning général.
              </DialogDescription>
            </div>

            {/* Stats & Global Bulk Validation Button */}
            <div className="flex items-center gap-2 flex-wrap">
              {isAdmin && totalPendingAll > 0 && (
                <Button
                  onClick={() => handleApproveBulk(allPicks.filter(p => p.status === "pending").map(p => p.id), "tout le semestre")}
                  className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold gap-1.5 text-xs shadow-sm"
                >
                  <CheckCheck className="h-4 w-4" />
                  Tout valider ce semestre ({totalPendingAll})
                </Button>
              )}

              <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5">
                <Clock3 className="h-3.5 w-3.5 text-amber-600" />
                <span className="text-xs font-bold text-amber-800">{totalPendingAll} en attente</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-xs font-bold text-emerald-800">{totalApprovedAll} approuvés</span>
              </div>
            </div>
          </div>

          {/* Semester selector */}
          <div className="mt-4 flex items-center gap-3 flex-wrap justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                {([1, 2] as Semester[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setSemester(s)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-bold transition-all",
                      semester === s
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900",
                    )}
                  >
                    {s === 1 ? "🌸 Semestre 1 (Jan–Août)" : "🍂 Semestre 2 (Sept–Déc+)"}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                {[CURRENT_YEAR, CURRENT_YEAR + 1].map(y => (
                  <button
                    key={y}
                    onClick={() => setYear(y)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-bold transition-all",
                      year === y
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900",
                    )}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>

            {isAdmin && (
              <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-[11px] px-2.5 py-1 font-bold">
                <Shield className="h-3.5 w-3.5 mr-1 text-rose-600" /> Mode Validation Admin actif
              </Badge>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex-none px-5 py-2 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded border-2 border-purple-300 bg-purple-50" />
            <span>Combo M/O/W</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded border-2 border-rose-300 bg-rose-50" />
            <span>Jour férié</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded border-2 border-blue-300 bg-blue-50" />
            <span>Samedi</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded border-2 border-slate-300 bg-white" />
            <span>Dimanche</span>
          </div>
          <div className="flex items-center gap-1">
            <Sun className="h-3.5 w-3.5 text-amber-500" />
            <span>Garde Matin</span>
          </div>
          <div className="flex items-center gap-1">
            <Moon className="h-3.5 w-3.5 text-indigo-400" />
            <span>Garde Nuit</span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="text-sm text-slate-500">Chargement des propositions…</p>
            </div>
          ) : slots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
              <AlertCircle className="h-8 w-8" />
              <p className="text-sm">Aucun week-end ni férié pour cette période.</p>
            </div>
          ) : (
            <>
              {isPending && (
                <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 shadow-xs">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Mise à jour et intégration au planning en cours…
                </div>
              )}

              {/* Info box */}
              {!isAdmin ? (
                <div className="flex items-start gap-2 rounded-lg bg-sky-50 border border-sky-200 px-3 py-2 text-xs text-sky-700">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    Cliquez sur <strong>Choisir</strong> pour proposer une garde. Vos choix sont soumis à validation par l'admin qui les intègrera directement au planning. Vos dates de congés sont automatiquement bloquées.
                  </span>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800 font-medium">
                  <Shield className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-600" />
                  <span>
                    <strong>Espace Administrateur :</strong> Vous pouvez valider ou refuser individuellement les demandes de chaque médecin (boutons <strong>Valider</strong> / <strong>Refuser</strong>), ou cliquer sur <strong>Valider tout ce bloc</strong> pour approuver et intégrer l'ensemble des propositions d'un mois en 1 clic.
                  </span>
                </div>
              )}

              {[...groupedSlots.entries()].map(([monthKey, monthSlots]) => (
                <MonthSection
                  key={monthKey}
                  monthKey={monthKey}
                  slots={monthSlots}
                  myPicks={myPicks}
                  allPicks={allPicks}
                  vacationDates={vacationDates}
                  isAdmin={isAdmin}
                  doctorCode={doctorCode}
                  onPick={handlePick}
                  onDelete={handleDelete}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onApproveBulk={handleApproveBulk}
                />
              ))}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
