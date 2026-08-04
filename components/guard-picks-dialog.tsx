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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

const SEMESTER_LABELS: Record<Semester, string> = {
  1: "S1 — Janv. à Août (Nouvel An exclu)",
  2: "S2 — Sept. à Déc. + Nouvel An",
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
  const [expanded, setExpanded] = useState(false)

  const guardTypes: GuardType[] = ["Garde Matin", "Garde Nuit"]

  return (
    <div
      className={cn(
        "rounded-xl border p-3 transition-all duration-200",
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

      {/* Guard types */}
      {!isOnVacation && (
        <div className="space-y-1.5">
          {guardTypes.map(guardType => {
            const myPick = myPicksForDate.find(p => p.guard_type === guardType)
            const otherApprovedPicks = allPicksForDate.filter(
              p => p.guard_type === guardType && p.status === "approved" && p.doctor_code !== doctorCode,
            )
            const hasApprovedByOther = otherApprovedPicks.length > 0

            return (
              <div
                key={guardType}
                className={cn(
                  "flex items-center justify-between rounded-lg px-2 py-1.5 border gap-2",
                  myPick?.status === "approved"
                    ? "border-emerald-200 bg-emerald-50"
                    : myPick?.status === "rejected"
                      ? "border-red-200 bg-red-50"
                      : myPick?.status === "pending"
                        ? "border-amber-200 bg-amber-50"
                        : "border-slate-100 bg-slate-50/50",
                )}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {GUARD_ICON[guardType]}
                  <span className="text-[11px] font-semibold text-slate-700 truncate">
                    {guardType}
                  </span>
                  {myPick && (
                    <Badge
                      className={cn(
                        "text-[9px] px-1.5 py-0 h-4 border font-bold",
                        STATUS_COLORS[myPick.status],
                      )}
                    >
                      {STATUS_LABELS[myPick.status]}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {myPick ? (
                    <>
                      {isAdmin && myPick.status === "pending" && (
                        <>
                          <button
                            onClick={() => onApprove(myPick.id)}
                            className="rounded p-0.5 text-emerald-600 hover:bg-emerald-100"
                            title="Approuver"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => onReject(myPick.id)}
                            className="rounded p-0.5 text-red-500 hover:bg-red-100"
                            title="Rejeter"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                      {myPick.status === "pending" && (
                        <button
                          onClick={() => onDelete(myPick.id)}
                          className="rounded p-0.5 text-slate-400 hover:text-red-500 hover:bg-red-50"
                          title="Retirer ma préférence"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </>
                  ) : hasApprovedByOther ? (
                    <span className="text-[10px] text-slate-400 italic">
                      {otherApprovedPicks.map(p => p.doctor_code).join(", ")} ✓
                    </span>
                  ) : (
                    <button
                      onClick={() => onPick(slot, guardType)}
                      className="rounded-md px-2 py-0.5 text-[10px] font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                      Choisir
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Admin: show all other picks for this date */}
      {isAdmin && allPicksForDate.length > 0 && (
        <div className="mt-2">
          <button
            className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700"
            onClick={() => setExpanded(e => !e)}
          >
            <Users className="h-3 w-3" />
            {allPicksForDate.length} préférence{allPicksForDate.length > 1 ? "s" : ""}
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {expanded && (
            <div className="mt-1.5 space-y-1">
              {allPicksForDate.map(pick => (
                <div
                  key={pick.id}
                  className="flex items-center justify-between rounded-md bg-white border border-slate-100 px-2 py-1 gap-1"
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black text-white",
                        DOCTOR_COLORS[pick.doctor_code] || "bg-slate-400",
                      )}
                    >
                      {pick.doctor_code}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-700">
                      {pick.guard_type === "Garde Matin" ? "🌅 Matin" : "🌙 Nuit"}
                    </span>
                    <Badge
                      className={cn(
                        "text-[8px] px-1 py-0 h-3.5 border",
                        STATUS_COLORS[pick.status],
                      )}
                    >
                      {STATUS_LABELS[pick.status]}
                    </Badge>
                  </div>
                  {pick.status === "pending" && (
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => onApprove(pick.id)}
                        className="rounded p-0.5 text-emerald-600 hover:bg-emerald-100"
                        title="Approuver"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => onReject(pick.id)}
                        className="rounded p-0.5 text-red-500 hover:bg-red-100"
                        title="Rejeter"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Month accordion section
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
}) {
  const [open, setOpen] = useState(true)
  const myPicksThisMonth = myPicks.filter(p =>
    slots.some(s => s.date === p.date),
  )

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-slate-800 capitalize">
            {monthLabelFromKey(monthKey)}
          </span>
          <Badge className="text-[10px] px-2 py-0 h-4 bg-blue-100 text-blue-700 border-blue-200 font-bold">
            {slots.length} WE/Fériés
          </Badge>
          {myPicksThisMonth.length > 0 && (
            <Badge className="text-[10px] px-2 py-0 h-4 bg-emerald-100 text-emerald-700 border-emerald-200 font-bold">
              {myPicksThisMonth.length} choix
            </Badge>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
      </button>

      {open && (
        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
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
        isAdmin ? getGuardPicksForSemester(semester, year) : Promise.resolve({ data: [] }),
        getVacationDatesForSemester(semester, year, doctorCode),
      ])
      setMyPicks(myResult.data || [])
      setAllPicks(isAdmin ? (allResult.data || []) : (myResult.data || []))
      setVacationDates(new Set(vacResult.dates || []))
    } catch {
      toast.error("Erreur lors du chargement des données")
    } finally {
      setLoading(false)
    }
  }, [semester, year, isAdmin, doctorCode])

  useEffect(() => {
    if (open) {
      void loadData()
    }
  }, [open, loadData])

  // Stats
  const myPicksCount = myPicks.length
  const pendingCount = myPicks.filter(p => p.status === "pending").length
  const approvedCount = myPicks.filter(p => p.status === "approved").length

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
        toast.success("Choix de garde approuvé ✅")
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
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-hidden bg-slate-50 text-slate-900 p-0 flex flex-col">
        {/* Header */}
        <div className="flex-none p-5 border-b border-slate-200 bg-white">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
                <CalendarCheck2 className="w-5 h-5 text-blue-600" />
                Choix de Gardes — WE & Fériés
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500">
                Positionnez vos préférences de gardes de weekend et jours fériés. Soumis à validation admin.
              </DialogDescription>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-200 px-3 py-1.5">
                <Clock3 className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-xs font-bold text-blue-700">{pendingCount} en attente</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-xs font-bold text-emerald-700">{approvedCount} approuvés</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 border border-slate-200 px-3 py-1.5">
                <CalendarCheck2 className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-xs font-bold text-slate-600">{myPicksCount} total</span>
              </div>
            </div>
          </div>

          {/* Semester selector */}
          <div className="mt-4 flex items-center gap-3 flex-wrap">
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

            {isAdmin && (
              <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-[11px] px-2 py-0.5">
                <Shield className="h-3 w-3 mr-1" /> Vue Admin — tous les médecins
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
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="text-sm text-slate-500">Chargement des données…</p>
            </div>
          ) : slots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
              <AlertCircle className="h-8 w-8" />
              <p className="text-sm">Aucun week-end ni férié pour cette période.</p>
            </div>
          ) : (
            <>
              {isPending && (
                <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Enregistrement en cours…
                </div>
              )}

              {/* Info box for non-admins */}
              {!isAdmin && (
                <div className="flex items-start gap-2 rounded-lg bg-sky-50 border border-sky-200 px-3 py-2 text-xs text-sky-700">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    Cliquez <strong>Choisir</strong> pour exprimer une préférence de garde. Vos choix sont des <strong>souhaits</strong> soumis à validation par l'administrateur. Les dates de congés sont automatiquement bloquées.
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
                />
              ))}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
