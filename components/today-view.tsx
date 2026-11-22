"use client"

import { Edit3, MessageSquare, Plus, UserCircle, Lock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ACTIVITY_ICONS, DAYS, DOCTOR_COLORS } from "@/lib/constants"
import {
  appendSpecialDoctorLabel,
  getSpecialActivityDisplayNameForDoctors,
} from "@/lib/special-activity-labels"
import { cn } from "@/lib/utils"
import { formatPersonLabel } from "@/lib/doctor-code"
import { INK, PERIODS, PERIOD_COLORS, PULSE, currentPeriod, kindOf, periodOf, prettyDate, todayKey } from "@/lib/planning-periods"

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
  /** Ouvre le panneau Messagerie & Demandes (onglet Messages), pour écrire à un admin. */
  onOpenMessages?: () => void
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
  onOpenMessages,
}: TodayViewProps) {

  const myTasks = tasks.filter((task) => task.doctors.includes(doctorCode))
  const hasNote = Boolean(dayNote?.trim())
  const dayName = days[currentDayIndex] || DAYS[currentDayIndex]
  const dateLabel = weekDates[currentDayIndex] || ""
  const isRealToday = dateLabel === todayKey()
  const nowPeriod = isRealToday ? currentPeriod() : null
  const dayTitle = dayName.charAt(0) + dayName.slice(1).toLowerCase()
  const onCallCount = myTasks.filter((t) => ["garde", "astreinte"].includes(kindOf(t.activity))).length
  const visiblePeriods = PERIODS.filter((p) => p.key !== "jour" || myTasks.some((t) => periodOf(t.activity) === "jour"))

  return (
    <div className="mx-auto w-full max-w-5xl px-2 pb-8 sm:px-4">
      {/* Bande des jours */}
      <nav aria-label="Jours de la semaine" className="mb-5 grid grid-cols-7 gap-1 border-b border-slate-200">
        {days.map((day, idx) => {
          const selected = idx === currentDayIndex
          const date = weekDates[idx]?.split("/")[0] || ""
          const isToday = weekDates[idx] === todayKey()
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelectDay(idx)}
              aria-current={selected ? "date" : undefined}
              className={cn(
                "relative flex flex-col items-center pb-2 pt-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 rounded-t-md",
                selected ? "text-slate-900" : "text-slate-400 hover:text-slate-700",
              )}
            >
              <span className="text-[11px] font-medium">{day.charAt(0) + day.slice(1, 3).toLowerCase()}</span>
              <span
                className="text-lg font-bold tabular-nums leading-tight"
                style={isToday ? { color: PULSE } : selected ? { color: INK } : undefined}
              >
                {Number(date)}
              </span>
              {selected && <span className="absolute inset-x-2 -bottom-px h-[3px] rounded-full" style={{ background: INK }} />}
            </button>
          )
        })}
      </nav>

      {/* En-tête du jour */}
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-4xl font-black leading-none tracking-tight md:text-5xl" style={{ color: INK }}>
            {dayTitle}
          </h3>
          <p className="mt-1.5 text-sm text-slate-500">
            {prettyDate(dateLabel)}
            {isRealToday && <span className="font-semibold" style={{ color: PULSE }}> · aujourd&apos;hui</span>}
            {doctorCode && <> · {formatPersonLabel(doctorCode)}</>}
          </p>
        </div>
        <p className="text-sm text-slate-600">
          <span className="text-2xl font-bold tabular-nums" style={{ color: INK }}>{myTasks.length}</span> créneau
          {myTasks.length === 1 ? "" : "x"}
          {onCallCount > 0 && (
            <>
              {" "}dont <span className="font-bold" style={{ color: PULSE }}>{onCallCount}</span> de garde/astreinte
            </>
          )}
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_300px]">
        {/* Fil de la journée */}
        <section aria-label="Mon planning du jour">
          {myTasks.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
              <UserCircle className="mb-2 size-8 text-slate-300" />
              <p className="text-sm font-semibold text-slate-800">Rien de prévu pour vous ce jour-là</p>
              <p className="mt-1 max-w-xs text-xs text-slate-500">Le planning de toute l&apos;équipe est dans l&apos;onglet Global.</p>
            </div>
          ) : (
            <ol className="relative">
              {visiblePeriods.map((p, i) => {
                const c = PERIOD_COLORS[p.key]
                const items = myTasks.filter((t) => periodOf(t.activity) === p.key)
                const isNow = nowPeriod === p.key
                const last = i === visiblePeriods.length - 1
                return (
                  <li key={p.key} className="relative grid grid-cols-[84px_minmax(0,1fr)] gap-2.5 sm:grid-cols-[104px_minmax(0,1fr)] sm:gap-3">
                    {/* Colonne horaire + rail coloré */}
                    <div className="relative pb-5 pt-1 text-right">
                      <p className="whitespace-nowrap text-[13px] font-bold sm:text-sm" style={{ color: c.ink }}>{p.label}</p>
                      <p className="text-[10px] leading-tight text-slate-400">{p.hours}</p>
                      {isNow && (
                        <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: PULSE }}>
                          <svg viewBox="0 0 40 16" className="h-3.5 w-8" aria-hidden="true">
                            <path d="M0 8 H12 L15 3 L19 14 L23 1 L26 8 H40" fill="none" stroke={PULSE} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
                          </svg>
                          Maintenant
                        </p>
                      )}
                    </div>
                    <div className="relative pb-5 pl-4">
                      <span
                        className={cn("absolute left-0 top-1.5 w-[3px] rounded-full", last ? "bottom-5" : "-bottom-1.5")}
                        style={{ background: c.solid, opacity: items.length ? 1 : 0.25 }}
                      />
                      <span
                        className="absolute -left-[4px] top-1.5 size-[11px] rounded-full border-2 bg-white"
                        style={{ borderColor: isNow ? PULSE : c.solid }}
                      />
                      {items.length === 0 ? (
                        <p className="pt-0.5 text-xs text-slate-400">Libre</p>
                      ) : (
                        <div className="space-y-2">
                          {items.map((task, idx) => {
                            const kind = kindOf(task.activity)
                            const onCall = kind === "garde" || kind === "astreinte"
                            const others = task.doctors.filter((d) => d !== doctorCode)
                            const iconKey = Object.keys(ACTIVITY_ICONS).find((k) => task.activity.includes(k)) || ""
                            return (
                              <article
                                key={`${task.activity}-${idx}`}
                                className={cn(
                                  "rounded-lg border bg-white px-3 py-2.5",
                                  task.isSolverProposal ? "border-violet-300 border-dashed" : "border-slate-200",
                                )}
                                style={onCall ? { borderColor: "#F3B5BB", background: "#FFF7F8" } : undefined}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="min-w-0 text-[15px] font-semibold leading-snug text-slate-900">
                                    {ACTIVITY_ICONS[iconKey] && <span className="mr-1.5">{ACTIVITY_ICONS[iconKey]}</span>}
                                    {activityDisplayLabel(task.activity, dayName, task.doctors)}
                                  </p>
                                  <div className="flex shrink-0 gap-1">
                                    {onCall && (
                                      <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ background: PULSE }}>
                                        {kind === "garde" ? "Garde" : "Astreinte"}
                                      </span>
                                    )}
                                    {task.isSolverProposal ? (
                                      <span className="rounded bg-violet-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">Proposition</span>
                                    ) : (
                                      task.status === "pending" && (
                                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">En attente</span>
                                      )
                                    )}
                                  </div>
                                </div>
                                {others.length > 0 && (
                                  <div className="mt-2 flex flex-wrap items-center gap-1">
                                    <span className="mr-0.5 text-[11px] text-slate-500">Avec</span>
                                    {others.map((doc) => (
                                      <Badge
                                        key={doc}
                                        className={cn("border-none px-1.5 py-0 text-[11px] font-bold text-white", DOCTOR_COLORS[doc] || "bg-slate-600")}
                                      >
                                        {appendSpecialDoctorLabel(doc, task.activity, dayName, doc)}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </article>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </section>

        {/* Notes */}
        <aside className="space-y-3">
          <NoteCard
            icon={<MessageSquare className="size-4" />}
            title="Note du jour"
            hint={isAdmin ? "Partagée avec toute l’équipe" : "Partagée avec toute l’équipe"}
            text={hasNote ? dayNote : ""}
            empty={isAdmin ? "Aucune note. Ajoutez une consigne pour l’équipe." : "Aucune note pour ce jour."}
            action={isAdmin ? (hasNote ? "Modifier" : "Ajouter") : undefined}
            onClick={isAdmin ? onEditNote : undefined}
            tone="blue"
          />
          {!isAdmin && (
            <NoteCard
              icon={<Lock className="size-4" />}
              title="Note privée"
              hint="Visible par vous et l’administrateur"
              text={myPrivateNote?.trim() || ""}
              empty="Aucune note privée. Écrivez à un administrateur."
              action="Écrire"
              onClick={onOpenMessages}
              tone="amber"
            />
          )}
          {isAdmin && onEditPrivateNote && (
            <NoteCard
              icon={<Lock className="size-4" />}
              title="Note privée à un médecin"
              hint="Visible seulement par ce médecin"
              text=""
              empty="Choisissez un médecin et écrivez-lui."
              action="Écrire"
              onClick={onEditPrivateNote}
              tone="amber"
            />
          )}
        </aside>
      </div>
    </div>
  )
}

function NoteCard({
  icon,
  title,
  hint,
  text,
  empty,
  action,
  onClick,
  tone,
}: {
  icon: React.ReactNode
  title: string
  hint: string
  text: string
  empty: string
  action?: string
  onClick?: () => void
  tone: "blue" | "amber"
}) {
  const color = tone === "blue" ? "#2F7FD8" : "#C77D0A"
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md text-white" style={{ background: color }}>
            {icon}
          </span>
          <div>
            <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
            <p className="text-[11px] text-slate-500">{hint}</p>
          </div>
        </div>
        {action && (
          <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 group-hover:bg-slate-50">
            {action === "Ajouter" ? <Plus className="size-3.5" /> : <Edit3 className="size-3.5" />}
            {action}
          </span>
        )}
      </div>
      <p className={cn("mt-2.5 text-sm leading-relaxed", text ? "text-slate-700" : "text-slate-400")}>{text || empty}</p>
    </>
  )
  const cls = "group block w-full rounded-xl border border-slate-200 bg-white p-3.5 text-left"
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={cn(cls, "transition-colors hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400")}
      style={{ borderTop: `3px solid ${color}` }}
    >
      {body}
    </button>
  ) : (
    <div className={cls} style={{ borderTop: `3px solid ${color}` }}>
      {body}
    </div>
  )
}
