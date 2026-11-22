"use client"

import { getSpecialActivityDisplayName } from "@/lib/special-activity-labels"
import { cn } from "@/lib/utils"
import { formatPersonLabel } from "@/lib/doctor-code"
import {
  INK,
  PERIODS,
  PERIOD_COLORS,
  PULSE,
  kindOf,
  periodOf,
  prettyDate,
  shortLabel,
  todayKey,
  type PeriodKey,
} from "@/lib/planning-periods"

type WeekViewProps = {
  days: string[]
  weekDates: string[]
  weekNumber: number
  currentDayIndex: number
  doctorCode: string
  getUserTasks: (day: string) => string[]
  onSelectDay: (dayIndex: number) => void
}

const DAY_SHORT: Record<string, string> = {
  LUNDI: "Lun",
  MARDI: "Mar",
  MERCREDI: "Mer",
  JEUDI: "Jeu",
  VENDREDI: "Ven",
  SAMEDI: "Sam",
  DIMANCHE: "Dim",
}

const PERIOD_SHORT: Record<PeriodKey, string> = { jour: "", matin: "Matin", apm: "Apm", nuit: "Nuit" }

function label(activity: string, day: string, doctorCode: string): string {
  return getSpecialActivityDisplayName(activity, day, doctorCode) || shortLabel(activity)
}

