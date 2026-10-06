'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarRange, ChevronLeft, ChevronRight, RotateCcw, Trash2, X } from 'lucide-react'
import {
  buildMonthGrid,
  cycleNctUser,
  normalizeNctCalendar,
  NCT_DOCTORS,
  shiftMonth,
  withNctEntry,
  type NctEntry,
} from '@/lib/nct-calendar'
import { publicHolidayName, schoolHolidayZoneB } from '@/lib/french-calendar'
import { cn } from '@/lib/utils'

interface NctCalendarModalProps {
  isOpen: boolean
  onClose: () => void
  /** Calendrier actuellement appliqué. */
  calendar: readonly NctEntry[]
  /** Date (YYYY-MM-DD) servant à ouvrir sur le bon mois — semaine affichée du planning. */
  defaultDate?: string
  /** Enregistre le calendrier ; `null` = retour au calendrier par défaut. */
  onSave: (next: NctEntry[] | null) => Promise<{ ok: boolean; error?: string }>
  /** Consultation seule : aucune modification possible, pas d'enregistrement. */
  readOnly?: boolean
}

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const DAY_LABELS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']

const USER_STYLE: Record<string, string> = {
  W: 'bg-blue-600 text-white',
  M: 'bg-violet-600 text-white',
}
const USER_CHIP: Record<string, string> = {
  W: 'bg-blue-100 text-blue-800',
  M: 'bg-violet-100 text-violet-800',
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatFr(date: string): string {
  const [y, m, d] = date.split('-')
  return `${d}/${m}/${y}`
}

function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return DAY_LABELS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}

