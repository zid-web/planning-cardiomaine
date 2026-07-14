import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LogoutButton } from '@/components/logout-button'

export default async function ProtectedPage() {
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Bienvenue, {data.user.email}
            </h2>
            <p className="text-gray-600">
              Vous êtes connecté et prêt à utiliser l&apos;application.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
              <h3 className="font-semibold text-lg text-gray-900 mb-2">
                Profil
              </h3>
              <p className="text-gray-600">
                Email: <span className="font-medium">{data.user.email}</span>
              </p>
              <p className="text-gray-600 text-sm mt-2">
                ID: {data.user.id}
              </p>
            </div>

            <div className="bg-green-50 rounded-lg p-6 border border-green-200">
              <h3 className="font-semibold text-lg text-gray-900 mb-2">
                Statut
              </h3>
              <p className="text-green-600 font-medium">Authentifié</p>
              <p className="text-gray-600 text-sm mt-2">
                Connexion confirmée via Supabase
              </p>
            </div>

            <div className="bg-purple-50 rounded-lg p-6 border border-purple-200">
              <h3 className="font-semibold text-lg text-gray-900 mb-2">
                Session
              </h3>
              <p className="text-gray-600 text-sm">
                Vous pouvez maintenant accéder à tous les services sécurisés de l&apos;application.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
