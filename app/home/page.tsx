import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function HomePage() {

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <nav className="border-b bg-white/80 backdrop-blur-sm shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Cardiomaine Planning</h1>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-24">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                Gestion de Planification Médicale
              </h2>
              <p className="text-xl text-gray-600">
                Organisez et gérez votre planning médical avec un système sécurisé et intuitif.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 mt-1">
                  ✓
                </div>
                <p className="text-gray-700">Authentification sécurisée avec Supabase</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 mt-1">
                  ✓
                </div>
                <p className="text-gray-700">Gestion des utilisateurs et des rôles</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 mt-1">
                  ✓
                </div>
                <p className="text-gray-700">Calendrier intégré et synchronisation en temps réel</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 mt-1">
                  ✓
                </div>
                <p className="text-gray-700">Accès depuis n'importe quel appareil</p>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Link href="/auth/login">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3">
                  Se connecter
                </Button>
              </Link>
              <Link href="/auth/sign-up">
                <Button variant="outline" className="px-8 py-3">
                  S&apos;inscrire
                </Button>
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg shadow-2xl p-8 text-white">
              <h3 className="text-2xl font-bold mb-6">Commencez maintenant</h3>
              
              <div className="space-y-6">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <h4 className="font-semibold mb-2">1. Créez un compte</h4>
                  <p className="text-white/90">Inscrivez-vous gratuitement avec votre email</p>
                </div>

                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <h4 className="font-semibold mb-2">2. Confirmez votre email</h4>
                  <p className="text-white/90">Vérifiez votre email pour activer votre compte</p>
                </div>

                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <h4 className="font-semibold mb-2">3. Accédez au planning</h4>
                  <p className="text-white/90">Connectez-vous et commencez à gérer votre calendrier</p>
                </div>

                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <h4 className="font-semibold mb-2">4. Collaborez</h4>
                  <p className="text-white/90">Invitez des collègues et synchronisez en temps réel</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t bg-white/50 backdrop-blur-sm mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-gray-600">
            Cardiomaine Planning © 2024 - Propulsé par Supabase et Next.js
          </p>
        </div>
      </footer>
    </div>
  )
}
