'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Zap } from 'lucide-react'
import { generateGuardsViaAPI } from '@/app/actions/guard-api-actions'
import { DoctorVacation, ScheduleData } from '@/lib/types'
import { toast } from 'sonner'

interface GuardGenerationButtonProps {
  weekKey: string
  vacations: DoctorVacation[]
  onGenerationComplete: (schedule: ScheduleData, warnings: string[]) => void
  disabled?: boolean
}

export function GuardGenerationButton({
  weekKey,
  vacations,
  onGenerationComplete,
  disabled = false,
}: GuardGenerationButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleGenerateGuards = async () => {
    setIsLoading(true)
    toast.loading('Génération en cours... Cela peut prendre jusqu\'à une minute...', {
      id: 'guard-generation',
    })

    try {
      const result = await generateGuardsViaAPI(weekKey, vacations)

      if (!result.success) {
        toast.error(`Erreur: ${result.error}`, { id: 'guard-generation' })
        return
      }

      if (result.schedule) {
        // Afficher les warnings s'il y en a
        if (result.warnings && result.warnings.length > 0) {
          toast.warning('Alertes de génération:\n' + result.warnings.join('\n'), {
            id: 'guard-generation',
            duration: 5000,
          })
        } else {
          toast.success('Planning généré avec succès!', { id: 'guard-generation' })
        }

        // Appeler la callback avec les résultats
        onGenerationComplete(result.schedule, result.warnings || [])
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
      toast.error(`Erreur: ${errorMessage}`, { id: 'guard-generation' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      onClick={handleGenerateGuards}
      disabled={disabled || isLoading}
      className="gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
      title="Génère le planning via l'API d'optimisation (moteur avancé)"
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Génération...</span>
        </>
      ) : (
        <>
          <Zap className="w-4 h-4" />
          <span>Générer le planning</span>
          <span className="text-xs font-medium opacity-75">(moteur d'optimisation)</span>
        </>
      )}
    </Button>
  )
}
