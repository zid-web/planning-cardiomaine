'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { Calendar, ChevronLeft, ChevronRight, Clock, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { VoiceAndUploadPanel } from '@/components/VoiceAndUploadPanel'
import { toast } from 'sonner'

// Types
interface ScheduleEntry {
  value: string[]
  type: 'doctor' | 'note'
  status: 'validated' | 'pending'
  updatedAt?: string
}

interface ScheduleData {
  [key: string]: {
    [day: string]: ScheduleEntry
  }
}

// Constants
const DOCTORS = [
  'P', 'E', 'Z', 'B', 'G', 'W', 'M', 'S', 'O', 'H', 
  'U', 'A', 'V', 'Val', 'K', 'CH', 'FV', 'D', 'DAAS', 'R', 'T'
]

const DOCTOR_COLORS: { [key: string]: string } = {
  'P': 'bg-blue-500',
  'E': 'bg-orange-500',
  'Z': 'bg-green-500',
  'B': 'bg-purple-500',
  'G': 'bg-pink-500',
  'W': 'bg-red-500',
  'M': 'bg-indigo-500',
  'S': 'bg-cyan-500',
  'O': 'bg-orange-400',
  'H': 'bg-yellow-500',
  'U': 'bg-lime-500',
  'A': 'bg-teal-500',
  'V': 'bg-rose-500',
  'Val': 'bg-amber-500',
  'K': 'bg-violet-500',
  'CH': 'bg-sky-500',
  'FV': 'bg-fuchsia-500',
  'D': 'bg-slate-500',
  'DAAS': 'bg-stone-500',
  'R': 'bg-zinc-500',
  'T': 'bg-gray-500',
}

const ROWS = [
  'Astreintes ATL Matin',
  'Astreintes ATL Midi',
  'Astreintes ATL Nuit',
  'Garde Matin',
  'Garde Midi',
  'Garde Nuit',
  'Hors Site Matin',
  'Hors Site Midi',
  'Hors Site Nuit',
  'RÉEDUCATION',
  'PSSL',
  'Notes du jour',
  'Congés'
]

const DAYS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM']

