'use client'

import React from 'react'
import { DoctorVacation } from '@/lib/types'
import { isDoctorOnVacation } from '@/lib/vacation-utils'

interface VacationsBadgeProps {
  doctorCode: string
  date: Date
  vacations: DoctorVacation[]
  size?: 'sm' | 'md' | 'lg'
}

export function VacationsBadge({ doctorCode, date, vacations, size = 'md' }: VacationsBadgeProps) {
  // Chercher une vacation qui contient cette date ET a le doctor_code correspondant
  const isOnVacation = vacations.some((vacation) => {
    const startDate = new Date(vacation.start_date)
    const endDate = new Date(vacation.end_date)
    // Comparer avec le doctor_code si disponible, sinon avec doctor_id
    const matchesDoctorCode =
      vacation.doctor_id === doctorCode || vacation.doctor_id?.includes(doctorCode)
    return matchesDoctorCode && date >= startDate && date <= endDate
  })

  if (!isOnVacation) return null

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 text-center',
    md: 'text-sm px-2.5 py-1 text-center',
    lg: 'text-base px-3 py-1.5 text-center',
  }

  const initials = doctorCode.substring(0, 1).toUpperCase()

  return (
    <span
      className={`inline-flex items-center justify-center bg-amber-100 text-amber-800 rounded-full font-semibold border border-amber-200 ${sizeClasses[size]}`}
      title={`Dr. ${doctorCode} en vacances`}
      role="status"
      aria-label={`Dr. ${doctorCode} en vacances`}
    >
      {initials}
    </span>
  )
}
