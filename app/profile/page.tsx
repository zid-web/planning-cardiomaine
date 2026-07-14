import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LogoutButton } from '@/components/logout-button'
import { ProfileForm } from '@/components/profile-form'

export default async function ProfilePage() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect('/auth/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="border-b bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Cardiomaine Planning</h1>
          <LogoutButton />
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">Mon Profil</h2>
          
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-gray-700">
              <span className="font-semibold">Email:</span> {data.user.email}
            </p>
            <p className="text-gray-700 text-sm mt-2">
              <span className="font-semibold">ID utilisateur:</span> {data.user.id}
            </p>
          </div>

          <ProfileForm user={data.user} supabaseClient={supabase} />
        </div>
      </main>
    </div>
  )
}
