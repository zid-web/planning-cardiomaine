'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function LogoutButton() {
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
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
