'use client'

import { useRouter } from 'next/navigation'
import { ScheduleApp } from '@/components/schedule-app'

export default function ProtectedPage() {
  const router = useRouter()

  const handleLogout = async () => {
    router.push('/auth/login')
  }

  const handleChangePassword = () => {
    router.push('/auth/setup-account')
  }

  return (
    <ScheduleApp
      onLogout={handleLogout}
      onChangePassword={handleChangePassword}
    />
  )
}
