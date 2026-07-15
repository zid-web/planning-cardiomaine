'use client'

import { useState } from 'react'
import { DoctorVacation } from '@/lib/types'
import { addVacation, deleteVacation, getDoctorVacationsList } from '@/app/actions/vacation-actions'
import { formatDateRange, getVacationDayCount } from '@/lib/vacation-utils'

interface VacationsModalProps {
  doctorId: string
  isOpen: boolean
  onClose: () => void
  onVacationsUpdated?: () => void
}

export function VacationsModal({ doctorId, isOpen, onClose, onVacationsUpdated }: VacationsModalProps) {
  const [vacations, setVacations] = useState<DoctorVacation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [newVacation, setNewVacation] = useState({
    startDate: '',
    endDate: '',
    reason: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Charger les vacances du médecin
  const loadVacations = async () => {
    try {
      setIsLoading(true)
      const data = await getDoctorVacationsList(doctorId)
      setVacations(data)
    } catch (err) {
      setError('Erreur lors du chargement des vacances')
      console.error('[v0] Error loading vacations:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Charger les vacations quand la modale s'ouvre
  if (isOpen && vacations.length === 0 && !isLoading) {
    loadVacations()
  }

  // Ajouter une nouvelle vacation
  const handleAddVacation = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!newVacation.startDate || !newVacation.endDate) {
      setError("Veuillez remplir les dates de debut et fin")
      return
    }

    if (new Date(newVacation.startDate) > new Date(newVacation.endDate)) {
      setError("La date de fin doit etre apres la date de debut")
      return
    }

    try {
      setIsLoading(true)
      const result = await addVacation(
        doctorId,
        newVacation.startDate,
        newVacation.endDate,
        newVacation.reason
      )

      if (result.success) {
        setSuccess("Vacances ajoutées avec succès")
        setNewVacation({ startDate: '', endDate: '', reason: '' })
        await loadVacations()
        onVacationsUpdated?.()
      } else {
        setError(result.error || "Erreur lors de l'ajout des vacances")
      }
    } catch (err) {
      setError("Erreur lors de l'ajout des vacances")
      console.error('[v0] Error adding vacation:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Supprimer une vacation
  const handleDeleteVacation = async (vacationId: string) => {
    if (!confirm("Etes-vous sur de vouloir supprimer cette vacation ?")) return

    try {
      setIsLoading(true)
      const result = await deleteVacation(vacationId)

      if (result.success) {
        setSuccess("Vacation supprimee avec succes")
        await loadVacations()
        onVacationsUpdated?.()
      } else {
        setError(result.error || "Erreur lors de la suppression")
      }
    } catch (err) {
      setError("Erreur lors de la suppression")
      console.error('[v0] Error deleting vacation:', err)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Gérer les vacances</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
            disabled={isLoading}
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded">
              {success}
            </div>
          )}

          {/* Formulaire ajout */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="font-semibold text-gray-900 mb-4">Ajouter une periode de vacances</h3>
            <form onSubmit={handleAddVacation} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date de debut
                  </label>
                  <input
                    type="date"
                    value={newVacation.startDate}
                    onChange={(e) =>
                      setNewVacation({ ...newVacation, startDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date de fin (ISO)
                  </label>
                  <input
                    type="date"
                    value={newVacation.endDate}
                    onChange={(e) => setNewVacation({ ...newVacation, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isLoading}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Raison</label>
                <input
                  type="text"
                  placeholder="Ex: Congés, Maladie, Sabbatique..."
                  value={newVacation.reason}
                  onChange={(e) => setNewVacation({ ...newVacation, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-md transition"
              >
                {isLoading ? 'Ajout en cours...' : 'Ajouter les vacances'}
              </button>
            </form>
          </div>

          {/* Liste des vacances */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Periodes de vacances</h3>
            {vacations.length === 0 ? (
              <p className="text-gray-500 italic">Aucune vacation enregistree</p>
            ) : (
              <div className="space-y-3">
                {vacations.map((vacation) => (
                  <div
                    key={vacation.id}
                    className="flex items-start justify-between bg-blue-50 border border-blue-200 rounded-lg p-4"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {formatDateRange(vacation.start_date, vacation.end_date)}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {getVacationDayCount(vacation.start_date, vacation.end_date)} jours
                      </div>
                      {vacation.reason && (
                        <div className="text-sm text-gray-600 mt-1">
                          <span className="font-medium">Raison:</span> {vacation.reason || "N/A"}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteVacation(vacation.id)}
                      disabled={isLoading}
                      className="ml-4 bg-red-100 hover:bg-red-200 disabled:bg-gray-200 text-red-800 px-3 py-2 rounded-md text-sm font-medium transition"
                    >
                      Supprimer (X)
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t p-4 flex justify-end">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 text-gray-900 px-4 py-2 rounded-md font-medium transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
