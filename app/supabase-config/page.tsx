'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SupabaseConfigPage() {
  const [status, setStatus] = useState<string>('Vérification...')
  const [config, setConfig] = useState<any>(null)

  useEffect(() => {
    const checkSupabase = async () => {
      try {
        const supabase = createClient()

        // Vérifier la connexion
        const { data, error } = await supabase.auth.getSession()

        if (error) {
          setStatus(`Erreur: ${error.message}`)
          return
        }

        setStatus('✅ Supabase connecté avec succès!')
        setConfig({
          url: process.env.NEXT_PUBLIC_SUPABASE_URL,
          hasAnon: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          session: data.session ? 'Actif' : 'Aucune session',
        })
      } catch (error) {
        setStatus(`Erreur: ${error}`)
      }
    }

    checkSupabase()
  }, [])

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto mt-10">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold mb-4 text-gray-800">Configuration Supabase</h1>

          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded mb-6">
            <p className="text-lg font-semibold text-blue-900">{status}</p>
          </div>

          {config && (
            <div className="space-y-4">
              <div className="border rounded p-4">
                <h3 className="font-semibold text-gray-700 mb-2">Détails de la configuration</h3>
                <pre className="bg-gray-100 p-3 rounded text-sm text-gray-800 overflow-auto">
                  {JSON.stringify(config, null, 2)}
                </pre>
              </div>

              <div className="bg-green-50 border border-green-200 rounded p-4">
                <h3 className="font-semibold text-green-900 mb-2">✅ Prochaines étapes</h3>
                <ul className="list-disc list-inside space-y-1 text-green-800">
                  <li>Créer les tables nécessaires dans Supabase</li>
                  <li>Configurer les politiques de sécurité (RLS)</li>
                  <li>Mettre à jour votre application avec les actions Supabase</li>
                </ul>
              </div>
            </div>
          )}

          <div className="mt-8">
            <a
              href="/"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded"
            >
              Retour à l'accueil
            </a>
          </div>
        </div>
      </div>
    </main>
  )
}
