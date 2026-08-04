'use client'

import { createClient } from '@/lib/supabase/client'
import { signOut } from '@/app/actions/auth-actions'
import { Button } from '@/components/ui/button'

export function LogoutButton() {
  const handleLogout = async () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.clear()
        sessionStorage.clear()
        if ('caches' in window) {
          const keys = await caches.keys()
          await Promise.all(keys.map((k) => caches.delete(k)))
        }
      }
    } catch (e) {
      console.error('[auth] clear storage error:', e)
    }

    try {
      const supabase = createClient()
      await supabase.auth.signOut({ scope: 'global' })
    } catch (e) {
      console.error('[auth] supabase signOut error:', e)
    }

    try {
      await signOut()
    } catch (e) {
      console.error('[auth] server signOut error:', e)
    }

    if (typeof window !== 'undefined') {
      window.location.href = '/auth/login'
    }
  }

  return (
    <Button
      onClick={handleLogout}
      variant="outline"
      className="bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
    >
      Se déconnecter
    </Button>
  )
}