export function NctCalendarModal({ isOpen, onClose, calendar, defaultDate, onSave, readOnly = false }: NctCalendarModalProps) {
  const [draft, setDraft] = useState<NctEntry[]>([])
  const [view, setView] = useState<'month' | 'year'>('month')
  const [cursor, setCursor] = useState<{ year: number; month0: number }>({ year: 2026, month0: 0 })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setDraft(normalizeNctCalendar(calendar))
    const base = defaultDate && /^\d{4}-\d{2}-\d{2}$/.test(defaultDate) ? defaultDate : todayIso()
    setCursor({ year: Number(base.slice(0, 4)), month0: Number(base.slice(5, 7)) - 1 })
    setView('month')
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const byDate = useMemo(() => new Map(draft.map((e) => [e.date, e.user])), [draft])

  const monthEntries = useMemo(() => {
    const prefix = `${cursor.year}-${String(cursor.month0 + 1).padStart(2, '0')}-`
    return draft.filter((e) => e.date.startsWith(prefix))
  }, [draft, cursor])

  const yearCounts = useMemo(() => {
    const counts = new Array(12).fill(0) as number[]
    for (const e of draft) {
      if (e.date.startsWith(`${cursor.year}-`)) counts[Number(e.date.slice(5, 7)) - 1]++
    }
    return counts
  }, [draft, cursor.year])

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(normalizeNctCalendar(calendar)),
    [draft, calendar],
  )

  const goMonth = useCallback((delta: number) => setCursor((c) => shiftMonth(c.year, c.month0, delta)), [])

  const setUser = (date: string, user: string | null) => {
    if (readOnly) return
    setError(null)
    setDraft((prev) => withNctEntry(prev, date, user))
  }

  // Raccourcis clavier : ← → changent de mois, Échap ferme
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      if (view === 'month' && e.key === 'ArrowLeft') goMonth(-1)
      else if (view === 'month' && e.key === 'ArrowRight') goMonth(1)
      else if (view === 'year' && e.key === 'ArrowLeft') setCursor((c) => ({ ...c, year: c.year - 1 }))
      else if (view === 'year' && e.key === 'ArrowRight') setCursor((c) => ({ ...c, year: c.year + 1 }))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, view, goMonth])

  const handleSave = async () => {
    if (readOnly) return
    setSaving(true)
    setError(null)
    const res = await onSave(draft)
    setSaving(false)
    if (!res.ok) {
      setError(res.error || "Échec de l'enregistrement")
      return
    }
    onClose()
  }

  const handleReset = async () => {
    if (readOnly) return
    if (!confirm('Revenir au calendrier NCT par défaut ? Vos modifications seront perdues.')) return
    setSaving(true)
    setError(null)
    const res = await onSave(null)
    setSaving(false)
    if (!res.ok) {
      setError(res.error || 'Échec de la réinitialisation')
      return
    }
    onClose()
  }

  if (!isOpen) return null

  const grid = buildMonthGrid(cursor.year, cursor.month0)
  const today = todayIso()

  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="flex h-[92dvh] max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white text-slate-900 shadow-2xl sm:h-auto sm:max-h-[90dvh] sm:rounded-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Calendrier NCT</h2>
            <p className="text-xs text-gray-500">
              {view === 'month'
                ? readOnly
                  ? 'Consultation seule'
                  : 'Cliquez un jour : W → M → supprimer'
                : 'Choisissez un mois pour le modifier'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded p-1 text-gray-400 transition hover:text-gray-700"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation : flèches mois/année + bascule Mois ⇄ Année */}
        <div className="flex items-center gap-1 border-b border-slate-100 bg-slate-50 px-3 py-2">
          <button
            type="button"
            onClick={() => (view === 'month' ? goMonth(-1) : setCursor((c) => ({ ...c, year: c.year - 1 })))}
            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-200"
            aria-label={view === 'month' ? 'Mois précédent' : 'Année précédente'}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setView((v) => (v === 'month' ? 'year' : 'month'))}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-base font-bold text-slate-900 hover:bg-slate-200"
            title={view === 'month' ? "Voir toute l'année" : 'Revenir au mois'}
          >
            <CalendarRange className="h-4 w-4 text-slate-500" />
            {view === 'month' ? `${MONTHS[cursor.month0]} ${cursor.year}` : cursor.year}
          </button>
          <button
            type="button"
            onClick={() => (view === 'month' ? goMonth(1) : setCursor((c) => ({ ...c, year: c.year + 1 })))}
            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-200"
            aria-label={view === 'month' ? 'Mois suivant' : 'Année suivante'}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              const t = todayIso()
              setCursor({ year: Number(t.slice(0, 4)), month0: Number(t.slice(5, 7)) - 1 })
              setView('month')
            }}
            className="ml-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Aujourd&apos;hui
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {view === 'year' ? (
            <div className="grid grid-cols-3 gap-2">
              {MONTHS_SHORT.map((label, m0) => {
                const entries = draft.filter((e) => e.date.startsWith(`${cursor.year}-${String(m0 + 1).padStart(2, '0')}-`))
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      setCursor((c) => ({ ...c, month0: m0 }))
                      setView('month')
                    }}
                    className={cn(
                      'flex min-h-[84px] flex-col rounded-lg border p-2 text-left transition hover:border-blue-400 hover:bg-blue-50',
                      entries.length ? 'border-slate-300 bg-white' : 'border-slate-200 bg-slate-50',
                    )}
                  >
                    <span className="text-sm font-bold capitalize text-slate-800">{label}</span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {entries.map((e) => (
                        <span
                          key={e.date}
                          className={cn('rounded px-1 text-[10px] font-semibold', USER_CHIP[e.user] ?? 'bg-slate-200 text-slate-800')}
                        >
                          {Number(e.date.slice(8))} {e.user}
                        </span>
                      ))}
                      {entries.length === 0 && <span className="text-[10px] text-slate-400">—</span>}
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
                  const user = byDate.get(cell.date) ?? null
                  const isToday = cell.date === today
                  const ferie = publicHolidayName(cell.date)
                  const vacances = schoolHolidayZoneB(cell.date)
                  const hint = [
                    ferie ? `Férié : ${ferie}` : null,
                    vacances ? `Vacances scolaires zone B : ${vacances.name}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                  return (
                    <button
                      key={cell.date}
                      type="button"
                      onClick={() => setUser(cell.date, cycleNctUser(user))}
                      disabled={readOnly}
                      title={
                        (user
                          ? `NCT ${user} — cliquer pour changer / supprimer`
                          : `Ajouter un NCT le ${formatFr(cell.date)}`) + (hint ? ` (${hint})` : '')
                      }
                      className={cn(
                        'relative flex h-11 flex-col items-center justify-center rounded-md border text-sm transition',
                        !cell.inMonth && 'opacity-35',
                        user
                          ? cn('border-transparent font-bold', USER_STYLE[user] ?? 'bg-slate-700 text-white')
                          : ferie
                            ? 'border-rose-300 bg-rose-100 font-semibold text-rose-800 hover:border-blue-400'
                            : vacances
                              ? 'border-amber-200 bg-amber-100 text-amber-900 hover:border-blue-400'
                              : 'border-slate-200 bg-white text-slate-800 hover:border-blue-400 hover:bg-blue-50',
                        isToday && !user && 'ring-2 ring-slate-900/70',
                      )}
                    >
                      <span className="leading-none">{cell.day}</span>
                      {user && <span className="text-[10px] font-semibold leading-none opacity-90">{user}</span>}
                      {/* NCT posé un jour férié / pendant les vacances : repère conservé */}
                      {user && ferie && (
                        <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-rose-300 ring-1 ring-white" />
                      )}
                      {user && !ferie && vacances && (
                        <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-amber-300 ring-1 ring-white" />
                      )}
                    </button>
                  )
                })}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded-sm border border-rose-300 bg-rose-100" /> Jour férié
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded-sm border border-amber-200 bg-amber-100" /> Vacances scolaires (zone B)
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded-sm bg-blue-600" /> NCT W
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded-sm bg-violet-600" /> NCT M
                </span>
              </div>

              <div className="mt-3">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {monthEntries.length
                    ? `${monthEntries.length} NCT en ${MONTHS[cursor.month0].toLowerCase()}`
                    : 'Aucun NCT ce mois-ci'}
                </p>
                <ul className="space-y-1">
                  {monthEntries.map((e) => (
                    <li key={e.date} className="flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1">
                      <span className="w-24 text-sm text-slate-800">
                        <span className="text-xs text-slate-500">{dayLabel(e.date)}</span> {formatFr(e.date).slice(0, 5)}
                      </span>
                      {readOnly ? (
                        <span className={cn('rounded-md px-3 py-0.5 text-sm font-semibold', USER_STYLE[e.user] ?? 'bg-slate-700 text-white')}>
                          {e.user}
                        </span>
                      ) : (
                      <div className="flex overflow-hidden rounded-md border border-slate-300">
                        {NCT_DOCTORS.map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setUser(e.date, d)}
                            className={cn(
                              'px-3 py-0.5 text-sm font-semibold',
                              e.user === d ? USER_STYLE[d] : 'bg-white text-slate-600 hover:bg-slate-100',
                            )}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                      )}
                      {publicHolidayName(e.date) && (
                        <span className="rounded bg-rose-100 px-1.5 text-[10px] font-semibold text-rose-800" title={publicHolidayName(e.date) ?? ''}>
                          férié
                        </span>
                      )}
                      {!publicHolidayName(e.date) && schoolHolidayZoneB(e.date) && (
                        <span className="rounded bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-900" title={schoolHolidayZoneB(e.date)?.name}>
                          vacances
                        </span>
                      )}
                      {!readOnly && !(NCT_DOCTORS as readonly string[]).includes(e.user) && (
                        <span className="rounded bg-slate-200 px-1.5 text-xs font-semibold text-slate-800">{e.user}</span>
                      )}
                      {!readOnly && (
                      <button
                        type="button"
                        onClick={() => setUser(e.date, null)}
                        className="ml-auto rounded p-1.5 text-red-600 hover:bg-red-50"
                        aria-label={`Supprimer le NCT du ${formatFr(e.date)}`}
                        title="Supprimer cette date"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>

        <div className="border-t border-slate-100 px-4 py-1.5 text-[11px] text-slate-500">
          {yearCounts.reduce((a, b) => a + b, 0)} NCT en {cursor.year} · ← → pour naviguer
        </div>

        {error && <p className="px-4 pb-2 text-sm text-red-600">{error}</p>}

        {readOnly ? (
          <div className="flex justify-end border-t border-slate-200 px-4 py-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              Fermer
            </button>
          </div>
        ) : (
        <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-4 py-3">
          <button
            type="button"
            onClick={() => void handleReset()}
            disabled={saving}
            className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            title="Revenir au calendrier par défaut"
          >
            <RotateCcw className="h-4 w-4" /> Par défaut
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || !dirty}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '…' : 'Enregistrer'}
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
  )
}
