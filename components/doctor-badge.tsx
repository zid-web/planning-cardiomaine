'use client'

import React from 'react'
import { DOCTOR_METADATA } from '@/lib/constants'
import { Badge } from '@/components/ui/badge'

interface DoctorBadgeProps {
  doctorId: string
  showStatus?: boolean
  className?: string
}

export function DoctorBadge({ doctorId, showStatus = false, className = '' }: DoctorBadgeProps) {
  const metadata = DOCTOR_METADATA[doctorId]

  if (!metadata) {
    return <Badge className={`bg-gray-400 ${className}`}>{doctorId}</Badge>
  }

  let bgColor = ''
  let statusText = ''

  // Couleurs basées sur le statut
  if (metadata.status === 'admin') {
    bgColor = 'bg-purple-600'
  } else if (metadata.status === 'ch') {
    bgColor = 'bg-sky-600'
  } else if (metadata.status === 'externe_garde') {
    bgColor = 'bg-amber-600'
  } else if (metadata.status === 'externe_consultation') {
    bgColor = 'bg-violet-600'
  } else {
    bgColor = 'bg-blue-600'
  }

  if (showStatus && metadata.is_externe) {
    if (metadata.status === 'externe_consultation') {
      statusText = ' (Consultation)'
    } else if (metadata.status === 'externe_garde') {
      statusText = ' (Astreinte)'
    } else if (metadata.status === 'ch') {
      statusText = ' (CH)'
    }
  }

  return (
    <Badge
      className={`${bgColor} text-white ${className}`}
      title={metadata.name}
    >
      {doctorId}
      {statusText}
    </Badge>
  )
}
