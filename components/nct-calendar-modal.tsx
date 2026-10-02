'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { NCT_DOCTORS, normalizeNctCalendar, type NctEntry } from '@/lib/nct-calendar'
import { cn } from '@/lib/utils'

interface NctCalendarModalProps {
  isOpen: boolean
  onClose: () => void
  /** Calendrier actuellement appliqué. */
  calendar: readonly NctEntry[]
  /** Année affichée par défaut (semaine courante du planning). */
  defaultYear?: number
  /** Enregistre le calendrier ; `null` = retour au calendrier par défaut. */
  onSave: (next: NctEntry[] | null) => Promise<{ ok: boolean; error?: string }>
}

const DAY_LABELS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']

function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d) return ''
  return DAY_LABELS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}

function formatFr(date: string): string {
  const [y, m, d] = date.split('-')
  return `${d}/${m}/${y}`
}

export function NctCalendarModal({
  isOpen,
  onClose,
  calendar,
  defaultYear,
  onSave,
}: NctCalendarModalProps) {
  const [draft, setDraft] = useState<NctEntry[]>([])
  const [year, setYear] = useState<string>('all')
  const [newDate, setNewDate] = useState('')
  const [newUser, setNewUser] = useState<string>(NCT_DOCTORS[0])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setDraft(normalizeNctCalendar(calendar))
    setYear(defaultYear ? String(defaultYear) : 'all')
    setNewDate('')
    setNewUser(NCT_DOCTORS[0])
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const years = useMemo(() => {
    const set = new Set(draft.map((e) => e.date.slice(0, 4)))
    if (defaultYear) set.add(String(defaultYear))
    return [...set].sort()
  }, [draft, defaultYear])

  const visible = useMemo(
    () => (year === 'all' ? draft : draft.filter((e) => e.date.startsWith(year))),
    [draft, year],
  )

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(normalizeNctCalendar(calendar)),
    [draft, calendar],
  )

  const updateEntry = (date: string, patch: Partial<NctEntry>) => {
    setError(null)
    setDraft((prev) => {
      const target = patch.date ?? date
      if (patch.date && patch.date !== date && prev.some((e) => e.date === patch.date)) {
        setError(`Une date NCT existe déjà le ${formatFr(patch.date)}`)
        return prev
      }
      return normalizeNctCalendar(
        prev.map((e) => (e.date === date ? { date: target, user: patch.user ?? e.user } : e)),
      )
    })
  }

  const removeEntry = (date: string) => {
    setError(null)
    setDraft((prev) => prev.filter((e) => e.date !== date))
  }

  const addEntry = () => {
    setError(null)
    if (!newDate) {
      setError('Choisissez une date')
      return
    }
    if (draft.some((e) => e.date === newDate)) {
      setError(`Une date NCT existe déjà le ${formatFr(newDate)}`)
      return
    }
    setDraft((prev) => normalizeNctCalendar([...prev, { date: newDate, user: newUser }]))
    setYear(newDate.slice(0, 4))
    setNewDate('')
  }

  const handleSave = async () => {
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

  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="flex h-[92dvh] max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white text-slate-900 shadow-2xl sm:h-auto sm:max-h-[88dvh] sm:rounded-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Calendrier NCT</h2>
            <p className="text-sm text-gray-500">Ajouter, supprimer ou réaffecter une date (W / M)</p>
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

        <div className="flex flex-wrap items-end gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3">
          <label className="flex flex-col text-[11px] font-semibold text-slate-600">
            Date
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="mt-0.5 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm font-normal text-slate-900"
            />
          </label>
          <label className="flex flex-col text-[11px] font-semibold text-slate-600">
            Médecin
            <select
              value={newUser}
              onChange={(e) => setNewUser(e.target.value)}
              className="mt-0.5 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm font-normal text-slate-900"
            >
              {NCT_DOCTORS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={addEntry}
            className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> Ajouter
          </button>
          <label className="ml-auto flex flex-col text-[11px] font-semibold text-slate-600">
            Année
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="mt-0.5 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm font-normal text-slate-900"
            >
              <option value="all">Toutes</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Aucune date NCT pour cette période.</p>
          ) : (
            <ul className="space-y-1.5">
              {visible.map((e) => (
                <li key={e.date} className="flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1.5">
                  <input
                    type="date"
                    value={e.date}
                    onChange={(ev) => ev.target.value && updateEntry(e.date, { date: ev.target.value })}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900"
                  />
                  <span className="w-9 text-xs text-slate-500">{dayLabel(e.date)}</span>
                  <select
                    value={e.user}
                    onChange={(ev) => updateEntry(e.date, { user: ev.target.value })}
                    className={cn(
                      'rounded-md border border-slate-300 bg-white px-2 py-1 text-sm font-semibold text-slate-900',
                    )}
                  >
                    {[...new Set<string>([...NCT_DOCTORS, e.user])].map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeEntry(e.date)}
                    className="ml-auto rounded p-1.5 text-red-600 hover:bg-red-50"
                    aria-label={`Supprimer le NCT du ${formatFr(e.date)}`}
                    title="Supprimer cette date"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <p className="px-5 pb-2 text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-5 py-3">
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
      </div>
    </div>
  )
}
