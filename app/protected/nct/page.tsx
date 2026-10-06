"use client"

/**
 * Espace réservé aux comptes « NCT seul » (ex. C) : consultation du calendrier
 * NCT, sans accès au planning. Les admins peuvent aussi l'ouvrir.
 */

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { loadNctCalendar } from "@/app/actions/nct-calendar-actions"
import { signOut } from "@/app/actions/auth-actions"
import { buildMonthGrid, shiftMonth, type NctEntry } from "@/lib/nct-calendar"
import { isNctOnlyAccount } from "@/lib/nct-only"
import { publicHolidayName, schoolHolidayZoneB } from "@/lib/french-calendar"
import { cn } from "@/lib/utils"

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
]
const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"]
const USER_STYLE: Record<string, string> = {
  W: "bg-blue-600 text-white",
  M: "bg-violet-600 text-white",
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export default function NctOnlyPage() {
  const supabase = createClient()
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [calendar, setCalendar] = useState<NctEntry[]>([])
  const [cursor, setCursor] = useState(() => {
    const t = todayIso()
    return { year: Number(t.slice(0, 4)), month0: Number(t.slice(5, 7)) - 1 }
  })

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser()
      if (!data?.user) {
        router.replace("/auth/login")
        return
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, doctor_code")
        .eq("id", data.user.id)
        .single()
      if (profile?.role !== "admin" && !isNctOnlyAccount(profile)) {
        router.replace("/protected/planning")
        return
      }
      setCalendar(await loadNctCalendar())
      setReady(true)
    }
    void init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const byDate = useMemo(() => new Map(calendar.map((e) => [e.date, e.user])), [calendar])
  const monthEntries = useMemo(() => {
    const prefix = `${cursor.year}-${String(cursor.month0 + 1).padStart(2, "0")}-`
    return calendar.filter((e) => e.date.startsWith(prefix))
  }, [calendar, cursor])

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut({ scope: "global" })
    } catch {}
    try {
      await signOut()
    } catch {}
    window.location.href = "/auth/login"
  }

  if (!ready) {
    return <div className="flex h-screen items-center justify-center text-slate-500">Chargement…</div>
  }

  const grid = buildMonthGrid(cursor.year, cursor.month0)
  const today = todayIso()

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-3 bg-white p-4 text-slate-900">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Calendrier NCT</h1>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
        >
          <LogOut className="h-4 w-4" /> Déconnexion
        </button>
      </header>

      <div className="flex items-center gap-1 rounded-md bg-slate-50 px-2 py-2">
        <button
          type="button"
          onClick={() => setCursor((c) => shiftMonth(c.year, c.month0, -1))}
          className="rounded-md p-1.5 text-slate-600 hover:bg-slate-200"
          aria-label="Mois précédent"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="flex-1 text-center text-base font-bold">
          {MONTHS[cursor.month0]} {cursor.year}
        </span>
        <button
          type="button"
          onClick={() => setCursor((c) => shiftMonth(c.year, c.month0, 1))}
          className="rounded-md p-1.5 text-slate-600 hover:bg-slate-200"
          aria-label="Mois suivant"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => {
            const t = todayIso()
            setCursor({ year: Number(t.slice(0, 4)), month0: Number(t.slice(5, 7)) - 1 })
          }}
          className="ml-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
        >
          Aujourd&apos;hui
        </button>
      </div>

      <div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-500">
          {WEEKDAYS.map((d, i) => (
            <div key={i}>{d}</div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {grid.flat().map((cell) => {
            const user = byDate.get(cell.date) ?? null
            const ferie = publicHolidayName(cell.date)
            const vacances = schoolHolidayZoneB(cell.date)
            return (
              <div
                key={cell.date}
                title={[ferie ? `Férié : ${ferie}` : null, vacances ? `Vacances zone B : ${vacances.name}` : null].filter(Boolean).join(" · ")}
                className={cn(
                  "flex h-11 flex-col items-center justify-center rounded-md border text-sm",
                  !cell.inMonth && "opacity-35",
                  user
                    ? cn("border-transparent font-bold", USER_STYLE[user] ?? "bg-slate-700 text-white")
                    : ferie
                      ? "border-rose-300 bg-rose-100 font-semibold text-rose-800"
                      : vacances
                        ? "border-amber-200 bg-amber-100 text-amber-900"
                        : "border-slate-200 bg-white text-slate-800",
                  cell.date === today && !user && "ring-2 ring-slate-900/70",
                )}
              >
                <span className="leading-none">{cell.day}</span>
                {user && <span className="text-[10px] font-semibold leading-none opacity-90">{user}</span>}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm border border-rose-300 bg-rose-100" /> Jour férié
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm border border-amber-200 bg-amber-100" /> Vacances scolaires (zone B)
        </span>
      </div>

      <section>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {monthEntries.length
            ? `${monthEntries.length} NCT en ${MONTHS[cursor.month0].toLowerCase()}`
            : "Aucun NCT ce mois-ci"}
        </p>
        <ul className="space-y-1">
          {monthEntries.map((e) => (
            <li key={e.date} className="flex items-center justify-between rounded-md border border-slate-200 px-2 py-1 text-sm">
              <span>{e.date.slice(8)}/{e.date.slice(5, 7)}/{e.date.slice(0, 4)}</span>
              <span className={cn("rounded px-2 text-xs font-bold", USER_STYLE[e.user] ?? "bg-slate-700 text-white")}>{e.user}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
