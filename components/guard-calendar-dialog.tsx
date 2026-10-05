"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarCheck2, CalendarRange, ChevronLeft, ChevronRight, Loader2, Moon, Sun } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { canAssignDoctor } from "@/lib/assignment-validation"
import { DOCTOR_COLORS, DOCTORS, NURSES } from "@/lib/constants"
import { schoolHolidayZoneB, publicHolidayName } from "@/lib/french-calendar"
import {
  GUARD_ROWS,
  GUARD_WE_DOCTORS,
  guardDatesInMonth,
  guardDayKind,
  guardFill,
  toggleGuardDoctor,
  type GuardRow,
} from "@/lib/guard-calendar"
import { buildMonthGrid, shiftMonth } from "@/lib/nct-calendar"
import { dayNameFromIsoDateLocal, weekKeyFromIsoDate } from "@/lib/nct-command"
import { generateWeekSchedule } from "@/lib/schedule-utils"
import { formatPersonLabel, isListedDoctor, normalizeRemplacantLabel } from "@/lib/doctor-code"
import type { DoctorVacation, FullSchedule } from "@/lib/types"
import { cn } from "@/lib/utils"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Seul l'admin modifie ; les autres consultent. */
  isAdmin: boolean
  fullSchedule: FullSchedule
  vacations: DoctorVacation[]
  /** Date (YYYY-MM-DD) servant à ouvrir sur le bon mois — semaine affichée du planning. */
  defaultDate?: string
  /** Enregistre la liste d'initiales d'une garde ; renvoie false en cas d'échec. */
  onSetGuard: (date: string, row: GuardRow, doctors: string[]) => Promise<boolean>
}

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
]
const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"]
const DAY_LABELS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."]

const ROW_ICON: Record<GuardRow, React.ReactNode> = {
  "Garde Matin": <Sun className="h-3.5 w-3.5 text-amber-500" />,
  "Garde Nuit": <Moon className="h-3.5 w-3.5 text-indigo-500" />,
}
const ROW_LABEL: Record<GuardRow, string> = { "Garde Matin": "Matin", "Garde Nuit": "Nuit" }

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function dateLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number)
  return `${DAY_LABELS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MONTHS_SHORT[m - 1]}`
}

function Initial({ code, small }: { code: string; small?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded font-black text-white",
        small ? "min-w-[16px] px-0.5 text-[10px] leading-4" : "min-w-[22px] px-1 text-xs leading-5",
        DOCTOR_COLORS[code] || "bg-slate-500",
      )}
    >
      {code}
    </span>
  )
}

