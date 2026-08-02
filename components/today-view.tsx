"use client"

import { Calendar, Edit3, MessageSquare, Plus, Sun, Moon, Sunrise, UserCircle, Lock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ACTIVITY_ICONS, DAYS, DOCTOR_COLORS } from "@/lib/constants"
import {
  appendSpecialDoctorLabel,
  getSpecialActivityDisplayNameForDoctors,
} from "@/lib/special-activity-labels"
import { cn } from "@/lib/utils"

export type DayTask = {
  activity: string
  doctors: string[]
  status: "validated" | "pending"
  /** Proposition solveur « Générer » (pas une demande de changement). */
  isSolverProposal?: boolean
}

type TodayViewProps = {
  days: string[]
  weekDates: string[]
  currentDayIndex: number
  doctorCode: string
  dayNote: string
  tasks: DayTask[]
  onSelectDay: (dayIndex: number) => void
  onEditNote: () => void
  /** Note privée admin -> médecin, visible uniquement du destinataire (confirmé 01/08/2026). */
  myPrivateNote?: string
  isAdmin?: boolean
  onEditPrivateNote?: () => void
}

function periodMeta(activity: string): { label: string; Icon: typeof Sun; accent: string; chip: string } {
  if (activity.includes("Matin") || activity.includes("ATL Matin") || activity.includes("Garde Matin")) {
    return {
      label: "Matin",
      Icon: Sunrise,
      accent: "from-sky-500/15 via-white to-white border-sky-200",
      chip: "bg-sky-100 text-sky-800",
    }
  }
  if (
    activity.includes("Apm") ||
    activity.includes("Après-midi") ||
    activity.includes("Midi") ||
    activity.includes("ATL Midi")
  ) {
    return {
      label: "Après-midi",
      Icon: Sun,
      accent: "from-amber-500/15 via-white to-white border-amber-200",
      chip: "bg-amber-100 text-amber-900",
    }
  }
  if (activity.includes("Nuit") || activity.includes("Soir")) {
    return {
      label: "Nuit",
      Icon: Moon,
      accent: "from-indigo-500/15 via-white to-white border-indigo-200",
      chip: "bg-indigo-100 text-indigo-900",
    }
  }
  return {
    label: "Journée",
    Icon: Calendar,
    accent: "from-slate-500/10 via-white to-white border-slate-200",
    chip: "bg-slate-100 text-slate-700",
  }
}

function cleanActivityLabel(activity: string): string {
  return activity
    .replace("Matin - ", "")
    .replace("Apm - ", "")
    .replace("Hors site - ", "")
    .replace("Astreintes ATL ", "Astreinte ")
}

function activityDisplayLabel(activity: string, day: string, doctors: string[]): string {
  return (
    getSpecialActivityDisplayNameForDoctors(activity, day, doctors) ||
    cleanActivityLabel(activity)
  )
}