/** Une vacation : pastille colorée selon le moment ; gardes et astreintes en rouge « cardio ». */
function TaskChip({ activity, day, doctorCode, dense, showPeriod }: { activity: string; day: string; doctorCode: string; dense?: boolean; showPeriod?: boolean }) {
  const p = periodOf(activity)
  const kind = kindOf(activity)
  const c = PERIOD_COLORS[p]
  const onCall = kind === "garde" || kind === "astreinte"
  const absent = kind === "absence"
  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-1.5 rounded-md font-semibold leading-tight",
        dense ? "px-1.5 py-1 text-[11px]" : "px-2 py-1.5 text-xs",
        absent && "italic",
      )}
      style={{
        background: onCall ? "#FDECEE" : c.soft,
        color: onCall ? "#8E1622" : absent ? "#475569" : c.ink,
        boxShadow: `inset 3px 0 0 ${onCall ? PULSE : c.solid}`,
      }}
    >
      {showPeriod && p !== "jour" && (
        <span className="shrink-0 text-[10px] font-medium opacity-70">{PERIOD_SHORT[p]}</span>
      )}
      <span className="truncate">{label(activity, day, doctorCode)}</span>
    </span>
  )
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
  const today = todayKey()
  const tasksByDay = days.map((day) => getUserTasks(day))
  const all = tasksByDay.flat()
  const counts = {
    gardes: all.filter((a) => kindOf(a) === "garde").length,
    astreintes: all.filter((a) => kindOf(a) === "astreinte").length,
    vacations: all.filter((a) => kindOf(a) === "vacation").length,
  }
  const range = weekDates.length ? `${prettyDate(weekDates[0])} – ${prettyDate(weekDates[weekDates.length - 1])}` : ""
  const byPeriod = (idx: number, p: PeriodKey) => tasksByDay[idx].filter((a) => periodOf(a) === p)

  return (
    <div className="mx-auto w-full max-w-7xl px-1 pb-8 md:px-4">
      {/* En-tête : numéro de semaine en grand, résumé à droite */}
      <header className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-slate-200 pb-4">
        <div className="flex items-end gap-3">
          <span
            className="text-5xl font-black leading-[0.85] tracking-tighter tabular-nums md:text-6xl"
            style={{ color: INK }}
          >
            S{weekNumber}
          </span>
          <div className="pb-0.5">
            <p className="text-sm font-semibold text-slate-900">Ma semaine{doctorCode ? ` · ${formatPersonLabel(doctorCode)}` : ""}</p>
            <p className="text-xs text-slate-500">{range}</p>
          </div>
        </div>
        <dl className="flex gap-5 text-right">
          {[
            { k: "Gardes", v: counts.gardes, color: PULSE },
            { k: "Astreintes", v: counts.astreintes, color: PULSE },
            { k: "Vacations", v: counts.vacations, color: INK },
          ].map((s) => (
            <div key={s.k}>
              <dd className="text-2xl font-bold tabular-nums leading-none" style={{ color: s.v ? s.color : "#CBD5E1" }}>
                {s.v}
              </dd>
              <dt className="mt-1 text-[11px] text-slate-500">{s.k}</dt>
            </div>
          ))}
        </dl>
      </header>

      {/* Légende du code couleur */}
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-slate-600">
        {PERIODS.map((p) => (
          <li key={p.key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: PERIOD_COLORS[p.key].solid }} />
            {p.label}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: PULSE }} />
          Garde / astreinte
        </li>
      </ul>

      {/* PC / tablette : grille moments × jours */}
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white md:block">
        <div className="grid grid-cols-[104px_repeat(7,minmax(0,1fr))]">
          <div className="border-b border-slate-200 bg-slate-50" />
          {days.map((day, idx) => {
            const isToday = weekDates[idx] === today
            const selected = idx === currentDayIndex
            const weekend = day === "SAMEDI" || day === "DIMANCHE"
            return (
              <button
                key={day}
                type="button"
                onClick={() => onSelectDay(idx)}
                title="Voir le détail du jour"
                className={cn(
                  "relative flex items-baseline gap-1.5 border-b border-l border-slate-200 px-3 py-2.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400",
                  weekend && "bg-slate-50/70",
                  selected && !isToday && "bg-slate-100",
                )}
              >
                {isToday && <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: PULSE }} />}
                <span className="text-2xl font-bold tabular-nums leading-none" style={{ color: isToday ? PULSE : INK }}>
                  {Number(weekDates[idx]?.split("/")[0] || 0)}
                </span>
                <span className={cn("text-xs font-medium", isToday ? "text-slate-900" : "text-slate-500")}>
                  {DAY_SHORT[day] ?? day}
                  {isToday && " · aujourd'hui"}
                </span>
              </button>
            )
          })}

          {PERIODS.map((p) => {
            const c = PERIOD_COLORS[p.key]
            return (
              <div key={p.key} className="contents">
                <div className="flex flex-col justify-center border-b border-slate-200 px-3 py-3" style={{ background: c.soft }}>
                  <span className="flex items-center gap-1.5 text-xs font-bold" style={{ color: c.ink }}>
                    <span className="h-3.5 w-1 rounded-full" style={{ background: c.solid }} />
                    {p.label}
                  </span>
                  <span className="mt-0.5 pl-2.5 text-[10px] text-slate-500">{p.hours}</span>
                </div>
                {days.map((day, idx) => {
                  const items = byPeriod(idx, p.key)
                  const isToday = weekDates[idx] === today
                  const weekend = day === "SAMEDI" || day === "DIMANCHE"
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => onSelectDay(idx)}
                      className={cn(
                        "flex min-h-[64px] flex-col gap-1 border-b border-l border-slate-200 p-1.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400",
                        weekend && "bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgba(148,163,184,0.08)_6px_7px)]",
                        isToday && "bg-rose-50/30",
                      )}
                    >
                      {items.map((a) => (
                        <TaskChip key={a} activity={a} day={day} doctorCode={doctorCode} dense />
                      ))}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Téléphone : agenda jour par jour */}
      <ol className="space-y-2 md:hidden">
        {days.map((day, idx) => {
          const isToday = weekDates[idx] === today
          const tasks = tasksByDay[idx]
          const weekend = day === "SAMEDI" || day === "DIMANCHE"
          return (
            <li key={day}>
              <button
                type="button"
                onClick={() => onSelectDay(idx)}
                className={cn(
                  "flex w-full items-stretch gap-3 rounded-xl border bg-white p-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
                  isToday ? "border-transparent" : "border-slate-200",
                  weekend && !isToday && "bg-slate-50",
                )}
                style={isToday ? { boxShadow: `0 0 0 2px ${PULSE}` } : undefined}
              >
                <div className="flex w-11 shrink-0 flex-col items-center justify-center">
                  <span className="text-[11px] font-medium text-slate-500">{DAY_SHORT[day] ?? day}</span>
                  <span className="text-2xl font-bold tabular-nums leading-none" style={{ color: isToday ? PULSE : INK }}>
                    {Number(weekDates[idx]?.split("/")[0] || 0)}
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                  {tasks.length ? (
                    PERIODS.map((p) => byPeriod(idx, p.key)).flat().map((a) => (
                      <TaskChip key={a} activity={a} day={day} doctorCode={doctorCode} showPeriod />
                    ))
                  ) : (
                    <span className="text-xs text-slate-400">Rien de prévu</span>
                  )}
                </div>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
