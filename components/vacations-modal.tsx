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

interface VacationsModalProps {
  doctorId?: string
  doctorCode?: string
  isOpen: boolean
  onClose: () => void
  onVacationsUpdated?: () => void
  showDoctorSelector?: boolean
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

      // Mise à jour optimiste de la liste, puis rechargement serveur
      if (saved) {
        setVacations((prev) => {
          const without = prev.filter((v) => v.id !== saved!.id)
          return sortVacations([...without, saved!])
        })
      }

      resetForm()
      await loadVacations()
      await Promise.resolve(onVacationsUpdated?.())
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
      setVacations((prev) => prev.filter((v) => v.id !== vacationId))
      setSuccess('Congé supprimé')
      await loadVacations()
      await Promise.resolve(onVacationsUpdated?.())
    } catch (err) {
      setError('Erreur lors de la suppression')
      console.error('[app] Error deleting vacation:', err)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
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

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
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
                    Dr. {code}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={openCreate}
              disabled={isLoading || formMode === 'create'}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:bg-gray-300"
            >
              <Plus className="h-4 w-4" />
              Ajouter un congé
            </button>
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
                        Dr. {code}
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
                {filterDoctor !== 'all' ? ` pour Dr. ${filterDoctor}` : ''}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Médecin</th>
                      <th className="px-3 py-2 font-semibold">Période</th>
                      <th className="px-3 py-2 font-semibold">Durée</th>
                      <th className="px-3 py-2 font-semibold">Motif</th>
                      <th className="px-3 py-2 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredVacations.map((vacation) => {
                      const color = DOCTOR_COLORS[vacation.doctor_id] || 'bg-slate-500'
                      const isEditing = editingId === vacation.id
                      return (
                        <tr
                          key={vacation.id}
                          className={cn('bg-white', isEditing && 'bg-amber-50')}
                        >
                          <td className="px-3 py-2.5">
                            <span
                              className={cn(
                                'inline-flex min-w-[2rem] justify-center rounded px-2 py-0.5 text-xs font-semibold text-white',
                                color,
                              )}
                            >
                              {vacation.doctor_id}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-medium text-gray-900">
                            {formatDateRange(vacation.start_date, vacation.end_date)}
                          </td>
                          <td className="px-3 py-2.5 text-gray-600">
                            {getVacationDayCount(vacation.start_date, vacation.end_date)} j
                          </td>
                          <td className="px-3 py-2.5 text-gray-600">
                            {vacation.reason?.trim() || '—'}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEdit(vacation)}
                                disabled={isLoading}
                                className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-800 hover:bg-blue-100 disabled:opacity-50"
                                title="Modifier"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Modifier
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDelete(vacation.id)}
                                disabled={isLoading}
                                className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
                                title="Supprimer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Supprimer
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end border-t border-gray-200 bg-gray-50 px-5 py-3">
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