export function GuardCalendarDialog({ open, onOpenChange, isAdmin, fullSchedule, vacations, defaultDate, onSetGuard }: Props) {
  const [cursor, setCursor] = useState<{ year: number; month0: number }>({ year: 2026, month0: 0 })
  const [view, setView] = useState<"month" | "year">("month")
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const editorRef = React.useRef<HTMLDivElement | null>(null)

  // À l'ouverture : mois de la semaine affichée, vue Mois
  useEffect(() => {
    if (!open) return
    const base = defaultDate && /^\d{4}-\d{2}-\d{2}$/.test(defaultDate) ? defaultDate : todayIso()
    setCursor({ year: Number(base.slice(0, 4)), month0: Number(base.slice(5, 7)) - 1 })
    setView("month")
    setSelectedDate(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const valuesOf = useCallback(
    (date: string, row: GuardRow): string[] =>
      fullSchedule[weekKeyFromIsoDate(date)]?.[row]?.[dayNameFromIsoDateLocal(date)]?.value ?? [],
    [fullSchedule],
  )

  const { year, month0 } = cursor
  const grid = useMemo(() => buildMonthGrid(year, month0), [year, month0])
  const monthDates = useMemo(() => guardDatesInMonth(year, month0), [year, month0])
  const monthFill = useMemo(() => guardFill(monthDates, valuesOf), [monthDates, valuesOf])

  // Présélection : premier jour de garde du mois qui reste à remplir, sinon le premier
  useEffect(() => {
    if (view !== "month") return
    setSelectedDate((prev) => {
      if (prev && monthDates.includes(prev)) return prev
      const firstEmpty = monthDates.find((d) => GUARD_ROWS.some((r) => valuesOf(d, r).length === 0))
      return firstEmpty ?? monthDates[0] ?? null
    })
  }, [monthDates, view, valuesOf])

  const goMonth = useCallback((delta: number) => setCursor((c) => shiftMonth(c.year, c.month0, delta)), [])

  // Raccourcis clavier : ← → changent de mois (ou d'année en vue Année)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
      const delta = e.key === "ArrowRight" ? 1 : -1
      if (view === "month") goMonth(delta)
      else setCursor((c) => ({ ...c, year: c.year + delta }))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, view, goMonth])

  // Initiales proposées pour le jour sélectionné : celles que les règles du planning
  // autorisent (congés, repos après garde, CH exclu…) + celles déjà posées.
  const choices = useMemo(() => {
    const out: Record<GuardRow, string[]> = { "Garde Matin": [], "Garde Nuit": [] }
    if (!selectedDate || !isAdmin) return out
    const wk = weekKeyFromIsoDate(selectedDate)
    const day = dayNameFromIsoDateLocal(selectedDate)
    const week = fullSchedule[wk] ?? generateWeekSchedule(wk, vacations)
    for (const row of GUARD_ROWS) {
      const current = valuesOf(selectedDate, row)
      out[row] = DOCTORS.filter(
        (d) =>
          (GUARD_WE_DOCTORS as readonly string[]).includes(d) || current.includes(d)
      ).filter(
        (d) =>
          !(NURSES as readonly string[]).includes(d) &&
          (current.includes(d) ||
            canAssignDoctor(d, selectedDate, row, vacations, { schedule: week, day }).allowed),
      )
    }
    return out
  }, [selectedDate, isAdmin, fullSchedule, vacations, valuesOf])

  const [remplacant, setRemplacant] = useState("")

  const addRemplacant = async (row: GuardRow) => {
    const label = normalizeRemplacantLabel(remplacant)
    if (!label || !selectedDate || busy) return
    const current = valuesOf(selectedDate, row)
    if (current.includes(label)) {
      setRemplacant("")
      return
    }
    setBusy(true)
    try {
      if (await onSetGuard(selectedDate, row, [...current, label])) setRemplacant("")
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (row: GuardRow, doctor: string) => {
    if (!selectedDate || busy) return
    setBusy(true)
    try {
      await onSetGuard(selectedDate, row, toggleGuardDoctor(valuesOf(selectedDate, row), doctor))
    } finally {
      setBusy(false)
    }
  }

  const today = todayIso()
  const yearFill = useMemo(
    () =>
      MONTHS.map((_, m0) => {
        const dates = guardDatesInMonth(year, m0)
        return { dates, fill: guardFill(dates, valuesOf) }
      }),
    [year, valuesOf],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="w-[96vw] max-w-lg h-[92vh] max-h-[92vh] overflow-hidden bg-white text-slate-900 p-0 flex flex-col rounded-2xl border border-slate-200 shadow-2xl"
      >
        <div className="flex-none border-b border-slate-200 px-4 py-3">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <CalendarCheck2 className="h-5 w-5 shrink-0 text-blue-600" />
            Gardes WE
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {isAdmin
              ? "Samedis, dimanches et jours fériés : touchez un jour, puis les initiales de la garde Matin et Nuit."
              : "Samedis, dimanches et jours fériés : gardes Matin et Nuit attribuées (consultation)."}
          </DialogDescription>
        </div>

        {/* Navigation : flèches mois / année + bascule Mois ⇄ Année (comme le calendrier NCT) */}
        <div className="flex-none flex items-center gap-1 border-b border-slate-100 bg-slate-50 px-3 py-2">
          <button
            type="button"
            onClick={() => (view === "month" ? goMonth(-1) : setCursor((c) => ({ ...c, year: c.year - 1 })))}
            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-200"
            aria-label={view === "month" ? "Mois précédent" : "Année précédente"}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setView((v) => (v === "month" ? "year" : "month"))}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-base font-bold hover:bg-slate-200"
            title={view === "month" ? "Voir toute l'année" : "Revenir au mois"}
          >
            <CalendarRange className="h-4 w-4 text-slate-500" />
            {view === "month" ? `${MONTHS[month0]} ${year}` : year}
          </button>
          <button
            type="button"
            onClick={() => (view === "month" ? goMonth(1) : setCursor((c) => ({ ...c, year: c.year + 1 })))}
            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-200"
            aria-label={view === "month" ? "Mois suivant" : "Année suivante"}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              const t = todayIso()
              setCursor({ year: Number(t.slice(0, 4)), month0: Number(t.slice(5, 7)) - 1 })
              setView("month")
            }}
            className="ml-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Aujourd&apos;hui
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {view === "year" ? (
            <div className="grid grid-cols-3 gap-2">
              {MONTHS_SHORT.map((label, m0) => {
                const { dates, fill } = yearFill[m0]
                const complete = fill.total > 0 && fill.complete === fill.total
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      setCursor((c) => ({ ...c, month0: m0 }))
                      setView("month")
                    }}
                    className={cn(
                      "flex min-h-[84px] flex-col rounded-lg border p-2 text-left transition hover:border-blue-400 hover:bg-blue-50",
                      complete
                        ? "border-emerald-300 bg-emerald-50"
                        : fill.complete + fill.partial > 0
                          ? "border-amber-300 bg-amber-50"
                          : "border-slate-200 bg-slate-50",
                    )}
                  >
                    <span className="text-sm font-bold capitalize">{label}</span>
                    <span className="mt-auto text-[11px] text-slate-600">
                      {fill.complete}/{dates.length} jours complets
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-500">
                {WEEKDAYS.map((d, i) => (
                  <div key={i}>{d}</div>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {grid.flat().map((cell) => {
                  const kind = guardDayKind(cell.date)
                  const school = schoolHolidayZoneB(cell.date)
                  const isToday = cell.date === today
                  if (!kind || !cell.inMonth) {
                    return (
                      <div
                        key={cell.date}
                        className={cn(
                          "flex h-[68px] items-start rounded-md border p-1 text-xs",
                          !cell.inMonth && "opacity-30",
                          school ? "border-amber-200 bg-amber-50 text-amber-900/70" : "border-slate-100 bg-white text-slate-300",
                          isToday && "ring-2 ring-slate-900/50",
                        )}
                        title={school ? `Vacances scolaires zone B : ${school.name}` : undefined}
                      >
                        {cell.day}
                      </div>
                    )
                  }
                  const selected = selectedDate === cell.date
                  const ferie = publicHolidayName(cell.date)
                  return (
                    <button
                      key={cell.date}
                      type="button"
                      onClick={() => {
                        setSelectedDate(cell.date)
                        // Téléphone : la saisie est sous la grille, on la ramène à l'écran
                        window.setTimeout(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60)
                      }}
                      aria-pressed={selected}
                      title={`${dateLabel(cell.date)}${ferie ? ` · ${ferie}` : ""}${school ? ` · vacances ${school.name}` : ""}`}
                      className={cn(
                        "relative flex h-[68px] flex-col justify-between rounded-md border p-1 text-left transition",
                        kind === "ferie"
                          ? "border-rose-300 bg-rose-100 hover:border-rose-500"
                          : kind === "samedi"
                            ? "border-blue-300 bg-blue-50 hover:border-blue-500"
                            : "border-slate-300 bg-slate-50 hover:border-slate-500",
                        selected && "ring-2 ring-slate-900 shadow-md",
                        isToday && !selected && "outline outline-2 outline-offset-1 outline-slate-900/40",
                      )}
                    >
                      <span className="flex items-start justify-between">
                        <span className="text-xs font-extrabold">{cell.day}</span>
                        {school && <span className="h-2 w-2 rounded-full bg-amber-400 ring-1 ring-white" />}
                      </span>
                      <span className="flex flex-col gap-0.5">
                        {GUARD_ROWS.map((row) => {
                          const v = valuesOf(cell.date, row)
                          return (
                            <span key={row} className="flex min-h-[16px] items-center gap-0.5 overflow-hidden">
                              {row === "Garde Matin" ? (
                                <Sun className="h-2.5 w-2.5 shrink-0 text-amber-500" />
                              ) : (
                                <Moon className="h-2.5 w-2.5 shrink-0 text-indigo-500" />
                              )}
                              {v.length === 0 ? (
                                <span className="text-[10px] text-slate-400">–</span>
                              ) : (
                                <>
                                  <Initial code={v[0]} small />
                                  {/* Petit écran : 1 initiale + « +n » ; à partir de sm : 2 initiales */}
                                  {v[1] && (
                                    <span className="hidden sm:inline-flex">
                                      <Initial code={v[1]} small />
                                    </span>
                                  )}
                                  {v.length > 1 && (
                                    <span className="text-[9px] font-bold text-slate-600 sm:hidden">+{v.length - 1}</span>
                                  )}
                                  {v.length > 2 && (
                                    <span className="hidden text-[9px] font-bold text-slate-600 sm:inline">+{v.length - 2}</span>
                                  )}
                                </>
                              )}
                            </span>
                          )
                        })}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm border border-blue-300 bg-blue-50" /> Samedi</span>
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm border border-slate-300 bg-slate-50" /> Dimanche</span>
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm border border-rose-300 bg-rose-100" /> Férié</span>
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm border border-amber-200 bg-amber-100" /> Vacances (zone B)</span>
              </div>

              <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {monthFill.complete}/{monthFill.total} jours complets en {MONTHS[month0].toLowerCase()}
              </p>

              {/* Saisie des initiales du jour sélectionné */}
              {selectedDate ? (
                <div ref={editorRef} className="mt-2 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold">
                      {dateLabel(selectedDate)}
                      {publicHolidayName(selectedDate) && (
                        <span className="ml-2 rounded bg-rose-100 px-1.5 text-[10px] font-semibold text-rose-800">
                          {publicHolidayName(selectedDate)}
                        </span>
                      )}
                    </p>
                    {busy && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                  </div>

                  {GUARD_ROWS.map((row) => {
                    const current = valuesOf(selectedDate, row)
                    return (
                      <div key={row}>
                        <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-slate-700">
                          {ROW_ICON[row]} {ROW_LABEL[row]}
                        </p>
                        {isAdmin ? (
                          <div className="flex flex-wrap gap-1.5">
                            {choices[row].map((doc) => {
                              const on = current.includes(doc)
                              return (
                                <button
                                  key={doc}
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void toggle(row, doc)}
                                  title={`${formatPersonLabel(doc)}${on ? " — toucher pour retirer" : ""}`}
                                  aria-pressed={on}
                                  className={cn(
                                    "min-w-[34px] rounded-md border px-2 py-1 text-sm font-black transition",
                                    on
                                      ? cn("border-transparent text-white shadow", DOCTOR_COLORS[doc] || "bg-slate-600")
                                      : "border-slate-300 bg-white text-slate-700 hover:border-blue-400 hover:bg-blue-50",
                                  )}
                                >
                                  {doc}
                                </button>
                              )
                            })}
                            {/* Remplaçants (texte libre) : toucher pour retirer */}
                            {current
                              .filter((v) => !isListedDoctor(v))
                              .map((v) => (
                                <button
                                  key={v}
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void toggle(row, v)}
                                  title={`${v} (remplaçant) — toucher pour retirer`}
                                  className="rounded-md bg-amber-100 px-2 py-1 text-sm font-bold text-amber-900"
                                >
                                  {v} ✕
                                </button>
                              ))}
                            <form
                              className="flex items-center gap-1"
                              onSubmit={(e) => {
                                e.preventDefault()
                                void addRemplacant(row)
                              }}
                            >
                              <input
                                value={remplacant}
                                onChange={(e) => setRemplacant(e.target.value)}
                                placeholder="Remplaçant"
                                maxLength={40}
                                aria-label={`Remplaçant ${ROW_LABEL[row]}`}
                                className="h-8 w-28 rounded-md border border-slate-300 px-2 text-sm"
                              />
                              <button
                                type="submit"
                                disabled={busy || !normalizeRemplacantLabel(remplacant)}
                                className="h-8 rounded-md border border-slate-300 px-2 text-sm font-bold disabled:opacity-40"
                              >
                                +
                              </button>
                            </form>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {current.length ? current.map((v) => <Initial key={v} code={v} />) : <span className="text-sm text-slate-400">Non attribuée</span>}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {isAdmin && (
                    <p className="text-[11px] text-slate-500">
                      Seuls les médecins disponibles sont proposés (congés, repos après garde, règles du planning). Un nouvel appui sur une initiale la retire.
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-xs text-slate-500">Aucun samedi, dimanche ou férié à afficher.</p>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
