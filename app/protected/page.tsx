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
          console.error('[protected] Supabase client not available')
          return
        }

        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) {
          router.push('/auth/login')
          return
        }

        router.push('/protected/planning')
      } catch (error) {
        console.error('[protected] Error initializing protected page:', error)
      }
    }

    void initializeApp()
  }, [router, supabase])

  return null
}
