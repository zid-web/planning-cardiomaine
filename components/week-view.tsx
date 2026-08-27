"use client"

import { CalendarDays, ChevronRight, Activity, Moon, Sun, Sunrise } from "lucide-react"
import { getSpecialActivityDisplayName } from "@/lib/special-activity-labels"
import { cn } from "@/lib/utils"
import { formatPersonLabel } from "@/lib/doctor-code"

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

function getPeriodIcon(activity: string) {
  if (activity.includes("Matin") || activity.includes("ATL Matin")) {
    return <Sunrise className="size-3.5 text-sky-500 shrink-0" />
  }
  if (activity.includes("Apm") || activity.includes("Midi") || activity.includes("Après-midi")) {
    return <Sun className="size-3.5 text-amber-500 shrink-0" />
  }
  if (activity.includes("Nuit") || activity.includes("Soir")) {
    return <Moon className="size-3.5 text-indigo-500 shrink-0" />
  }
  return <Activity className="size-3.5 text-slate-400 shrink-0" />
}

function getPeriodStyles(activity: string): string {
  if (activity.includes("Matin") || activity.includes("ATL Matin")) {
    return "bg-sky-50/70 border-l-4 border-l-sky-500 border-y border-r border-slate-100 hover:bg-sky-100/50 hover:border-l-sky-600 transition-all text-sky-900 font-bold"
  }
  if (activity.includes("Apm") || activity.includes("Midi") || activity.includes("Après-midi")) {
    return "bg-amber-50/70 border-l-4 border-l-amber-500 border-y border-r border-slate-100 hover:bg-amber-100/50 hover:border-l-amber-600 transition-all text-amber-900 font-bold"
  }
  if (activity.includes("Nuit") || activity.includes("Soir")) {
    return "bg-indigo-50/70 border-l-4 border-l-indigo-500 border-y border-r border-slate-100 hover:bg-indigo-100/50 hover:border-l-indigo-600 transition-all text-indigo-900 font-bold"
  }
  return "bg-slate-50/70 border-l-4 border-l-slate-400 border-y border-r border-slate-100 hover:bg-slate-100/50 hover:border-l-slate-500 transition-all text-slate-800 font-bold"
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
    <div className="mx-auto w-full max-w-7xl space-y-6 px-1 pb-8 md:px-4">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-xl shadow-slate-900/20">
        <div className="pointer-events-none absolute -right-10 -top-12 size-44 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 left-10 size-32 rounded-full bg-blue-400/10 blur-2xl" />
        <div className="relative flex items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-indigo-300 ring-1 ring-inset ring-indigo-400/30">
                Planning de la Semaine
              </span>
              {doctorCode && (
                <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold text-slate-200">
                  {formatPersonLabel(doctorCode)}
                </span>
              )}
            </div>
            <h3 className="text-2xl font-black tracking-tight text-white md:text-3xl">Ma Semaine {weekNumber}</h3>
            <p className="text-sm font-medium text-slate-300">
              {totalTasks} affectation{totalTasks === 1 ? "" : "s"} programmée{totalTasks === 1 ? "" : "s"} cette semaine
            </p>
          </div>

          <div className="rounded-2xl bg-white/10 p-3 backdrop-blur-sm ring-1 ring-white/15">
            <CalendarDays className="size-6 text-indigo-300" />
          </div>
        </div>
      </div>

      {/* Grid of Days (Responsive layout: 1 col on mobile, 7 cols on desktop) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-7 md:gap-3">
        {days.map((day, idx) => {
          const tasks = getUserTasks(day)
          const isToday = idx === currentDayIndex
          const dateNum = weekDates[idx]?.split("/")[0] || ""
          const isWeekend = day === "SAMEDI" || day === "DIMANCHE"

          return (
            <div
              key={day}
              className={cn(
                "flex flex-col rounded-2xl border transition-all duration-200 bg-white",
                isToday
                  ? "border-blue-300 shadow-md ring-1 ring-blue-300 bg-gradient-to-b from-blue-50/30 to-white"
                  : isWeekend
                    ? "border-slate-200 bg-slate-50/40"
                    : "border-slate-200/90 shadow-2xs hover:shadow-xs",
              )}
            >
              {/* Day Header (Clickable to jump to detail view) */}
              <button
                type="button"
                onClick={() => onSelectDay(idx)}
                className={cn(
                  "flex items-center justify-between p-3.5 border-b text-left w-full rounded-t-2xl transition-colors",
                  isToday 
                    ? "bg-blue-600/5 hover:bg-blue-600/10 border-blue-100" 
                    : "bg-slate-50/50 hover:bg-slate-100/50 border-slate-100"
                )}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex size-9 flex-col items-center justify-center rounded-xl text-center font-extrabold shadow-3xs",
                      isToday
                        ? "bg-blue-600 text-white"
                        : "bg-slate-200/80 text-slate-700",
                    )}
                  >
                    <span className="text-[14px] leading-none">{dateNum}</span>
                  </div>
                  <div>
                    <h4 className={cn("text-xs font-black tracking-tight uppercase", isToday ? "text-blue-700" : "text-slate-800")}>
                      {day.slice(0, 3)}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none">
                      {isWeekend ? "Weekend" : "Semaine"}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  {isToday && (
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-ping" />
                  )}
                  <ChevronRight className="size-3.5 text-slate-400" />
                </div>
              </button>

              {/* Day Activities List */}
              <div className="flex-1 p-3.5 flex flex-col gap-2 min-h-[90px] md:min-h-[140px]">
                {tasks.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {tasks.map((task) => (
                      <button
                        key={`${day}-${task}`}
                        type="button"
                        onClick={() => onSelectDay(idx)}
                        className={cn(
                          "w-full text-left rounded-xl p-2.5 text-xs shadow-3xs border flex items-start gap-2 transition-transform duration-150 hover:-translate-y-0.5",
                          getPeriodStyles(task)
                        )}
                      >
                        {getPeriodIcon(task)}
                        <span className="leading-tight">{activityDisplayLabel(task, day, doctorCode)}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-200 bg-slate-50/30 rounded-xl p-3 text-center">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide">Libre</span>
                    <span className="text-[9px] text-slate-400 leading-none mt-0.5">Aucune garde</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
