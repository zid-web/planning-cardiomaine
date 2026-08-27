'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Zap } from 'lucide-react'
import { generateGuardsViaAPI } from '@/app/actions/guard-api-actions'
import { DoctorVacation, ScheduleData } from '@/lib/types'
import { getWeekNumber } from '@/lib/schedule-utils'
import { parseISO } from 'date-fns'
import {
  defaultWeekGenerationParams,
  toSolverWeekGenerationOverrides,
} from '@/lib/week-generation-params'
import { toast } from 'sonner'

interface GuardGenerationButtonProps {
  weekKey: string
  vacations: DoctorVacation[]
  onGenerationComplete: (schedule: ScheduleData, warnings: string[]) => void
  disabled?: boolean
  className?: string
  /**
   * Planning actuellement affiché (avant sauvegarde en base) - transmis au
   * solveur pour qu'il connaisse les positions déjà présentes (infirmières
   * Val/Véro/Laura sur Stress/EE notamment) même si la semaine n'a jamais
   * encore été enregistrée en base (confirmé bug utilisateur 31/07/2026 :
   * sans ça, une semaine jamais sauvegardée n'avait aucune position
   * d'infirmière à transmettre, le solveur ne proposait donc aucun
   * partenaire médecin).
   */
  currentSchedule?: ScheduleData
}

export function GuardGenerationButton({
  weekKey,
  vacations,
  onGenerationComplete,
  disabled = false,
  className = '',
  currentSchedule,
}: GuardGenerationButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const weekNum = useMemo(() => {
    try {
      return getWeekNumber(parseISO(weekKey)).week
    } catch {
      return 1
    }
  }, [weekKey])

  const handleGenerateGuards = async () => {
    setIsLoading(true)
    toast.loading("Génération en cours... Cela peut prendre jusqu'à une minute...", {
      id: 'guard-generation',
    })

    try {
      // Paramètres calculés automatiquement selon les rotations (PSSL, LFB, VISITE).
      // Règles métier encodées dans defaultWeekGenerationParams :
      //   • PSSL : B (impaires) / Z (paires), repli sur l'autre si B est en VISITE
      //   • LFB  : G → S → H (1/3), repli solveur sur les deux autres si indisponible
      //   • LFB + PSSL suspendus S28–S36 (congés d'été)
      const params   = defaultWeekGenerationParams(weekNum)
      const overrides = toSolverWeekGenerationOverrides(params)

      const result = await generateGuardsViaAPI(
        weekKey,
        vacations,
        'ROTATION',
        undefined,
        overrides,
        currentSchedule,
      )

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
          const actionable = (result.warnings as string[]).filter(
            (w) =>
              !/historical_patterns\s*:.*non reconnu/i.test(w) &&
              !/non disponible.*vacances\/congé/i.test(w) &&
              !/^FV\s*:.*non disponible/i.test(w),
          )
          const infeasible = actionable.some((w) =>
            /aucune solution trouvée/i.test(w),
          )
          if (infeasible) {
            toast.error(
              `Solveur sans solution${patternNote}:\n` + actionable.join('\n'),
              { id: 'guard-generation', duration: 12000 },
            )
          } else if (actionable.length > 0) {
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
      title="Générer et compléter toutes les cases vides ou manquantes sans modifier les affectations validées"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Génération…</span>
        </>
      ) : (
        <>
          <Zap className="h-3.5 w-3.5" />
          <span>Générer (remplir cases vides)</span>
        </>
      )}
    </Button>
  )
}
