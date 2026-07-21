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
          console.error('[v0] Supabase client not available')
          return
        }

        // Get current user
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) {
          console.log('[v0] No authenticated user, redirecting to login')
          router.push('/auth/login')
          return
        }
        
        // Redirect to planning page
        console.log('[v0] User authenticated, redirecting to planning')
        router.push('/protected/planning')
      } catch (error) {
        console.error('[v0] Error initializing protected page:', error)
      }
    }

    initializeApp()
  }, [router, supabase])

  return null
}
