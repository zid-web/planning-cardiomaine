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
  className?: string
}

export function GuardGenerationButton({
  weekKey,
  vacations,
  onGenerationComplete,
  disabled = false,
  className = '',
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
        const pf = result.patternFill
        const patternNote =
          pf && pf.applied > 0
            ? ` · ${pf.applied} vacation(s) Cs/ETT/EE depuis l’historique`
            : ''

        // Afficher les warnings s'il y en a
        if (result.warnings && result.warnings.length > 0) {
          toast.warning(
            `Alertes de génération${patternNote}:\n` + result.warnings.join('\n'),
            {
              id: 'guard-generation',
              duration: 5000,
            },
          )
        } else {
          toast.success(`Planning généré avec succès${patternNote}`, {
            id: 'guard-generation',
          })
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
      size="sm"
      className={`h-7 gap-1 bg-gradient-to-r from-blue-600 to-blue-700 px-2 text-[11px] hover:from-blue-700 hover:to-blue-800 ${className}`}
      title="Génère gardes/astreintes/Coro (solveur) + vacations Cs/ETT/EE (historique)"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Génération…</span>
        </>
      ) : (
        <>
          <Zap className="h-3.5 w-3.5" />
          <span>Générer</span>
        </>
      )}
    </Button>
  )
}
