import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { LogoutButton } from './logout-button'
import { MessageSquare } from 'lucide-react'
import InstallButton from './install-button'

export async function Navbar() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()

  return (
    <nav className="border-b bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <Link href={data?.user ? '/protected' : '/home'} className="text-2xl font-bold text-gray-900 hover:text-blue-600 transition">
          Cardiomaine Planning
        </Link>

        <div className="flex items-center gap-4">
          <InstallButton />
          {data?.user ? (
            <>
              <span className="text-gray-600">{data.user.email}</span>
              <Link href="/protected/planning-notes" title="Consignes de planning">
                <Button variant="outline" size="sm" className="gap-2">
                  <MessageSquare className="w-4 h-4" />
                  <span className="hidden sm:inline">Consignes</span>
                </Button>
              </Link>
              <Link href="/profile">
                <Button variant="outline" size="sm">
                  Mon Profil
                </Button>
              </Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/auth/login">
                <Button variant="outline" size="sm">
                  Se connecter
                </Button>
              </Link>
              <Link href="/auth/sign-up">
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                  S&apos;inscrire
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
