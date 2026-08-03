"use client"

import { CalendarDays, ChevronRight } from "lucide-react"
import { getSpecialActivityDisplayName } from "@/lib/special-activity-labels"
import { cn } from "@/lib/utils"

type WeekViewProps = {
  days: string[]
  weekDates: string[]
  weekNumber: number
  currentDayIndex: number
  doctorCode: string
  getUserTasks: (day: string) => string[]
  onSelectDay: (dayIndex: number) => void
}

function cleanActivityLabel(activity: string): string {
  return activity
    .replace("Matin - ", "")
    .replace("Apm - ", "")
    .replace("Hors site - ", "")
    .replace("Astreintes ATL ", "Astreinte ")
    .replace("1/2 journée off ", "½ off ")
}

function activityDisplayLabel(activity: string, day: string, doctorCode: string): string {
  return getSpecialActivityDisplayName(activity, day, doctorCode) || cleanActivityLabel(activity)
}

function periodTone(activity: string): string {
  if (activity.includes("Matin") || activity.includes("ATL Matin")) return "bg-sky-50 text-sky-800 border-sky-100"
  if (activity.includes("Apm") || activity.includes("Midi") || activity.includes("Après-midi")) {
    return "bg-amber-50 text-amber-900 border-amber-100"
  }
  if (activity.includes("Nuit") || activity.includes("Soir")) return "bg-indigo-50 text-indigo-900 border-indigo-100"
  return "bg-slate-50 text-slate-700 border-slate-100"
}

export function WeekView({
  days,
  weekDates,
  weekNumber,
  currentDayIndex,
  doctorCode,
  getUserTasks,
  onSelectDay,
}: WeekViewProps) {
  const totalTasks = days.reduce((acc, day) => acc + getUserTasks(day).length, 0)

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 px-2 pb-6 sm:px-4">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-5 text-white shadow-xl shadow-slate-900/20">
        <div className="pointer-events-none absolute -right-10 -top-12 size-44 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 left-10 size-32 rounded-full bg-blue-400/10 blur-2xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-indigo-300 ring-1 ring-inset ring-indigo-400/30">
                Vue Personnelle
              </span>
              {doctorCode && (
                <span className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
                  Dr. {doctorCode}
                </span>
              )}
            </div>
            <h3 className="text-2xl font-black tracking-tight text-white">Ma Semaine {weekNumber}</h3>
            <p className="text-sm font-medium text-slate-300">
              {totalTasks} affectation{totalTasks === 1 ? "" : "s"} sur la semaine
            </p>
          </div>

          <div className="rounded-2xl bg-white/10 p-3 backdrop-blur-sm ring-1 ring-white/15">
            <CalendarDays className="size-6 text-indigo-300" />
          </div>
        </div>
      </div>

      {/* Days List */}
      <div className="space-y-3">
        {days.map((day, idx) => {
          const tasks = getUserTasks(day)
          const isToday = idx === currentDayIndex
          const dateNum = weekDates[idx]?.split("/")[0] || ""
          const isWeekend = day === "SAMEDI" || day === "DIMANCHE"

          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelectDay(idx)}
              className={cn(
                "group w-full rounded-2xl border p-4 text-left shadow-xs transition-all duration-200",
                "hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                isToday
                  ? "border-blue-300 bg-gradient-to-br from-blue-50/90 via-white to-white ring-1 ring-blue-300"
                  : isWeekend
                    ? "border-slate-200/90 bg-slate-50/60"
                    : "border-slate-200 bg-white",
              )}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3.5">
                  <div
                    className={cn(
                      "flex size-12 flex-col items-center justify-center rounded-2xl text-center shadow-xs transition-colors",
                      isToday
                        ? "bg-slate-950 text-white shadow-slate-900/20"
                        : "bg-slate-100 text-slate-700 group-hover:bg-slate-200/80",
                    )}
                  >
                    <span className={cn("text-[9px] font-extrabold uppercase tracking-wider", isToday ? "text-blue-300" : "text-slate-400")}>
                      {day.slice(0, 3)}
                    </span>
                    <span className="text-base font-extrabold tabular-nums leading-none">{dateNum}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className={cn("text-base font-bold tracking-tight", isToday ? "text-blue-900" : "text-slate-900")}>
                        {day}
                      </h4>
                      {isToday && (
                        <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-xs">
                          Aujourd&apos;hui
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-slate-500">
                      {tasks.length > 0
                        ? `${tasks.length} activité${tasks.length === 1 ? "" : "s"}`
                        : "Aucune affectation"}
                    </p>
                  </div>
                </div>
                <ChevronRight
                  className={cn(
                    "size-5 text-slate-300 transition-all duration-200 group-hover:translate-x-1 group-hover:text-slate-600",
                  )}
                />
              </div>

              {tasks.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {tasks.map((task) => (
                    <span
                      key={`${day}-${task}`}
                      className={cn(
                        "rounded-xl border px-2.5 py-1 text-xs font-bold shadow-2xs",
                        periodTone(task),
                      )}
                    >
                      {activityDisplayLabel(task, day, doctorCode)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-3 py-2 text-xs italic font-medium text-slate-400">
                  Pas d&apos;activité programmée
                </p>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
