'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Sparkles, Trash2, X } from 'lucide-react'
import {
  ATL_NIGHT_DOCTORS,
  cycleAtlNightUser,
  expectedAtlNightGroup,
  normalizeAtlNightCalendar,
  withAtlNightEntry,
  type AtlNightEntry,
} from '@/lib/atl-night-calendar'
import { buildMonthGrid, shiftMonth } from '@/lib/nct-calendar'
import { publicHolidayName } from '@/lib/french-calendar'
import { cn } from '@/lib/utils'

interface AtlNightCalendarModalProps {
  isOpen: boolean
  onClose: () => void
  /** Calendrier actuellement enregistré. */
  calendar: readonly AtlNightEntry[]
  /** Date (YYYY-MM-DD) servant à ouvrir sur le bon mois — semaine affichée du planning. */
  defaultDate?: string
  /** Enregistre le calendrier (le planning suit). */
  onSave: (next: AtlNightEntry[]) => Promise<{ ok: boolean; error?: string }>
  /** Médecin(s) actuellement posé(s) dans le planning pour cette nuit (semaines chargées). */
  planningValue: (date: string) => string | null
  /** Propositions automatiques (roulement, ATL Midi → nuit, équité) pour les dates vides du mois. */
  autoFill: (draft: AtlNightEntry[], year: number, month0: number) => AtlNightEntry[]
  readOnly?: boolean
}

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const DAY_LABELS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']

