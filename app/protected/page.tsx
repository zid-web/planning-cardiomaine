'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ProtectedPage() {
  const router = useRouter()
  const supabase = createClient()

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
        
        // Redirect to planning page
        router.push('/protected/planning')
      } catch (error) {
        console.error('[v0] Error initializing protected page:', error)
        setError('An error occurred while loading the application')
        setIsLoading(false)
      }
    }

    initializeApp()
  }, [router, supabase])

  return null
}