export function TodayView({
  days,
  weekDates,
  currentDayIndex,
  doctorCode,
  dayNote,
  tasks,
  onSelectDay,
  onEditNote,
  myPrivateNote,
  isAdmin,
  onEditPrivateNote,
}: TodayViewProps) {
  const myTasks = tasks.filter((task) => task.doctors.includes(doctorCode))
  const hasNote = Boolean(dayNote?.trim())
  const dayName = days[currentDayIndex] || DAYS[currentDayIndex]
  const dateLabel = weekDates[currentDayIndex] || ""

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 px-2 pb-4 sm:px-4">
      {/* Day strip */}
      <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-2 shadow-sm backdrop-blur">
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, idx) => {
            const selected = idx === currentDayIndex
            const date = weekDates[idx]?.split("/")[0] || ""
            return (
              <button
                key={day}
                type="button"
                onClick={() => onSelectDay(idx)}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center rounded-xl px-1 py-2 transition-all duration-200",
                  selected
                    ? "bg-slate-900 text-white shadow-md shadow-slate-300 scale-[1.02]"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                <span
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-wide",
                    selected ? "text-slate-300" : "text-slate-400",
                  )}
                >
                  {day.slice(0, 3)}
                </span>
                <span className="text-base font-bold tabular-nums">{date}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900 p-5 text-white shadow-xl shadow-slate-300/40">
        <div className="pointer-events-none absolute -right-8 -top-10 size-36 rounded-full bg-sky-400/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 left-10 size-28 rounded-full bg-teal-300/10 blur-2xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-sky-200/90">Aujourd&apos;hui</p>
            <h3 className="mt-1 text-2xl font-semibold tracking-tight">{dayName}</h3>
            <p className="mt-1 text-sm text-slate-300">{dateLabel}</p>
            <p className="mt-3 inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 text-xs text-slate-200 ring-1 ring-white/15">
              {myTasks.length} activité{myTasks.length === 1 ? "" : "s"} · Dr. {doctorCode || "—"}
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15">
            <Calendar className="size-6 text-sky-200" />
          </div>
        </div>
      </div>

      {/* Interactive notes - édition réservée à l'admin (confirmé 01/08/2026) */}
      {isAdmin ? (
        <button
          type="button"
          onClick={onEditNote}
          className={cn(
            "group w-full rounded-2xl border p-4 text-left shadow-sm transition-all duration-200",
            "hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400",
            hasNote
              ? "border-sky-200 bg-gradient-to-br from-sky-50 to-white"
              : "border-dashed border-slate-300 bg-white hover:border-sky-300",
          )}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-xl bg-sky-100 text-sky-700 ring-1 ring-sky-200">
                <MessageSquare className="size-4" />
              </span>
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Notes du jour</h4>
                <p className="text-[11px] text-slate-500">Partagée avec toute l’équipe · appuyez pour modifier</p>
              </div>
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition",
                hasNote
                  ? "bg-sky-600 text-white group-hover:bg-sky-700"
                  : "bg-slate-900 text-white group-hover:bg-slate-800",
              )}
            >
              {hasNote ? <Edit3 className="size-3.5" /> : <Plus className="size-3.5" />}
              {hasNote ? "Modifier" : "Ajouter"}
            </span>
          </div>
          <div
            className={cn(
              "min-h-[64px] rounded-xl px-3 py-2.5 text-sm leading-relaxed",
              hasNote ? "bg-white/80 text-slate-700" : "bg-slate-50 text-slate-400 italic",
            )}
          >
            {hasNote ? dayNote : "Aucune note pour ce jour. Ajoutez un rappel, une consigne…"}
          </div>
        </button>
      ) : (
        <div
          className={cn(
            "w-full rounded-2xl border p-4 shadow-sm",
            hasNote
              ? "border-sky-200 bg-gradient-to-br from-sky-50 to-white"
              : "border-dashed border-slate-300 bg-white",
          )}
        >
          <div className="mb-2 flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-xl bg-sky-100 text-sky-700 ring-1 ring-sky-200">
              <MessageSquare className="size-4" />
            </span>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Notes du jour</h4>
              <p className="text-[11px] text-slate-500">Partagée avec toute l’équipe</p>
            </div>
          </div>
          <div
            className={cn(
              "min-h-[48px] rounded-xl px-3 py-2.5 text-sm leading-relaxed",
              hasNote ? "bg-white/80 text-slate-700" : "bg-slate-50 text-slate-400 italic",
            )}
          >
            {hasNote ? dayNote : "Aucune note pour ce jour."}
          </div>
        </div>
      )}

      {/* Note privée admin -> médecin (confirmé 01/08/2026) : visible
          uniquement du destinataire, jamais des autres utilisateurs. */}
      {!isAdmin && (
        <div
          className={cn(
            "w-full rounded-2xl border p-4 shadow-sm",
            myPrivateNote?.trim()
              ? "border-amber-200 bg-gradient-to-br from-amber-50 to-white"
              : "border-dashed border-slate-300 bg-white",
          )}
        >
          <div className="mb-2 flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700 ring-1 ring-amber-200">
              <Lock className="size-4" />
            </span>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Note privée pour vous</h4>
              <p className="text-[11px] text-slate-500">Visible uniquement par vous et l’administrateur</p>
            </div>
          </div>
          <div
            className={cn(
              "min-h-[48px] rounded-xl px-3 py-2.5 text-sm leading-relaxed",
              myPrivateNote?.trim() ? "bg-white/80 text-slate-700" : "bg-slate-50 text-slate-400 italic",
            )}
          >
            {myPrivateNote?.trim() || "Aucune note privée pour l’instant."}
          </div>
        </div>
      )}
      {isAdmin && onEditPrivateNote && (
        <button
          type="button"
          onClick={onEditPrivateNote}
          className="group w-full rounded-2xl border border-dashed border-amber-300 bg-white p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-md"
        >
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700 ring-1 ring-amber-200">
              <Lock className="size-4" />
            </span>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Note privée à un médecin</h4>
              <p className="text-[11px] text-slate-500">Visible seulement de lui, pas des autres utilisateurs</p>
            </div>
          </div>
        </button>
      )}

      {/* Tasks */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-sm font-semibold text-slate-900">Mon planning</h4>
          <span className="text-xs text-slate-500">{myTasks.length} créneau{myTasks.length === 1 ? "" : "x"}</span>
        </div>

        {myTasks.length > 0 ? (
          <div className="space-y-2.5">
            {myTasks.map((task, idx) => {
              const meta = periodMeta(task.activity)
              const Icon = meta.Icon
              const iconKey = Object.keys(ACTIVITY_ICONS).find((k) => task.activity.includes(k)) || ""
              return (
                <div
                  key={`${task.activity}-${idx}`}
                  className={cn(
                    "rounded-2xl border bg-gradient-to-r p-3.5 shadow-sm transition hover:shadow-md",
                    meta.accent,
                    task.isSolverProposal && "ring-2 ring-violet-400/80 bg-violet-50/40",
                    task.status === "pending" &&
                      !task.isSolverProposal &&
                      "ring-1 ring-amber-300",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white text-lg shadow-sm ring-1 ring-black/5">
                      {ACTIVITY_ICONS[iconKey] || <Icon className="size-5 text-slate-500" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", meta.chip)}>
                          {meta.label}
                        </span>
                        {task.isSolverProposal ? (
                          <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                            Prop. Générer
                          </span>
                        ) : (
                          task.status === "pending" && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                              En attente
                            </span>
                          )
                        )}
                      </div>
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {activityDisplayLabel(task.activity, dayName, task.doctors)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {task.doctors.map((doc) => (
                          <Badge
                            key={doc}
                            className={cn(
                              "border-none px-1.5 py-0 text-[10px] text-white",
                              DOCTOR_COLORS[doc] || "bg-slate-500",
                              doc === doctorCode && "ring-2 ring-offset-1 ring-slate-900/30",
                            )}
                          >
                            {appendSpecialDoctorLabel(doc, task.activity, dayName, doc)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white px-4 py-12 text-center shadow-sm">
            <div className="mb-3 rounded-full bg-slate-100 p-3">
              <UserCircle className="size-7 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-700">Aucune activité prévue pour vous</p>
            <p className="mt-1 max-w-xs text-xs text-slate-500">
              Consultez l&apos;onglet Global pour le planning complet de l&apos;équipe.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
