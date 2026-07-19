'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Brain } from 'lucide-react'
import { generateWeekWithSolver } from '@/app/actions/solver-api-actions'
import { ScheduleData } from '@/lib/types'
import { toast } from 'sonner'
import { getWeekNumber } from '@/lib/schedule-utils'

interface SolverGenerationButtonProps {
  currentDate: Date
  weekendMode: 'CH' | 'ROTATION'
  currentSchedule?: ScheduleData
  onGenerationComplete: (schedule: ScheduleData, warnings: string[]) => void
  disabled?: boolean
}

export function SolverGenerationButton({
  currentDate,
  weekendMode,
  currentSchedule,
  onGenerationComplete,
  disabled = false,
}: SolverGenerationButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleGenerateWithSolver = async () => {
    setIsLoading(true)
    const toastId = toast.loading('Génération avec solveur en cours... (jusqu\'à 65s)')

    try {
      const weekStart = new Date(currentDate)
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1) // Lundi
      const weekStartStr = weekStart.toISOString().split('T')[0]

      console.log('[v0] Calling solver API for week starting:', weekStartStr)

      const result = await generateWeekWithSolver(weekStartStr, weekendMode, currentSchedule)

      if (result.error) {
        toast.error(`Erreur: ${result.error}`, { id: toastId })
        return
      }

      if (!result.schedule) {
        toast.error('Aucun planning généré', { id: toastId })
        return
      }

      if (result.warnings && result.warnings.length > 0) {
        toast.warning(
          `Planning généré avec ${result.warnings.length} avertissement(s):\n${result.warnings.slice(0, 3).join('\n')}`,
          { id: toastId, duration: 5000 }
        )
      } else {
        toast.success('Planning généré avec succès!', { id: toastId })
      }

      onGenerationComplete(result.schedule, result.warnings)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
      console.error('[v0] Solver error:', error)
      toast.error(`Erreur: ${errorMessage}`, { id: toastId })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      onClick={handleGenerateWithSolver}
      disabled={disabled || isLoading}
      className="gap-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white"
      title="Génère le planning avec le solveur d'optimisation avancé (moteur IA)"
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Solveur...</span>
        </>
      ) : (
        <>
          <Brain className="w-4 h-4" />
          <span>Solveur (IA)</span>
          <span className="text-xs font-medium opacity-75">v2</span>
        </>
      )}
    </Button>
  )
}
