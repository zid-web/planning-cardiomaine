'use client'

import React, { useState, useEffect } from 'react'
import { DayPicker } from 'react-day-picker'
import { fr } from 'react-day-picker/locale'
import { format } from 'date-fns'
import { DoctorVacation } from '@/lib/types'
import { addVacation, deleteVacation, getDoctorVacationsList } from '@/app/actions/vacation-actions'
import { formatDateRange, getVacationDayCount } from '@/lib/vacation-utils'
import 'react-day-picker/dist/style.css'

interface VacationsModalProps {
  doctorId?: string
  doctorCode?: string
  isOpen: boolean
  onClose: () => void
  onVacationsUpdated?: () => void
  showDoctorSelector?: boolean
}

export function VacationsModal({
  doctorId: initialDoctorId = '',
  doctorCode: initialDoctorCode = '',
  isOpen,
  onClose,
  onVacationsUpdated,
  showDoctorSelector = true,
}: VacationsModalProps) {
  const AVAILABLE_DOCTORS = ['A', 'Z', 'S', 'B', 'G', 'O', 'W', 'M', 'P', 'H', 'U', 'K', 'V']

  const [selectedDoctorCode, setSelectedDoctorCode] = useState<string>(initialDoctorCode)
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(initialDoctorId)
  const [vacations, setVacations] = useState<DoctorVacation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({})
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Charger les vacances du médecin sélectionné
  const loadVacations = async () => {
    if (!selectedDoctorId) return

    try {
      setIsLoading(true)
      const data = await getDoctorVacationsList(selectedDoctorId)
      setVacations(data)
    } catch (err) {
      setError('Erreur lors du chargement des vacances')
      console.error('[v0] Error loading vacations:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Charger les vacations quand la modale s'ouvre ou quand le médecin sélectionné change
  useEffect(() => {
    if (isOpen && selectedDoctorId) {
      loadVacations()
    }
  }, [isOpen, selectedDoctorId])

  // Gestion du changement de médecin sélectionné
  const handleDoctorChange = (doctorCode: string) => {
    setSelectedDoctorCode(doctorCode)
    setSelectedDoctorId(doctorCode) // Utiliser le code comme ID pour simplifier
    setVacations([])
    setDateRange({})
    setError(null)
    setSuccess(null)
  }

  // Ajouter une nouvelle vacation
  const handleAddVacation = async () => {
    setError(null)
    setSuccess(null)

    if (!dateRange.from || !dateRange.to) {
      setError('Veuillez sélectionner une période complète (date de début et fin)')
      return
    }

    try {
      setIsLoading(true)
      const startDateStr = format(dateRange.from, 'yyyy-MM-dd')
      const endDateStr = format(dateRange.to, 'yyyy-MM-dd')

      const result = await addVacation(selectedDoctorId, startDateStr, endDateStr)

      if (result.success) {
        setSuccess('Période de vacances ajoutée avec succès')
        setDateRange({})
        await loadVacations()
        onVacationsUpdated?.()
      } else {
        setError(result.error || 'Erreur lors de l\'ajout de la vacation')
      }
    } catch (err) {
      setError('Erreur lors de l\'ajout de la vacation')
      console.error('[v0] Error adding vacation:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Supprimer une vacation
  const handleDeleteVacation = async (vacationId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette période de vacances ?')) return

    try {
      setIsLoading(true)
      const result = await deleteVacation(vacationId)

      if (result.success) {
        setSuccess('Période de vacances supprimée avec succès')
        await loadVacations()
        onVacationsUpdated?.()
      } else {
        setError(result.error || 'Erreur lors de la suppression')
      }
    } catch (err) {
      setError('Erreur lors de la suppression')
      console.error('[v0] Error deleting vacation:', err)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Gérer les vacances</h2>
            {showDoctorSelector && (
              <p className="text-sm text-gray-600 mt-1">Sélectionnez un médecin</p>
            )}
            {!showDoctorSelector && <p className="text-sm text-gray-600 mt-1">Dr. {selectedDoctorCode}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-light transition"
            disabled={isLoading}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Doctor Selector */}
          {showDoctorSelector && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <label htmlFor="doctor-select" className="block text-sm font-medium text-gray-900 mb-2">
                Médecin concerné
              </label>
              <select
                id="doctor-select"
                value={selectedDoctorCode}
                onChange={(e) => handleDoctorChange(e.target.value)}
                disabled={isLoading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Sélectionnez un médecin --</option>
                {AVAILABLE_DOCTORS.map((code) => (
                  <option key={code} value={code}>
                    Dr. {code}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md text-sm">
              {success}
            </div>
          )}

          {/* Sélecteur de dates */}
          {selectedDoctorCode && (
          <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
            <h3 className="font-semibold text-gray-900 mb-4">Sélectionner une période de vacances</h3>
            <p className="text-sm text-gray-600 mb-4">
              Cliquez sur une date de début, puis sur une date de fin pour définir la période
            </p>

            <div className="bg-white rounded-lg p-4 border border-gray-200 inline-block">
              <DayPicker
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                locale={fr}
                disabled={isLoading}
                className="rdp-compact"
                classNames={{
                  months: 'flex gap-4',
                  month: 'space-y-2',
                  caption: 'flex justify-center pt-1 pb-2 font-semibold text-sm',
                  caption_label: 'text-gray-900',
                  nav: 'flex gap-1',
                  nav_button:
                    'inline-flex items-center justify-center rounded-md p-1 hover:bg-gray-100 transition',
                  nav_button_previous: 'absolute left-1',
                  nav_button_next: 'absolute right-1',
                  table: 'w-full border-collapse space-y-1',
                  head_row: 'flex gap-2',
                  head_cell: 'w-8 h-8 text-center text-xs font-semibold text-gray-600 uppercase',
                  row: 'flex gap-2 mt-2',
                  cell: 'relative p-0 text-center',
                  day: 'inline-flex items-center justify-center w-8 h-8 text-sm rounded-md hover:bg-blue-50 transition',
                  day_selected:
                    'bg-blue-500 text-white font-medium hover:bg-blue-600 transition',
                  day_today: 'font-bold text-blue-600',
                  day_outside: 'text-gray-300',
                  day_disabled: 'text-gray-300 cursor-not-allowed',
                  day_range_middle:
                    'aria-selected:bg-blue-100 aria-selected:text-gray-900 rounded-none',
                }}
              />
            )}
          </div>
          )}

          {/* Liste des vacances */}
          {selectedDoctorCode && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Périodes enregistrées</h3>
            {vacations.length === 0 ? (
              <p className="text-gray-500 italic text-sm">Aucune période de vacances enregistrée</p>
            ) : (
              <div className="space-y-2">
                {vacations.map((vacation) => (
                  <div
                    key={vacation.id}
                    className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-md p-4 hover:bg-blue-100 transition"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 text-sm">
                        {formatDateRange(vacation.start_date, vacation.end_date)}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {getVacationDayCount(vacation.start_date, vacation.end_date)} jours
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteVacation(vacation.id)}
                      disabled={isLoading}
                      className="ml-4 bg-red-100 hover:bg-red-200 disabled:bg-gray-200 text-red-800 px-3 py-1.5 rounded-md text-xs font-medium transition"
                    >
                      Supprimer
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-4 flex justify-end">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-900 px-4 py-2 rounded-md font-medium text-sm transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
