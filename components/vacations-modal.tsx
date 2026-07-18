'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { DayPicker } from 'react-day-picker'
import { fr } from 'react-day-picker/locale'
import { format, isBefore, isAfter } from 'date-fns'
import { DoctorVacation } from '@/lib/types'
import { addVacation, deleteVacation, getDoctorVacationsList } from '@/app/actions/vacation-actions'
import { formatDateRange, getVacationDayCount } from '@/lib/vacation-utils'
import { X, RotateCcw } from 'lucide-react'
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
  // Médecins qui peuvent avoir des vacances (exclure DAAS et D = consultations externes fixes)
  const AVAILABLE_DOCTORS = ['A', 'Z', 'S', 'B', 'G', 'O', 'W', 'M', 'P', 'H', 'U', 'K', 'V', 'FV', 'D']

  const [selectedDoctorCode, setSelectedDoctorCode] = useState<string>(initialDoctorCode)
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(initialDoctorId)
  const [vacations, setVacations] = useState<DoctorVacation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({})
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSelectingRange, setIsSelectingRange] = useState(false)
  const [isClickDisabled, setIsClickDisabled] = useState(false)
  const clickTimeoutRef = useRef<NodeJS.Timeout>()

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

  useEffect(() => {
    if (isOpen && selectedDoctorId) {
      loadVacations()
    }
  }, [isOpen, selectedDoctorId])

  const handleDoctorChange = (doctorCode: string) => {
    setSelectedDoctorCode(doctorCode)
    setSelectedDoctorId(doctorCode)
    setVacations([])
    setDateRange({})
    setIsSelectingRange(false)
    setError(null)
    setSuccess(null)
  }

  // Gestionnaire de sélection de date avec protection contre double-clic
  const handleDateClick = useCallback(
    (day: Date) => {
      // Protection contre les clics rapides répétés
      if (isClickDisabled) return

      setIsClickDisabled(true)
      clearTimeout(clickTimeoutRef.current)
      clickTimeoutRef.current = setTimeout(() => {
        setIsClickDisabled(false)
      }, 300)

      if (!dateRange.from) {
        // Première date: date de début
        setDateRange({ from: day, to: undefined })
        setIsSelectingRange(true)
        setError(null)
      } else if (!dateRange.to) {
        // Deuxième date: date de fin
        if (isBefore(day, dateRange.from)) {
          // Si la nouvelle date est avant la première, on inverse
          setDateRange({ from: day, to: dateRange.from })
        } else if (isAfter(day, dateRange.from)) {
          // Plage valide
          setDateRange({ from: dateRange.from, to: day })
        } else {
          // Même date, annuler la sélection
          setDateRange({ from: undefined, to: undefined })
          setIsSelectingRange(false)
        }
      } else {
        // Réinitialiser et commencer une nouvelle sélection
        setDateRange({ from: day, to: undefined })
        setIsSelectingRange(true)
      }
    },
    [dateRange, isClickDisabled]
  )

  const handleResetSelection = () => {
    setDateRange({})
    setIsSelectingRange(false)
    setError(null)
  }

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
        setIsSelectingRange(false)
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

  // Cleanup au démontage
  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current)
      }
    }
  }, [])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-gray-50 border-b border-blue-100 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Gérer les vacances</h2>
            {showDoctorSelector && (
              <p className="text-sm text-gray-500 mt-1">Sélectionnez un médecin</p>
            )}
            {!showDoctorSelector && <p className="text-sm text-gray-500 mt-1">Dr. {selectedDoctorCode}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition p-1"
            disabled={isLoading}
            aria-label="Fermer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 space-y-8">
          {/* Doctor Selector */}
          {showDoctorSelector && (
            <div className="border border-gray-200 rounded-lg p-5 bg-gray-50">
              <label htmlFor="doctor-select" className="block text-sm font-semibold text-gray-900 mb-2">
                Médecin concerné
              </label>
              <select
                id="doctor-select"
                value={selectedDoctorCode}
                onChange={(e) => handleDoctorChange(e.target.value)}
                disabled={isLoading}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
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
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm font-medium">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm font-medium">
              {success}
            </div>
          )}

          {/* Calendar Section */}
          {selectedDoctorCode && (
            <div className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-900">Sélectionner une période de vacances</h3>
                {(dateRange.from || dateRange.to) && (
                  <button
                    onClick={handleResetSelection}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
                    title="Réinitialiser la sélection"
                    disabled={isLoading}
                  >
                    <RotateCcw className="w-4 h-4" />
                    Réinitialiser
                  </button>
                )}
              </div>

              <p className="text-sm text-gray-600 mb-6">
                {!isSelectingRange
                  ? 'Cliquez sur une date pour commencer'
                  : 'Cliquez sur la date de fin pour compléter la période'}
              </p>

              {/* Calendar Grid - Two months side by side */}
              <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
                <div
                  className="inline-flex rdp-months"
                  style={{
                    '--rdp-cell-size': '45px',
                    '--rdp-accent-color': '#3b82f6',
                    '--rdp-background-color': '#dbeafe',
                  } as React.CSSProperties}
                >
                  <DayPicker
                    mode="range"
                    selected={{
                      from: dateRange.from,
                      to: dateRange.to,
                    }}
                    onDayClick={handleDateClick}
                    locale={fr}
                    disabled={isLoading}
                    numberOfMonths={2}
                    showOutsideDays={false}
                    classNames={{
                      months: 'flex flex-row gap-8',
                      month: 'space-y-4',
                      caption: 'flex justify-center pt-1 pb-3 relative items-center',
                      caption_label: 'text-sm font-semibold text-gray-900',
                      nav: 'space-x-1 flex justify-between',
                      nav_button:
                        'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 rounded transition',
                      nav_button_previous: 'absolute left-1',
                      nav_button_next: 'absolute right-1',
                      table: 'w-full border-collapse space-y-1',
                      head_row: 'flex gap-2',
                      head_cell:
                        'text-gray-600 rounded-md w-10 font-normal text-xs uppercase tracking-wide h-8 flex items-center justify-center',
                      row: 'flex gap-2 mt-2 w-full',
                      cell: 'h-10 w-10 text-center text-sm p-0 relative',
                      day: 'h-10 w-10 p-0 font-normal aria-selected:opacity-100 hover:bg-blue-50 rounded-md transition cursor-pointer',
                      day_selected:
                        'bg-blue-500 text-white font-semibold hover:bg-blue-600 focus:ring-2 focus:ring-blue-300',
                      day_today: 'font-bold text-blue-600 bg-blue-50',
                      day_outside: 'text-gray-300',
                      day_disabled: 'text-gray-300 cursor-not-allowed opacity-50',
                      day_range_middle:
                        'aria-selected:bg-blue-100 aria-selected:text-gray-900 aria-selected:rounded-none',
                      day_hidden: 'invisible',
                    }}
                  />
                </div>
              </div>

              {/* Selection Summary & Submit Button - ONLY SHOWN WHEN BOTH DATES SELECTED */}
              {dateRange.from && dateRange.to && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="space-y-2">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Période sélectionnée:</span>{' '}
                      <span className="text-blue-600 font-medium">
                        {format(dateRange.from, 'dd MMMM yyyy', { locale: fr })} -{' '}
                        {format(dateRange.to, 'dd MMMM yyyy', { locale: fr })}
                      </span>
                    </p>
                    <p className="text-sm text-gray-600">
                      Durée:{' '}
                      <span className="font-semibold text-gray-900">
                        {getVacationDayCount(dateRange.from, dateRange.to)} jours
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={handleAddVacation}
                    disabled={isLoading || isClickDisabled}
                    className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-lg transition"
                  >
                    {isLoading ? 'Enregistrement...' : 'Enregistrer cette période'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Recorded Vacations List */}
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
                      className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-4 hover:bg-blue-100 transition"
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 text-sm">
                          {formatDateRange(vacation.start_date, vacation.end_date)}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {getVacationDayCount(vacation.start_date, vacation.end_date)} jours
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteVacation(vacation.id)}
                        disabled={isLoading}
                        className="ml-4 bg-red-100 hover:bg-red-200 disabled:bg-gray-200 text-red-800 px-3 py-1.5 rounded-lg text-xs font-medium transition"
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
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-900 px-4 py-2 rounded-lg font-medium text-sm transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