export default function PlanningPage() {
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [selectedCell, setSelectedCell] = useState<{ row: string; day: string } | null>(null)
  const [schedule, setSchedule] = useState<ScheduleData>({})
  const [currentCellDoctors, setCurrentCellDoctors] = useState<string[]>([])

  // Get week dates
  const getWeekDates = (date: Date): Date[] => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(d.setDate(diff))
    
    const dates = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday)
      date.setDate(monday.getDate() + i)
      dates.push(date)
    }
    return dates
  }

  const weekDates = getWeekDates(currentDate)
  const weekKey = `week_${weekDates[0].getTime()}`

  // Initialize schedule
  useEffect(() => {
    const newSchedule: ScheduleData = {}
    ROWS.forEach(row => {
      newSchedule[row] = {}
      DAYS.forEach((_, index) => {
        const dayKey = weekDates[index].toISOString().split('T')[0]
        newSchedule[row][dayKey] = {
          value: [],
          type: 'doctor',
          status: 'pending'
        }
      })
    })
    setSchedule(newSchedule)
  }, [weekKey])

  // Update current cell doctors when selectedCell changes
  useEffect(() => {
    if (selectedCell && schedule[selectedCell.row]) {
      const entry = schedule[selectedCell.row][selectedCell.day]
      setCurrentCellDoctors(entry?.value || [])
      console.log('🔍 selectedCell mis à jour:', selectedCell)
      console.log('🔍 Schedule data for selected cell:', entry)
    }
  }, [selectedCell, schedule])

  // Handle cell click
  const handleCellClick = (rowKey: string, day: string) => {
    console.log('🔍 handleCellClick appelé pour', rowKey, day)
    
    if (rowKey === 'Notes du jour' || rowKey === 'Congés') {
      console.log('🔍 Rangée bloquée (Notes/Congés), retour')
      return
    }
    
    const dayDate = weekDates[DAYS.indexOf(day)].toISOString().split('T')[0]
    console.log('🔍 Mise à jour selectedCell avec:', { row: rowKey, day: dayDate })
    setSelectedCell({ row: rowKey, day: dayDate })
  }

  // Add doctor to cell
  const addDoctorToCell = (doctor: string) => {
    if (!selectedCell || !schedule[selectedCell.row]) return
    
    const newDoctors = [...currentCellDoctors]
    if (!newDoctors.includes(doctor)) {
      newDoctors.push(doctor)
      setCurrentCellDoctors(newDoctors)
      
      const newSchedule = { ...schedule }
      newSchedule[selectedCell.row][selectedCell.day] = {
        value: newDoctors,
        type: 'doctor',
        status: 'pending'
      }
      setSchedule(newSchedule)
    }
  }

  // Remove doctor from cell
  const removeDoctorFromCell = (doctor: string) => {
    const newDoctors = currentCellDoctors.filter(d => d !== doctor)
    setCurrentCellDoctors(newDoctors)
    
    if (selectedCell && schedule[selectedCell.row]) {
      const newSchedule = { ...schedule }
      newSchedule[selectedCell.row][selectedCell.day] = {
        value: newDoctors,
        type: 'doctor',
        status: 'pending'
      }
      setSchedule(newSchedule)
    }
  }

  // Navigation
  const goToPreviousWeek = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() - 7)
    setCurrentDate(newDate)
  }

  const goToNextWeek = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + 7)
    setCurrentDate(newDate)
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Calendar className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Planning Cardiomaine</h1>
              <p className="text-sm text-slate-500">Semaine {weekDates[0].toLocaleDateString('fr-FR', { month: 'long', day: 'numeric' })} - {weekDates[6].toLocaleDateString('fr-FR', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPreviousWeek}
              className="px-2"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
            >
              Aujourd'hui
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextWeek}
              className="px-2"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <ScrollArea className="flex-1 w-full">
        <div className="p-6">
          <Card className="overflow-hidden border-slate-200">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200">
                  <th className="p-3 text-left text-sm font-semibold text-slate-700 w-40 border-r border-slate-200">Ligne</th>
                  {DAYS.map((day, index) => (
                    <th key={day} className="p-3 text-center text-sm font-semibold text-slate-700 border-r last:border-r-0 border-slate-200">
                      <div>{day}</div>
                      <div className="text-xs font-normal text-slate-500">
                        {weekDates[index].toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((rowKey) => (
                  <tr key={rowKey} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="p-3 text-sm font-medium text-slate-700 border-r border-slate-200 bg-slate-50">
                      {rowKey}
                    </td>
                    {DAYS.map((day, index) => {
                      const dayDate = weekDates[index].toISOString().split('T')[0]
                      const entry = schedule[rowKey]?.[dayDate]
                      const isSelected = selectedCell?.row === rowKey && selectedCell?.day === dayDate
                      const isClickable = rowKey !== 'Notes du jour' && rowKey !== 'Congés'

                      return (
                        <td
                          key={`${rowKey}-${day}`}
                          onClick={() => isClickable && handleCellClick(rowKey, day)}
                          className={`p-2 text-center border-r last:border-r-0 h-16 ${
                            isSelected ? 'bg-blue-100' : ''
                          } ${isClickable ? 'cursor-pointer hover:bg-slate-100' : 'bg-gray-100 cursor-not-allowed'} border-slate-200`}
                        >
                          <div className="flex flex-wrap gap-1 justify-center h-full items-center">
                            {entry?.value?.map((doctor) => (
                              <Badge
                                key={doctor}
                                className={`${DOCTOR_COLORS[doctor] || 'bg-gray-500'} text-white text-xs cursor-pointer`}
                                onClick={(e) => {
                                  e.stopPropagation()
                                }}
                              >
                                {doctor}
                              </Badge>
                            ))}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Voice and Upload Panel */}
          <div className="mt-8">
            <VoiceAndUploadPanel
              onCommandExecuted={(result) => {
                console.log('[v0] Voice command executed:', result)
                if (result?.updated) {
                  // Refresh planning
                }
              }}
              isOpen={true}
              weekStartDate={weekDates[0]?.toISOString().split('T')[0]}
            />
          </div>
        </div>
      </ScrollArea>

      {/* Modal de sélection des médecins */}
      <Dialog open={!!selectedCell} onOpenChange={(open) => !open && setSelectedCell(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedCell?.row} - {selectedCell?.day}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Grille de sélection */}
            <div>
              <p className="text-sm font-medium text-slate-700 mb-3">Ajouter un médecin</p>
              <div className="grid grid-cols-7 gap-2">
                {DOCTORS.map(doctor => (
                  <Button
                    key={doctor}
                    onClick={() => addDoctorToCell(doctor)}
                    className={`${DOCTOR_COLORS[doctor] || 'bg-gray-500'} text-white text-xs h-8`}
                    variant="default"
                  >
                    {doctor}
                  </Button>
                ))}
              </div>
            </div>

            {/* Médecins présents */}
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Médecins présents</p>
              <div className="flex flex-wrap gap-2">
                {currentCellDoctors.length === 0 ? (
                  <p className="text-sm text-slate-500">Aucun médecin assigné</p>
                ) : (
                  currentCellDoctors.map(doctor => (
                    <Badge
                      key={doctor}
                      className={`${DOCTOR_COLORS[doctor] || 'bg-gray-500'} text-white`}
                    >
                      {doctor}
                      <button
                        onClick={() => removeDoctorFromCell(doctor)}
                        className="ml-1 text-white hover:opacity-75"
                      >
                        ×
                      </button>
                    </Badge>
                  ))
                )}
              </div>
            </div>

            <Button
              onClick={() => setSelectedCell(null)}
              variant="outline"
              className="w-full"
            >
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
