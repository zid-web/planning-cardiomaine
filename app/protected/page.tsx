'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ScheduleApp } from '@/components/schedule-app'
import type { FullSchedule, ScheduleData } from '@/lib/types'
import { generateWeekSchedule, getWeekNumber } from '@/lib/schedule-utils'

export default function ProtectedPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [fullSchedule, setFullSchedule] = useState<FullSchedule>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initializeApp = async () => {
      try {
        if (!supabase) {
          setError('Authentication service is not configured. Please contact support.')
          setIsLoading(false)
          return
        }

        // Get current user
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) {
          router.push('/auth/login')
          return
        }
        setUser(authUser)

        // Get user profile with role and doctor_code
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('role, doctor_code')
          .eq('id', authUser.id)
          .single()

        if (profileError) {
          console.error('[v0] Error fetching profile:', profileError)
          setError('Failed to load user profile')
          setIsLoading(false)
          return
        }
        setProfile(profileData)

        // Load all schedules from Supabase
        const { data: schedules, error: schedulesError } = await supabase
          .from('schedules')
          .select('week_key, schedule_data')
          .order('week_key', { ascending: true })

        if (schedulesError && schedulesError.code !== 'PGRST116') {
          console.error('[v0] Error fetching schedules:', schedulesError)
          setError('Failed to load schedules')
          setIsLoading(false)
          return
        }

        // Build full schedule object from Supabase data
        const loadedSchedule: FullSchedule = {}
        if (schedules && schedules.length > 0) {
          schedules.forEach((schedule: any) => {
            if (schedule.week_key && schedule.week_key !== 'full_schedule') {
              loadedSchedule[schedule.week_key] = schedule.schedule_data as ScheduleData
            }
          })
        }

        // Generate current week if not in database
        const today = new Date()
        const weekInfo = getWeekNumber(today)
        const currentWeekKey = `${weekInfo.year}-W${weekInfo.week}`
        
        if (!loadedSchedule[currentWeekKey]) {
          loadedSchedule[currentWeekKey] = generateWeekSchedule(currentWeekKey)
        }

        setFullSchedule(loadedSchedule)
        setIsLoading(false)
      } catch (error) {
        console.error('[v0] Error initializing protected page:', error)
        setError('An error occurred while loading the application')
        setIsLoading(false)
      }
    }

    initializeApp()
  }, [router, supabase])

  const handleLogout = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const handleChangePassword = () => {
    router.push('/auth/setup-account')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement du planning...</p>
        </div>
      </div>
    )
  }

  if (error || !user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <p className="text-red-600 text-lg font-semibold">{error || 'Une erreur est survenue'}</p>
          <button
            onClick={() => router.push('/auth/login')}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Retour à la connexion
          </button>
        </div>
      </div>
    )
  }

  const isAdmin = profile.role === 'admin'
  const doctorCode = profile.doctor_code || ''
  const currentUserEmail = user.email || ''

  return (
    <ScheduleApp
      currentUser={currentUserEmail}
      doctorCode={doctorCode}
      isAdmin={isAdmin}
      fullSchedule={fullSchedule}
      setFullSchedule={setFullSchedule}
      onLogout={handleLogout}
      onChangePassword={handleChangePassword}
    />
  )
}
