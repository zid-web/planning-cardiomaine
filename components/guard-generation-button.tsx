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
        const meta = result.historicalPatternsMeta
        const patternNote =
          meta && meta.slotsSent > 0
            ? ` · ${meta.slotsSent} créneau(x) historiques envoyés au solveur (${meta.weeksScanned} sem.)`
            : ''

        if (result.warnings && result.warnings.length > 0) {
          // Bruit attendu : row_key hors allowlist (ignorés), créneaux soft
          // sautés si congé (FV/Rythmo). Ne garder que les alertes actionnables.
          const actionable = result.warnings.filter(
            (w) =>
              !/historical_patterns\s*:.*non reconnu/i.test(w) &&
              !/non disponible.*vacances\/congé/i.test(w) &&
              !/^FV\s*:.*non disponible/i.test(w),
          )
          if (actionable.length > 0) {
            toast.warning(
              `Alertes de génération${patternNote}:\n` + actionable.join('\n'),
              {
                id: 'guard-generation',
                duration: 8000,
              },
            )
          } else {
            toast.success(`Propositions générées (à valider)${patternNote}`, {
              id: 'guard-generation',
            })
          }
        } else {
          toast.success(`Propositions générées (à valider)${patternNote}`, {
            id: 'guard-generation',
          })
        }

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
      title="Une seule génération : gardes/astreintes/Coro + Cs/ETT/EE/hors site (historical_patterns) — pending à valider"
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
