'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import {
  addVacation,
  deleteVacation,
  getAllVacations,
  updateVacation,
} from '@/app/actions/vacation-actions'
import { DOCTOR_COLORS, DOCTOR_METADATA, DOCTORS } from '@/lib/constants'
import type { DoctorVacation } from '@/lib/types'
import { formatDateRange, getVacationDayCount } from '@/lib/vacation-utils'
import { cn } from '@/lib/utils'
import { formatPersonLabel } from "@/lib/doctor-code"

interface VacationsModalProps {
  doctorId?: string
  doctorCode?: string
  isOpen: boolean
  onClose: () => void
  /** Liste à jour optionnelle pour appliquer le planning sans attendre un 2ᵉ fetch. */
  onVacationsUpdated?: (next?: DoctorVacation[]) => void | Promise<void>
  showDoctorSelector?: boolean
  isAdmin?: boolean
}

type FormMode = 'idle' | 'create' | 'edit'

type FormState = {
  doctorId: string
  startDate: string
  endDate: string
  reason: string
}

const EMPTY_FORM: FormState = {
  doctorId: '',
  startDate: '',
  endDate: '',
  reason: '',
}

const CONGES_DOCTORS = DOCTORS.filter((code) => DOCTOR_METADATA[code]?.can_have_vacations !== false)

function sortVacations(list: DoctorVacation[]): DoctorVacation[] {
  return [...list].sort((a, b) => {
    const byStart = a.start_date.localeCompare(b.start_date)
    if (byStart !== 0) return byStart
    return a.doctor_id.localeCompare(b.doctor_id)
  })
}