const USER_STYLE: Record<string, string> = {
  M: 'bg-violet-600 text-white',
  W: 'bg-blue-600 text-white',
  O: 'bg-emerald-600 text-white',
  CH: 'bg-orange-500 text-white',
}
const USER_SOFT: Record<string, string> = {
  M: 'border-violet-400 bg-violet-50 text-violet-800',
  W: 'border-blue-400 bg-blue-50 text-blue-800',
  O: 'border-emerald-400 bg-emerald-50 text-emerald-800',
  CH: 'border-orange-400 bg-orange-50 text-orange-800',
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

export function AtlNightCalendarModal({
  isOpen,
  onClose,
  calendar,
  defaultDate,
  onSave,
  planningValue,
  autoFill,
  readOnly = false,
}: AtlNightCalendarModalProps) {
  const [draft, setDraft] = useState<AtlNightEntry[]>([])
  const [cursor, setCursor] = useState<{ year: number; month0: number }>({ year: 2026, month0: 0 })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setDraft(normalizeAtlNightCalendar(calendar))
    const base = defaultDate && /^\d{4}-\d{2}-\d{2}$/.test(defaultDate) ? defaultDate : todayIso()
    setCursor({ year: Number(base.slice(0, 4)), month0: Number(base.slice(5, 7)) - 1 })
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const byDate = useMemo(() => new Map(draft.map((e) => [e.date, e])), [draft])
  const monthPrefix = `${cursor.year}-${String(cursor.month0 + 1).padStart(2, '0')}-`
  const monthEntries = useMemo(() => draft.filter((e) => e.date.startsWith(monthPrefix)), [draft, monthPrefix])
  const monthCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const e of monthEntries) c[e.user] = (c[e.user] ?? 0) + 1
    return c
  }, [monthEntries])

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(normalizeAtlNightCalendar(calendar)),
    [draft, calendar],
  )

  const goMonth = useCallback((delta: number) => setCursor((c) => shiftMonth(c.year, c.month0, delta)), [])

  const setUser = (date: string, user: string | null) => {
    if (readOnly) return
    setError(null)
    setDraft((prev) => withAtlNightEntry(prev, date, user, true))
  }

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowLeft') goMonth(-1)
      else if (e.key === 'ArrowRight') goMonth(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, goMonth])

  /** Reprend dans le calendrier les nuits déjà posées dans le planning (dates vides du mois). */
  const importFromPlanning = () => {
    setDraft((prev) => {
      let next = prev
      const last = new Date(Date.UTC(cursor.year, cursor.month0 + 1, 0)).getUTCDate()
      for (let d = 1; d <= last; d++) {
        const date = `${monthPrefix}${String(d).padStart(2, '0')}`
        if (next.some((e) => e.date === date)) continue
        const v = planningValue(date)
        if (v && (ATL_NIGHT_DOCTORS as readonly string[]).includes(v)) next = withAtlNightEntry(next, date, v, true)
      }
      return next
    })
  }

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

  if (!isOpen) return null

  const grid = buildMonthGrid(cursor.year, cursor.month0)
  const today = todayIso()

  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="flex h-[92dvh] max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white text-slate-900 shadow-2xl sm:h-auto sm:max-h-[90dvh] sm:rounded-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Astreinte nuit</h2>
            <p className="text-xs text-gray-500">
              {readOnly ? 'Consultation seule' : 'Cliquez un jour : M → W → O → CH → supprimer'}
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

        <div className="flex items-center gap-1 border-b border-slate-100 bg-slate-50 px-3 py-2">
          <button
            type="button"
            onClick={() => goMonth(-1)}
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
            onClick={() => goMonth(1)}
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

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-500">
            {WEEKDAYS.map((d, i) => (
              <div key={i}>{d}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {grid.flat().map((cell) => {
              const entry = byDate.get(cell.date) ?? null
              const planned = entry ? null : planningValue(cell.date)
              const group = expectedAtlNightGroup(cell.date)
              const ferie = publicHolidayName(cell.date)
              const label = entry?.user ?? planned
              return (
                <button
                  key={cell.date}
                  type="button"
                  onClick={() => setUser(cell.date, cycleAtlNightUser(entry?.user ?? planned ?? null))}
                  disabled={readOnly}
                  title={
                    (entry
                      ? `Astreinte nuit ${entry.user} (${entry.manual ? 'saisie manuelle' : 'proposition automatique'})`
                      : planned
                        ? `Planning : ${planned} — cliquer pour fixer dans le calendrier`
                        : `Roulement : ${group === 'CH' ? 'CH' : 'W / O / M'}`) + (ferie ? ` · Férié : ${ferie}` : '')
                  }
                  className={cn(
                    'relative flex h-12 flex-col items-center justify-center rounded-md border text-sm transition',
                    !cell.inMonth && 'opacity-35',
                    entry?.manual
                      ? cn('border-transparent font-bold', USER_STYLE[entry.user] ?? 'bg-slate-700 text-white')
                      : entry
                        ? cn('border-dashed font-bold', USER_SOFT[entry.user] ?? 'border-slate-400 bg-slate-50')
                        : planned
                          ? cn('border-dotted', USER_SOFT[planned] ?? 'border-slate-300 bg-white')
                          : ferie
                            ? 'border-rose-300 bg-rose-50 text-rose-800 hover:border-blue-400'
                            : 'border-slate-200 bg-white text-slate-800 hover:border-blue-400 hover:bg-blue-50',
                    cell.date === today && 'ring-2 ring-slate-900/70',
                  )}
                >
                  <span className="leading-none">{cell.day}</span>
                  <span className="mt-0.5 text-[10px] font-semibold leading-none opacity-90">
                    {label ?? <span className="font-normal text-slate-400">{group === 'CH' ? 'CH' : 'WOM'}</span>}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
            <span className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm bg-slate-700" /> Saisie manuelle
            </span>
            <span className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm border border-dashed border-slate-500 bg-slate-50" /> Proposition auto
            </span>
            <span className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm border border-dotted border-slate-500 bg-white" /> Planning (hors calendrier)
            </span>
            <span className="text-slate-400">gris : roulement attendu</span>
          </div>

          {!readOnly && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDraft((prev) => autoFill(prev, cursor.year, cursor.month0))}
                className="flex items-center gap-1 rounded-md border border-violet-300 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-800 hover:bg-violet-100"
                title="Propose les nuits vides du mois : roulement CH, ATL Midi → nuit, jamais FV ni le médecin de garde, équité"
              >
                <Sparkles className="h-3.5 w-3.5" /> Remplir auto le mois
              </button>
              <button
                type="button"
                onClick={importFromPlanning}
                className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                title="Fixe dans le calendrier les nuits déjà posées dans le planning"
              >
                <Download className="h-3.5 w-3.5" /> Reprendre du planning
              </button>
            </div>
          )}

          <div className="mt-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {monthEntries.length
                ? `${monthEntries.length} nuit(s) en ${MONTHS[cursor.month0].toLowerCase()} · ` +
                  (ATL_NIGHT_DOCTORS as readonly string[]).map((d) => `${d} ${monthCounts[d] ?? 0}`).join(' · ')
                : 'Aucune nuit au calendrier ce mois-ci'}
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
                      {ATL_NIGHT_DOCTORS.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setUser(e.date, d)}
                          className={cn(
                            'px-2.5 py-0.5 text-sm font-semibold',
                            e.user === d ? USER_STYLE[d] : 'bg-white text-slate-600 hover:bg-slate-100',
                          )}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  )}
                  <span className="text-[10px] text-slate-500">{e.manual ? 'manuel' : 'auto'}</span>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => setUser(e.date, null)}
                      className="ml-auto rounded p-1.5 text-red-600 hover:bg-red-50"
                      aria-label={`Supprimer la nuit du ${formatFr(e.date)}`}
                      title="Retirer cette date du calendrier"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {error && <p className="px-4 pb-2 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            {readOnly ? 'Fermer' : 'Annuler'}
          </button>
          {!readOnly && (
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || !dirty}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '…' : 'Enregistrer'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
