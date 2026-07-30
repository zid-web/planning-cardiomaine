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
    <div className="mx-auto w-full max-w-lg space-y-4 px-2 pb-4 sm:px-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Vue personnelle</p>
            <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
              Ma semaine {weekNumber}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Dr. {doctorCode || "—"} · {totalTasks} affectation{totalTasks === 1 ? "" : "s"}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-900 p-3 text-white shadow-md">
            <CalendarDays className="size-5" />
          </div>
        </div>
      </div>

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
                "group w-full rounded-2xl border p-3.5 text-left shadow-sm transition-all duration-200",
                "hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400",
                isToday
                  ? "border-sky-300 bg-gradient-to-br from-sky-50 via-white to-white ring-1 ring-sky-200"
                  : isWeekend
                    ? "border-slate-200 bg-slate-50/80"
                    : "border-slate-200 bg-white",
              )}
            >
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex size-11 flex-col items-center justify-center rounded-xl text-center",
                      isToday ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700",
                    )}
                  >
                    <span className={cn("text-[9px] font-semibold uppercase", isToday ? "text-slate-300" : "text-slate-400")}>
                      {day.slice(0, 3)}
                    </span>
                    <span className="text-sm font-bold tabular-nums leading-none">{dateNum}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className={cn("text-sm font-semibold", isToday ? "text-sky-800" : "text-slate-900")}>
                        {day}
                      </h4>
                      {isToday && (
                        <span className="rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                          Aujourd&apos;hui
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      {tasks.length > 0
                        ? `${tasks.length} activité${tasks.length === 1 ? "" : "s"}`
                        : "Repos"}
                    </p>
                  </div>
                </div>
                <ChevronRight
                  className={cn(
                    "size-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500",
                  )}
                />
              </div>

              {tasks.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {tasks.map((task) => (
                    <span
                      key={`${day}-${task}`}
                      className={cn(
                        "rounded-lg border px-2 py-1 text-[11px] font-medium",
                        periodTone(task),
                      )}
                    >
                      {activityDisplayLabel(task, day, doctorCode)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-slate-200 bg-white/70 px-3 py-2 text-xs italic text-slate-400">
                  Pas d&apos;affectation ce jour
                </p>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
