"use client"

import React, { useState, useMemo, useCallback, useEffect, useTransition } from "react"
import {
  Dialog,
  DialogContent,
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
  ChevronLeft,
  ChevronRight,
  CalendarRange,
  Loader2,
  Info,
  Trash2,
  Moon,
  Sun,
  Star,
  AlertCircle,
  CheckCheck,
  Zap,
  Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { DOCTOR_COLORS, DOCTORS } from "@/lib/constants"
import { getSemesterGuardSlots, type SemesterGuardSlot } from "@/lib/semester-guard-slots"
import { buildMonthGrid } from "@/lib/nct-calendar"
import { schoolHolidayZoneB } from "@/lib/french-calendar"
import {
  defaultGuardCursor,
  GUARD_MONTH_NAMES,
  guardMonthKey,
  SEMESTER_MONTHS,
  stepGuardMonth,
  stepGuardSemester,
  summarizeGuardSlot,
  type GuardCursor,
} from "@/lib/guard-picks-view"
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
import { formatPersonLabel } from "@/lib/doctor-code"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  isAdmin: boolean
  doctorCode: string
}

type GuardType = "Garde Matin" | "Garde Nuit"

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
  onAdminAssign,
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
  onAdminAssign: (slot: SemesterGuardSlot, guardType: GuardType, doctor: string) => void
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
                          ✓ Attribuée à {formatPersonLabel(approvedPick.doctor_code)}
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
                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400 italic py-0.5">
                        <span>Aucune demande soumise</span>
                        <select
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) {
                              onAdminAssign(slot, guardType, e.target.value)
                              e.target.value = ""
                            }
                          }}
                          className="h-6 rounded-md border border-slate-300 bg-white px-1.5 text-[10px] font-bold text-slate-700 not-italic hover:border-blue-400"
                        >
                          <option value="">+ Assigner un médecin…</option>
                          {DOCTORS.map((doc) => (
                            <option key={doc} value={doc}>{doc}</option>
                          ))}
                        </select>
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
                            <span className="font-extrabold text-xs">{formatPersonLabel(pick.doctor_code)}</span>
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
// Case d'un jour dans la grille du mois (comme le calendrier NCT)
// ─────────────────────────────────────────────────────────────────────────────
const WEEKDAYS_SHORT = ["L", "M", "M", "J", "V", "S", "D"]

function GuardMiniRow({
  icon,
  summary,
}: {
  icon: React.ReactNode
  summary: ReturnType<typeof summarizeGuardSlot>
}) {
  return (
    <span className="flex items-center justify-center gap-0.5 leading-none">
      {icon}
      {summary.state === "approved" ? (
        <span className="rounded bg-emerald-600 px-1 text-[10px] font-black text-white">
          {summary.doctor}
        </span>
      ) : summary.state === "pending" ? (
        <span className="rounded bg-amber-400 px-1 text-[10px] font-black text-amber-950">
          {summary.pendingCount}
        </span>
      ) : (
        <span className="text-[10px] text-slate-400">–</span>
      )}
    </span>
  )
}

