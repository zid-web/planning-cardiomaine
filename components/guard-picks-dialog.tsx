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
  Plus,
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
  "Garde Matin": <Sun className="h-4 w-4 text-amber-500 shrink-0" />,
  "Garde Nuit": <Moon className="h-4 w-4 text-indigo-400 shrink-0" />,
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900 border-amber-300 font-bold",
  approved: "bg-emerald-100 text-emerald-900 border-emerald-300 font-bold",
  rejected: "bg-red-100 text-red-800 border-red-200 font-bold",
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
        "rounded-xl border shadow-xs transition-all duration-200 flex flex-col justify-between overflow-hidden bg-white",
        slot.isWomCombo
          ? "border-purple-300 bg-purple-50/30"
          : slot.dayType === "ferie"
            ? "border-rose-300 bg-rose-50/30"
            : slot.dayType === "samedi"
              ? "border-blue-200 bg-blue-50/20"
              : "border-slate-200",
        isOnVacation && "opacity-50 border-slate-200 bg-slate-50",
      )}
    >
      {/* Date Header Banner */}
      <div
        className={cn(
          "px-3 py-2 border-b flex items-center justify-between gap-2 flex-wrap",
          slot.isWomCombo
            ? "bg-purple-100/80 border-purple-200"
            : slot.dayType === "ferie"
              ? "bg-rose-100/80 border-rose-200"
              : slot.dayType === "samedi"
                ? "bg-blue-100/70 border-blue-200"
                : "bg-slate-100 border-slate-200",
        )}
      >
        <div className="flex items-center gap-2">
          <p className="text-xs font-black text-slate-800 tracking-wide uppercase">
            {slot.label}
          </p>
          {slot.isWomCombo && (
            <Badge className="text-[10px] px-1.5 py-0 h-4 bg-purple-600 text-white font-extrabold border-none shadow-xs">
              <Star className="h-2.5 w-2.5 mr-0.5" /> Combo M/O/W
            </Badge>
          )}
          {slot.dayType === "ferie" && (
            <Badge className="text-[10px] px-1.5 py-0 h-4 bg-rose-600 text-white font-extrabold border-none shadow-xs">
              Férié 🎉
            </Badge>
          )}
        </div>

        {isOnVacation && (
          <Badge className="text-[10px] px-2 py-0.5 h-5 bg-slate-200 text-slate-700 border-slate-300 font-bold">
            🏖 Indisponible (Congé)
          </Badge>
        )}
      </div>

      {/* Guard Types Container */}
      {!isOnVacation && (
        <div className="p-3 space-y-3 flex-1 flex flex-col justify-around">
          {guardTypes.map(guardType => {
            const myPick = myPicksForDate.find(p => p.guard_type === guardType)
            const picksForThisSlot = allPicksForDate.filter(p => p.guard_type === guardType)
            const approvedPick = picksForThisSlot.find(p => p.status === "approved")

            return (
              <div
                key={guardType}
                className={cn(
                  "rounded-lg p-2.5 border text-xs space-y-2 transition-all bg-white shadow-2xs",
                  approvedPick
                    ? "border-emerald-400 bg-emerald-50/60"
                    : picksForThisSlot.some(p => p.status === "pending")
                      ? "border-amber-300 bg-amber-50/40"
                      : "border-slate-200",
                )}
              >
                {/* Shift Title Header */}
                <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-100">
                  <div className="flex items-center gap-1.5 font-black text-slate-800 text-xs">
                    {GUARD_ICON[guardType]}
                    <span>{guardType}</span>
                  </div>

                  {/* Non-Admin Action Button */}
                  {!isAdmin && (
                    <div>
                      {myPick ? (
                        <div className="flex items-center gap-1">
                          <Badge
                            className={cn(
                              "text-[10px] px-2 py-0.5 h-5 font-bold border",
                              STATUS_COLORS[myPick.status],
                            )}
                          >
                            {STATUS_LABELS[myPick.status]}
                          </Badge>
                          {myPick.status === "pending" && (
                            <button
                              onClick={() => onDelete(myPick.id)}
                              className="rounded p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Annuler ma demande"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ) : approvedPick ? (
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold">
                          ✓ Attribuée à Dr. {approvedPick.doctor_code}
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => onPick(slot, guardType)}
                          className="h-6 px-2.5 text-[11px] font-extrabold bg-blue-600 hover:bg-blue-700 text-white gap-1 rounded-md shadow-2xs"
                        >
                          <Plus className="h-3 w-3" />
                          Choisir
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* ADMIN VIEW: Display All Doctor Proposals with Prominent Validation Buttons */}
                {isAdmin && (
                  <div className="space-y-1.5 pt-0.5">
                    {picksForThisSlot.length === 0 ? (
                      <div className="flex items-center justify-between text-[11px] text-slate-400 italic py-0.5">
                        <span>Aucune demande soumise</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onPick(slot, guardType)}
                          className="h-6 px-2 text-[10px] font-bold text-slate-600 hover:bg-blue-50 hover:text-blue-700 gap-1"
                        >
                          + Assigner {doctorCode}
                        </Button>
                      </div>
                    ) : (
                      picksForThisSlot.map(pick => (
                        <div
                          key={pick.id}
                          className={cn(
                            "flex items-center justify-between rounded-lg p-2 gap-2 text-xs border transition-all flex-wrap sm:flex-nowrap",
                            pick.status === "approved"
                              ? "bg-emerald-100/90 border-emerald-300 text-emerald-950 font-bold"
                              : pick.status === "rejected"
                                ? "bg-red-50 border-red-200 text-red-700 opacity-60"
                                : "bg-amber-50 border-amber-300 text-amber-950",
                          )}
                        >
                          {/* Doctor Identity */}
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={cn(
                                "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-white shadow-xs shrink-0",
                                DOCTOR_COLORS[pick.doctor_code] || "bg-slate-500",
                              )}
                            >
                              {pick.doctor_code}
                            </span>
                            <span className="font-extrabold text-xs">Dr. {pick.doctor_code}</span>
                            <Badge
                              className={cn(
                                "text-[9px] px-1.5 py-0 h-4 border font-bold",
                                STATUS_COLORS[pick.status],
                              )}
                            >
                              {STATUS_LABELS[pick.status]}
                            </Badge>
                          </div>

                          {/* Action Buttons for Admin */}
                          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                            {pick.status === "pending" && (
                              <>
                                <button
                                  onClick={() => onApprove(pick.id)}
                                  className="flex items-center gap-1 rounded-md bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 text-[11px] font-black text-white shadow-xs transition-all active:scale-95 cursor-pointer"
                                  title="Valider et intégrer directement au planning général"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Valider
                                </button>

                                <button
                                  onClick={() => onReject(pick.id)}
                                  className="flex items-center gap-1 rounded-md bg-red-500 hover:bg-red-600 px-2 py-1 text-[11px] font-extrabold text-white shadow-xs transition-all active:scale-95 cursor-pointer"
                                  title="Refuser la demande"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                  Refuser
                                </button>
                              </>
                            )}

                            {pick.status === "approved" && (
                              <button
                                onClick={() => onReject(pick.id)}
                                className="text-[10px] text-red-600 font-bold hover:underline bg-white px-2 py-0.5 rounded border border-red-200"
                                title="Annuler l'approbation"
                              >
                                Annuler
                              </button>
                            )}

                            {pick.status === "rejected" && (
                              <button
                                onClick={() => onApprove(pick.id)}
                                className="text-[10px] text-emerald-700 font-bold hover:underline bg-white px-2 py-0.5 rounded border border-emerald-200"
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
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-100/90 border-b border-slate-200 flex-wrap gap-2 cursor-pointer select-none"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <span className="text-base font-black text-slate-800 capitalize">
            {monthLabel}
          </span>
          <Badge className="text-xs px-2.5 py-0.5 bg-blue-100 text-blue-800 border-blue-200 font-bold">
            {slots.length} WE & Fériés
          </Badge>
          {pendingMonthPicks.length > 0 && (
            <Badge className="text-xs px-2.5 py-0.5 bg-amber-100 text-amber-900 border-amber-300 font-extrabold animate-pulse">
              ⚡ {pendingMonthPicks.length} en attente
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {/* Admin Bulk Action for the month */}
          {isAdmin && pendingMonthPicks.length > 0 && (
            <Button
              size="sm"
              onClick={() => onApproveBulk(pendingMonthPicks.map(p => p.id), `mois de ${monthLabel}`)}
              className="h-8 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs"
            >
              <Zap className="h-3.5 w-3.5" />
              Valider tout ce bloc ({pendingMonthPicks.length})
            </Button>
          )}

          {open ? <ChevronUp className="h-5 w-5 text-slate-600" /> : <ChevronDown className="h-5 w-5 text-slate-600" />}
        </div>
      </div>

      {open && (
        <div className="p-3 sm:p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
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
        toast.success("Choix de garde approuvé et directement intégré au planning général ! ✅")
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
      <DialogContent className="w-[96vw] max-w-6xl h-[92vh] max-h-[92vh] overflow-hidden bg-slate-50 text-slate-900 p-0 flex flex-col rounded-2xl border border-slate-200 shadow-2xl">
        {/* Header */}
        <div className="flex-none p-3 sm:p-4 border-b border-slate-200 bg-white sticky top-0 z-10">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="space-y-0.5">
              <DialogTitle className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <CalendarCheck2 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 shrink-0" />
                Choix de Gardes — WE & Fériés
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 hidden sm:block">
                Positionnez vos préférences de gardes de weekend et jours fériés. L'admin valide et intègre directement les choix au planning général.
              </DialogDescription>
            </div>

            {/* Stats & Global Bulk Validation Button */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {isAdmin && totalPendingAll > 0 && (
                <Button
                  onClick={() => handleApproveBulk(allPicks.filter(p => p.status === "pending").map(p => p.id), "tout le semestre")}
                  className="h-7 sm:h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold gap-1 text-[11px] sm:text-xs shadow-xs"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Tout valider ({totalPendingAll})
                </Button>
              )}

              <div className="flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2 py-1 text-[11px]">
                <Clock3 className="h-3 w-3 text-amber-600" />
                <span className="font-bold text-amber-800">{totalPendingAll} en attente</span>
              </div>
              <div className="flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-1 text-[11px]">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                <span className="font-bold text-emerald-800">{totalApprovedAll} approuvés</span>
              </div>
            </div>
          </div>

          {/* Semester selector */}
          <div className="mt-2 sm:mt-3 flex items-center gap-2 flex-wrap justify-between">
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg">
                {([1, 2] as Semester[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setSemester(s)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-[11px] font-bold transition-all",
                      semester === s
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900",
                    )}
                  >
                    {s === 1 ? "🌸 S1 (Jan–Août)" : "🍂 S2 (Sept–Déc+)"}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg">
                {[CURRENT_YEAR, CURRENT_YEAR + 1].map(y => (
                  <button
                    key={y}
                    onClick={() => setYear(y)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-[11px] font-bold transition-all",
                      year === y
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900",
                    )}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>

            {isAdmin && (
              <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-[10px] sm:text-[11px] px-2 py-0.5 font-bold">
                <Shield className="h-3 w-3 mr-1 text-rose-600" /> Mode Validation Admin actif
              </Badge>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex-none px-3 sm:px-4 py-1.5 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] sm:text-[11px] text-slate-600">
          <div className="flex items-center gap-1">
            <div className="h-2.5 w-2.5 rounded border border-purple-400 bg-purple-100" />
            <span>Combo M/O/W</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2.5 w-2.5 rounded border border-rose-400 bg-rose-100" />
            <span>Férié</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2.5 w-2.5 rounded border border-blue-400 bg-blue-100" />
            <span>Samedi</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2.5 w-2.5 rounded border border-slate-300 bg-white" />
            <span>Dimanche</span>
          </div>
          <div className="flex items-center gap-1">
            <Sun className="h-3 w-3 text-amber-500" />
            <span>Matin</span>
          </div>
          <div className="flex items-center gap-1">
            <Moon className="h-3 w-3 text-indigo-400" />
            <span>Nuit</span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto min-h-0 p-3 sm:p-4 space-y-3 sm:space-y-4">
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
                    <strong>Espace Administrateur :</strong> Cliquez sur <strong>Valider</strong> (vert) ou <strong>Refuser</strong> (rouge) devant chaque médecin pour traiter sa demande, ou cliquez sur <strong>Valider tout ce bloc</strong> pour approuver un mois en 1 clic.
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
