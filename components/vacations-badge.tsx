'use client'

import { DoctorVacation } from '@/lib/types'
import { isDoctorOnVacation } from '@/lib/vacation-utils'

interface VacationsBadgeProps {
  doctorId: string
  date: Date
  vacations: DoctorVacation[]
  size?: 'sm' | 'md' | 'lg'
}

export function VacationsBadge({ doctorId, date, vacations, size = 'md' }: VacationsBadgeProps) {
  const isOnVacation = isDoctorOnVacation(doctorId, date, vacations)

  if (!isOnVacation) return null

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2',
  }

  return (
    <span
      className={`inline-block bg-yellow-100 text-yellow-800 rounded-full font-semibold ${sizeClasses[size]}`}
      title="Médecin en vacances"
    >
      ✈️ Congés
    </span>
  )
}