function DayCell({
  date,
  day,
  inMonth,
  slot,
  isSelected,
  isToday,
  isOnVacation,
  hasMyPick,
  allPicks,
  onSelect,
}: {
  date: string
  day: number
  inMonth: boolean
  slot: SemesterGuardSlot | undefined
  isSelected: boolean
  isToday: boolean
  isOnVacation: boolean
  hasMyPick: boolean
  allPicks: GuardPickRow[]
  onSelect: (date: string) => void
}) {
  const school = schoolHolidayZoneB(date)

  if (!slot) {
    // Jour ordinaire : non cliquable, seulement un repère (vacances scolaires).
    return (
      <div
        className={cn(
          "flex h-16 flex-col items-start rounded-md border p-1 text-xs sm:h-[72px]",
          !inMonth && "opacity-30",
          school ? "border-amber-200 bg-amber-50 text-amber-900/70" : "border-slate-100 bg-white text-slate-300",
          isToday && "ring-2 ring-slate-900/50",
        )}
        title={school ? `Vacances scolaires zone B : ${school.name}` : undefined}
      >
        {day}
      </div>
    )
  }

  const matin = summarizeGuardSlot(allPicks, date, "Garde Matin")
  const nuit = summarizeGuardSlot(allPicks, date, "Garde Nuit")
  const tone = slot.isWomCombo
    ? "border-purple-300 bg-purple-50 hover:border-purple-500"
    : slot.dayType === "ferie"
      ? "border-rose-300 bg-rose-100 hover:border-rose-500"
      : slot.dayType === "samedi"
        ? "border-blue-300 bg-blue-50 hover:border-blue-500"
        : "border-slate-300 bg-slate-50 hover:border-slate-500"

  return (
    <button
      type="button"
      onClick={() => onSelect(date)}
      aria-pressed={isSelected}
      title={`${slot.label}${slot.isWomCombo ? " · combo M/O/W" : ""}${isOnVacation ? " · congé" : ""}${school ? ` · vacances ${school.name}` : ""}`}
      className={cn(
        "relative flex h-16 flex-col items-stretch justify-between rounded-md border p-1 text-left transition sm:h-[72px]",
        tone,
        !inMonth && "opacity-50",
        isOnVacation && "opacity-60 [background-image:repeating-linear-gradient(135deg,transparent_0_4px,rgba(100,116,139,0.18)_4px_6px)]",
        hasMyPick && "ring-2 ring-blue-500",
        isSelected && "ring-2 ring-slate-900 shadow-md",
        isToday && !isSelected && "outline outline-2 outline-offset-1 outline-slate-900/40",
      )}
    >
      <span className="flex items-start justify-between">
        <span className="text-xs font-extrabold text-slate-900">{day}</span>
        <span className="flex items-center gap-0.5">
          {slot.isWomCombo && <Star className="h-2.5 w-2.5 text-purple-600" />}
          {school && <span className="h-2 w-2 rounded-full bg-amber-400 ring-1 ring-white" />}
          {isOnVacation && <span className="text-[10px]">🏖</span>}
        </span>
      </span>
      {!isOnVacation && (
        <span className="flex flex-col gap-0.5">
          <GuardMiniRow icon={<Sun className="h-2.5 w-2.5 text-amber-500" />} summary={matin} />
          <GuardMiniRow icon={<Moon className="h-2.5 w-2.5 text-indigo-500" />} summary={nuit} />
        </span>
      )}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Dialog
// ─────────────────────────────────────────────────────────────────────────────
export function GuardPicksDialog({ open, onOpenChange, isAdmin, doctorCode }: Props) {
  const [cursor, setCursor] = useState<GuardCursor>(() => defaultGuardCursor())
  const [view, setView] = useState<"month" | "semester">("month")
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [myPicks, setMyPicks] = useState<GuardPickRow[]>([])
  const [allPicks, setAllPicks] = useState<GuardPickRow[]>([])
  const [vacationDates, setVacationDates] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const detailRef = React.useRef<HTMLDivElement | null>(null)

  const { semester, year, month0 } = cursor

  // Compute all slots for the semester
  const slots = useMemo(() => getSemesterGuardSlots(semester, year), [semester, year])
  const slotByDate = useMemo(() => new Map(slots.map((s) => [s.date, s])), [slots])

  const monthPrefix = `${guardMonthKey(cursor)}-`
  const monthSlots = useMemo(
    () => slots.filter((s) => s.date.startsWith(monthPrefix)),
    [slots, monthPrefix],
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

  // À l'ouverture : mois courant, vue Mois
  useEffect(() => {
    if (!open) return
    setCursor(defaultGuardCursor())
    setView("month")
    setSelectedDate(null)
  }, [open])

  // Changement de mois : présélection du premier jour utile (admin : celui qui a
  // des demandes en attente ; sinon le premier week-end / férié du mois).
  useEffect(() => {
    if (view !== "month") return
    const firstPending = monthSlots.find((s) => allPicks.some((p) => p.date === s.date && p.status === "pending"))
    setSelectedDate((prev) => {
      if (prev && monthSlots.some((s) => s.date === prev)) return prev
      return (isAdmin ? firstPending : undefined)?.date ?? monthSlots[0]?.date ?? null
    })
  }, [monthSlots, view, isAdmin, allPicks])

  // Raccourcis clavier : ← → changent de mois (ou de semestre en vue d'ensemble)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
      const delta = e.key === "ArrowRight" ? 1 : -1
      setCursor((c) => (view === "month" ? stepGuardMonth(c, delta) : stepGuardSemester(c, delta)))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, view])

  // Stats
  const totalPendingAll = allPicks.filter((p) => p.status === "pending").length
  const totalApprovedAll = allPicks.filter((p) => p.status === "approved").length
  const monthPendingIds = useMemo(
    () =>
      allPicks
        .filter((p) => p.status === "pending" && p.date.startsWith(monthPrefix))
        .map((p) => p.id),
    [allPicks, monthPrefix],
  )

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

  const handleAdminAssign = (slot: SemesterGuardSlot, guardType: GuardType, doctor: string) => {
    startTransition(async () => {
      const submitRes = await submitGuardPick({
        doctor_code: doctor,
        semester,
        year,
        date: slot.date,
        day_type: slot.dayType,
        guard_type: guardType,
        is_wom_combo: slot.isWomCombo,
        reason: undefined,
      })
      if (submitRes.error || !submitRes.data) {
        toast.error(submitRes.error || "Erreur lors de l'assignation")
        return
      }
      const approveRes = await approveGuardPick(submitRes.data.id, doctorCode)
      if (approveRes.error) {
        toast.error(approveRes.error)
      } else {
        toast.success(`${doctor} assigné(e) et intégré(e) directement au planning ! ✅`)
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

  const selectDate = (date: string) => {
    setSelectedDate(date)
    // Sur téléphone la fiche du jour est sous la grille : on la ramène à l'écran.
    window.setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50)
  }

  const goToday = () => {
    setCursor(defaultGuardCursor())
    setView("month")
  }

  const selectedSlot = selectedDate ? slotByDate.get(selectedDate) : undefined
  const grid = useMemo(() => buildMonthGrid(year, month0), [year, month0])
  const todayIso = (() => {
    const t = new Date()
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`
  })()
  const monthTitle = `${GUARD_MONTH_NAMES[month0]} ${year}`
  const semesterTitle = `${semester === 1 ? "S1" : "S2"} ${year} · ${semester === 1 ? "janv. – août" : "sept. – déc."}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // Pas de focus automatique sur la 1ʳᵉ flèche (anneau noir parasite à l'ouverture)
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="w-[96vw] max-w-3xl h-[92vh] max-h-[92vh] overflow-hidden bg-slate-50 text-slate-900 p-0 flex flex-col rounded-2xl border border-slate-200 shadow-2xl">
        {/* En-tête */}
        <div className="flex-none p-3 sm:p-4 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="space-y-0.5">
              <DialogTitle className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <CalendarCheck2 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 shrink-0" />
                Choix de Gardes — WE & Fériés
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 hidden sm:block">
                {isAdmin
                  ? "Touchez un jour pour traiter les demandes : Valider, Refuser ou assigner directement un médecin."
                  : "Touchez un jour coloré, puis « Choisir » la garde Matin ou Nuit. L'admin valide et l'intègre au planning."}
              </DialogDescription>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {isAdmin && totalPendingAll > 0 && (
                <Button
                  onClick={() =>
                    handleApproveBulk(
                      allPicks.filter((p) => p.status === "pending").map((p) => p.id),
                      "tout le semestre",
                    )
                  }
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
        </div>

        {/* Navigation : flèches mois / semestre + bascule Mois ⇄ Semestre (comme le calendrier NCT) */}
        <div className="flex-none flex items-center gap-1 border-b border-slate-100 bg-slate-100/70 px-3 py-2">
          <button
            type="button"
            onClick={() => setCursor((c) => (view === "month" ? stepGuardMonth(c, -1) : stepGuardSemester(c, -1)))}
            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-200"
            aria-label={view === "month" ? "Mois précédent" : "Semestre précédent"}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setView((v) => (v === "month" ? "semester" : "month"))}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-base font-bold text-slate-900 hover:bg-slate-200"
            title={view === "month" ? "Voir tout le semestre" : "Revenir au mois"}
          >
            <CalendarRange className="h-4 w-4 text-slate-500" />
            {view === "month" ? monthTitle : semesterTitle}
          </button>
          <button
            type="button"
            onClick={() => setCursor((c) => (view === "month" ? stepGuardMonth(c, 1) : stepGuardSemester(c, 1)))}
            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-200"
            aria-label={view === "month" ? "Mois suivant" : "Semestre suivant"}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="ml-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Aujourd&apos;hui
          </button>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto min-h-0 p-3 sm:p-4 space-y-3">
          {isPending && (
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 shadow-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Mise à jour et intégration au planning en cours…
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="text-sm text-slate-500">Chargement des propositions…</p>
            </div>
          ) : view === "semester" ? (
            /* Vue Semestre : une tuile par mois, un clic ouvre le mois */
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SEMESTER_MONTHS[semester].map((m0) => {
                const prefix = `${guardMonthKey({ year, month0: m0 })}-`
                const mSlots = slots.filter((s) => s.date.startsWith(prefix))
                const pending = allPicks.filter((p) => p.status === "pending" && p.date.startsWith(prefix)).length
                const approved = allPicks.filter((p) => p.status === "approved" && p.date.startsWith(prefix)).length
                const mine = myPicks.filter((p) => p.status !== "rejected" && p.date.startsWith(prefix)).length
                return (
                  <button
                    key={m0}
                    type="button"
                    onClick={() => {
                      setCursor({ semester, year, month0: m0 })
                      setView("month")
                    }}
                    className="flex min-h-[92px] flex-col rounded-lg border border-slate-200 bg-white p-2.5 text-left transition hover:border-blue-400 hover:bg-blue-50"
                  >
                    <span className="text-sm font-black text-slate-900">{GUARD_MONTH_NAMES[m0]}</span>
                    <span className="text-[11px] text-slate-500">{mSlots.length} WE & fériés</span>
                    <span className="mt-auto flex flex-wrap gap-1 pt-1.5">
                      {pending > 0 && (
                        <span className="rounded bg-amber-100 px-1.5 text-[10px] font-bold text-amber-900">
                          {pending} en attente
                        </span>
                      )}
                      {approved > 0 && (
                        <span className="rounded bg-emerald-100 px-1.5 text-[10px] font-bold text-emerald-900">
                          {approved} attribuée{approved > 1 ? "s" : ""}
                        </span>
                      )}
                      {!isAdmin && mine > 0 && (
                        <span className="rounded bg-blue-100 px-1.5 text-[10px] font-bold text-blue-900">
                          {mine} à moi
                        </span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <>
              {/* Grille du mois */}
              <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-xs sm:p-3">
                <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-500">
                  {WEEKDAYS_SHORT.map((d, i) => (
                    <div key={i}>{d}</div>
                  ))}
                </div>
                <div className="mt-1 grid grid-cols-7 gap-1">
                  {grid.flat().map((cell) => (
                    <DayCell
                      key={cell.date}
                      date={cell.date}
                      day={cell.day}
                      inMonth={cell.inMonth}
                      slot={slotByDate.get(cell.date)}
                      isSelected={selectedDate === cell.date}
                      isToday={cell.date === todayIso}
                      isOnVacation={vacationDates.has(cell.date)}
                      hasMyPick={myPicks.some((p) => p.date === cell.date && p.status !== "rejected")}
                      allPicks={allPicks}
                      onSelect={selectDate}
                    />
                  ))}
                </div>

                {/* Légende */}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-600 sm:text-[11px]">
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm border border-blue-300 bg-blue-50" /> Samedi</span>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm border border-slate-300 bg-slate-50" /> Dimanche</span>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm border border-rose-300 bg-rose-100" /> Férié</span>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm border border-purple-300 bg-purple-50" /> Combo M/O/W</span>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm border border-amber-200 bg-amber-100" /> Vacances (zone B)</span>
                  <span className="flex items-center gap-1"><Sun className="h-3 w-3 text-amber-500" /> Matin</span>
                  <span className="flex items-center gap-1"><Moon className="h-3 w-3 text-indigo-500" /> Nuit</span>
                  <span className="flex items-center gap-1"><span className="rounded bg-emerald-600 px-1 text-[9px] font-black text-white">W</span> attribuée</span>
                  <span className="flex items-center gap-1"><span className="rounded bg-amber-400 px-1 text-[9px] font-black text-amber-950">2</span> demandes en attente</span>
                </div>
              </div>

              {/* Barre du mois : résumé + validation en bloc (admin) */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {monthSlots.length
                    ? `${monthSlots.length} week-end${monthSlots.length > 1 ? "s" : ""} / férié${monthSlots.length > 1 ? "s" : ""} en ${GUARD_MONTH_NAMES[month0].toLowerCase()}`
                    : "Aucun week-end ni férié ce mois-ci"}
                </p>
                {isAdmin && monthPendingIds.length > 0 && (
                  <Button
                    size="sm"
                    onClick={() => handleApproveBulk(monthPendingIds, `${GUARD_MONTH_NAMES[month0].toLowerCase()} ${year}`)}
                    className="h-8 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Valider tout le mois ({monthPendingIds.length})
                  </Button>
                )}
              </div>

              {/* Fiche du jour sélectionné */}
              <div ref={detailRef}>
                {selectedSlot ? (
                  <SlotCard
                    slot={selectedSlot}
                    myPicks={myPicks}
                    allPicks={allPicks}
                    vacationDates={vacationDates}
                    isAdmin={isAdmin}
                    doctorCode={doctorCode}
                    onPick={handlePick}
                    onDelete={handleDelete}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onAdminAssign={handleAdminAssign}
                  />
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                    <Info className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {monthSlots.length
                        ? "Touchez un jour coloré pour voir et choisir ses gardes."
                        : "Pas de garde à choisir ce mois-ci — utilisez les flèches pour changer de mois."}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