export function VacationsModal({
  doctorId: initialDoctorId = '',
  isOpen,
  onClose,
  onVacationsUpdated,
  isAdmin = false,
}: VacationsModalProps) {
  const [vacations, setVacations] = useState<DoctorVacation[]>([])
  const [filterDoctor, setFilterDoctor] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [formMode, setFormMode] = useState<FormMode>('idle')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const loadVacations = useCallback(async () => {
    try {
      setIsLoading(true)
      const data = await getAllVacations()
      setVacations(sortVacations(data))
    } catch (err) {
      setError('Erreur lors du chargement des congés')
      console.error('[app] Error loading vacations:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    setError(null)
    setSuccess(null)
    setFormMode('idle')
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFilterDoctor('all')
    void loadVacations()
  }, [isOpen, loadVacations])

  const filteredVacations = useMemo(() => {
    if (filterDoctor === 'all') return vacations
    return vacations.filter((v) => v.doctor_id === filterDoctor)
  }, [vacations, filterDoctor])

  const resetForm = () => {
    setFormMode('idle')
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const openCreate = () => {
    setError(null)
    setSuccess(null)
    setFormMode('create')
    setEditingId(null)
    setForm({
      ...EMPTY_FORM,
      doctorId: filterDoctor !== 'all' ? filterDoctor : initialDoctorId || '',
    })
  }

  const openEdit = (vacation: DoctorVacation) => {
    setError(null)
    setSuccess(null)
    setFormMode('edit')
    setEditingId(vacation.id)
    setForm({
      doctorId: vacation.doctor_id,
      startDate: vacation.start_date,
      endDate: vacation.end_date,
      reason: vacation.reason || '',
    })
  }

  const handleSave = async () => {
    setError(null)
    setSuccess(null)

    if (!form.doctorId) {
      setError('Veuillez sélectionner un médecin')
      return
    }
    if (!form.startDate || !form.endDate) {
      setError('Veuillez renseigner les dates de début et de fin')
      return
    }
    if (form.endDate < form.startDate) {
      setError('La date de fin doit être postérieure ou égale à la date de début')
      return
    }

    try {
      setIsLoading(true)
      let saved: DoctorVacation | undefined

      if (formMode === 'create') {
        const result = await addVacation(
          form.doctorId,
          form.startDate,
          form.endDate,
          form.reason || null,
        )
        if (!result.success) {
          setError(result.error || "Erreur lors de l'ajout du congé")
          return
        }
        saved = result.data
        setSuccess('Congé ajouté')
        // Afficher immédiatement le médecin concerné (évite un filtre qui masque l’ajout)
        setFilterDoctor('all')
      } else if (formMode === 'edit' && editingId) {
        const result = await updateVacation(editingId, form.startDate, form.endDate, {
          doctorId: form.doctorId,
          reason: form.reason || null,
        })
        if (!result.success) {
          setError(result.error || 'Erreur lors de la modification du congé')
          return
        }
        saved = result.data
        setSuccess('Congé modifié')
      }

      // Mise à jour optimiste de la liste, puis sync planning parent + rechargement serveur
      let nextList = vacations
      if (saved) {
        nextList = sortVacations([...vacations.filter((v) => v.id !== saved!.id), saved!])
        setVacations(nextList)
      }

      resetForm()
      try {
        await Promise.resolve(onVacationsUpdated?.(nextList))
      } catch (parentErr) {
        // Ne pas faire échouer l’ajout si le refresh planning parent échoue
        console.warn('[app] onVacationsUpdated après save:', parentErr)
      }
      try {
        const fresh = await getAllVacations()
        const sorted = sortVacations(fresh)
        setVacations(sorted)
        await Promise.resolve(onVacationsUpdated?.(sorted))
      } catch (reloadErr) {
        console.warn('[app] Reload liste congés après save:', reloadErr)
      }
    } catch (err) {
      setError('Erreur lors de l’enregistrement')
      console.error('[app] Error saving vacation:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (vacationId: string) => {
    if (!confirm('Supprimer ce congé ?')) return
    try {
      setIsLoading(true)
      setError(null)
      setSuccess(null)
      const result = await deleteVacation(vacationId)
      if (!result.success) {
        setError(result.error || 'Erreur lors de la suppression')
        return
      }
      if (editingId === vacationId) resetForm()
      const nextList = vacations.filter((v) => v.id !== vacationId)
      setVacations(nextList)
      setSuccess('Congé supprimé')
      try {
        await Promise.resolve(onVacationsUpdated?.(nextList))
      } catch (parentErr) {
        console.warn('[app] onVacationsUpdated après delete:', parentErr)
      }
      try {
        const fresh = await getAllVacations()
        const sorted = sortVacations(fresh)
        setVacations(sorted)
        await Promise.resolve(onVacationsUpdated?.(sorted))
      } catch (reloadErr) {
        console.warn('[app] Reload liste congés après delete:', reloadErr)
      }
    } catch (err) {
      setError('Erreur lors de la suppression')
      console.error('[app] Error deleting vacation:', err)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="flex h-[92dvh] max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:h-auto sm:max-h-[88dvh] sm:rounded-xl">
        <div className="flex items-center justify-between border-b border-amber-100 bg-gradient-to-r from-amber-50 to-white px-5 py-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Congés</h2>
            <p className="text-sm text-gray-500">
              Liste complète — ajouter, modifier ou supprimer
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 transition hover:text-gray-700"
            disabled={isLoading}
            aria-label="Fermer"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5 pb-8">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-800">
              {success}
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[180px] flex-1">
              <label htmlFor="conges-filter" className="mb-1 block text-xs font-semibold text-gray-700">
                Filtrer par médecin
              </label>
              <select
                id="conges-filter"
                value={filterDoctor}
                onChange={(e) => setFilterDoctor(e.target.value)}
                disabled={isLoading}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="all">Tous les médecins</option>
                {CONGES_DOCTORS.map((code) => (
                  <option key={code} value={code}>
                    {formatPersonLabel(code)}
                  </option>
                ))}
              </select>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={openCreate}
                disabled={isLoading || formMode === 'create'}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:bg-gray-300"
              >
                <Plus className="h-4 w-4" />
                Ajouter un congé
              </button>
            )}
          </div>

          {(formMode === 'create' || formMode === 'edit') && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">
                {formMode === 'create' ? 'Nouveau congé' : 'Modifier le congé'}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700" htmlFor="conges-doctor">
                    Médecin
                  </label>
                  <select
                    id="conges-doctor"
                    value={form.doctorId}
                    onChange={(e) => setForm((f) => ({ ...f, doctorId: e.target.value }))}
                    disabled={isLoading}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">-- Médecin --</option>
                    {CONGES_DOCTORS.map((code) => (
                      <option key={code} value={code}>
                        {formatPersonLabel(code)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700" htmlFor="conges-reason">
                    Motif (optionnel)
                  </label>
                  <input
                    id="conges-reason"
                    type="text"
                    value={form.reason}
                    onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                    disabled={isLoading}
                    placeholder="Congés, formation…"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700" htmlFor="conges-start">
                    Début
                  </label>
                  <input
                    id="conges-start"
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                    disabled={isLoading}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700" htmlFor="conges-end">
                    Fin
                  </label>
                  <input
                    id="conges-end"
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                    disabled={isLoading}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={isLoading}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-gray-300"
                >
                  {isLoading ? 'Enregistrement…' : formMode === 'create' ? 'Enregistrer' : 'Enregistrer les modifications'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={isLoading}
                  className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-300"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                Congés enregistrés
                <span className="ml-2 font-normal text-gray-500">({filteredVacations.length})</span>
              </h3>
              {isLoading && <span className="text-xs text-gray-500">Chargement…</span>}
            </div>

            {filteredVacations.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm italic text-gray-500">
                Aucun congé enregistré
                {filterDoctor !== 'all' ? ` pour ${formatPersonLabel(filterDoctor)}` : ''}
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {Object.entries(
                  filteredVacations.reduce((acc, v) => {
                    if (!acc[v.doctor_id]) acc[v.doctor_id] = []
                    acc[v.doctor_id].push(v)
                    return acc
                  }, {} as Record<string, DoctorVacation[]>)
                ).map(([docId, vacs]) => (
                  <div key={docId} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm transition-all hover:shadow-md">
                    <div className="flex items-center gap-3 mb-3 border-b border-gray-50 pb-2">
                      <span className={cn('inline-flex items-center justify-center rounded-lg w-8 h-8 text-sm font-bold text-white', DOCTOR_COLORS[docId] || 'bg-slate-500')}>
                        {docId}
                      </span>
                      <h4 className="font-semibold text-gray-900">{formatPersonLabel(docId)}</h4>
                      <span className="ml-auto text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                        {vacs.length} période{vacs.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {vacs.map(vacation => {
                        const isEditing = editingId === vacation.id
                        return (
                          <div key={vacation.id} className={cn("flex items-center gap-3 border rounded-lg px-3 py-2 text-sm transition-colors", isEditing ? "border-amber-400 bg-amber-50" : "bg-gray-50 border-gray-200 hover:border-gray-300")}>
                             <div className="flex flex-col">
                               <span className="font-semibold text-gray-800">{formatDateRange(vacation.start_date, vacation.end_date)}</span>
                               <span className="text-xs text-gray-500 mt-0.5">
                                 {getVacationDayCount(vacation.start_date, vacation.end_date)} jours
                                 {vacation.reason ? <span className="ml-1 px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded text-[10px] uppercase font-bold tracking-wider">{vacation.reason}</span> : ''}
                               </span>
                             </div>
                             {isAdmin && (
                               <div className="flex flex-col gap-1.5 ml-2 border-l border-gray-200 pl-3">
                                  <button onClick={() => openEdit(vacation)} className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 p-1 rounded transition-colors" title="Modifier">
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => handleDelete(vacation.id)} className="text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 p-1 rounded transition-colors" title="Supprimer">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                               </div>
                             )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 justify-end border-t border-gray-200 bg-gray-50 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-300 disabled:opacity-50"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
