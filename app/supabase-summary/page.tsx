import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function SupabaseSummary() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <nav className="border-b bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Configuration Supabase - Résumé</h1>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-8">
          {/* Authentification Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">✅</span> Authentification Supabase
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">L&apos;authentification complète est maintenant configurée :</p>
              <ul className="space-y-3 ml-4">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-1">→</span>
                  <div>
                    <strong>Pages d&apos;authentification</strong>
                    <ul className="ml-4 mt-1 text-sm text-gray-600 space-y-1">
                      <li>• Sign-up : <code className="bg-gray-200 px-2 py-1">/auth/sign-up</code></li>
                      <li>• Login : <code className="bg-gray-200 px-2 py-1">/auth/login</code></li>
                      <li>• Callback : <code className="bg-gray-200 px-2 py-1">/auth/callback</code></li>
                      <li>• Erreur : <code className="bg-gray-200 px-2 py-1">/auth/error</code></li>
                    </ul>
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Pages Protégées Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">🔒</span> Pages Protégées
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">Pages sécurisées disponibles :</p>
              <ul className="space-y-3 ml-4">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <div>
                    <strong>Page Protégée</strong> (<code className="bg-gray-200 px-2 py-1">/protected</code>)
                    <p className="text-sm text-gray-600 mt-1">Affiche les infos de l&apos;utilisateur connecté</p>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <div>
                    <strong>Profil Utilisateur</strong> (<code className="bg-gray-200 px-2 py-1">/profile</code>)
                    <p className="text-sm text-gray-600 mt-1">Gestion du profil avec RLS</p>
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Configuration Base de Données Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">🗄️</span> Configuration Base de Données
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700 mb-4">Pour terminer la configuration, vous devez créer les tables dans Supabase :</p>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-900"><strong>⚠️ Important :</strong> Copiez et exécutez le SQL ci-dessous dans le tableau de bord Supabase.</p>
              </div>

              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto font-mono text-xs space-y-3">
                <div>
                  <p className="text-gray-400 mb-2">-- 1. Créer la table profiles</p>
                  <pre className="bg-gray-800 p-2 rounded overflow-x-auto">{`CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, now()) NOT NULL
);`}</pre>
                </div>

                <div>
                  <p className="text-gray-400 mb-2">-- 2. Activer RLS</p>
                  <pre className="bg-gray-800 p-2 rounded">{`ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;`}</pre>
                </div>

                <div>
                  <p className="text-gray-400 mb-2">-- 3. Créer les politiques RLS</p>
                  <pre className="bg-gray-800 p-2 rounded overflow-x-auto">{`CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can delete their own profile" ON public.profiles
  FOR DELETE USING (auth.uid() = id);`}</pre>
                </div>

                <div>
                  <p className="text-gray-400 mb-2">-- 4. Créer le trigger pour auto-créer les profils</p>
                  <pre className="bg-gray-800 p-2 rounded overflow-x-auto">{`CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (new.id, new.email, '', '');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();`}</pre>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Fichiers Créés Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">📁</span> Fichiers Créés
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm space-y-2">
                <p><strong>Lib Supabase:</strong></p>
                <ul className="ml-4 text-gray-600 space-y-1">
                  <li>• <code className="bg-gray-200 px-1">lib/supabase/client.ts</code></li>
                  <li>• <code className="bg-gray-200 px-1">lib/supabase/server.ts</code></li>
                  <li>• <code className="bg-gray-200 px-1">lib/supabase/proxy.ts</code></li>
                </ul>
              </div>
              
              <div className="text-sm space-y-2">
                <p><strong>Composants:</strong></p>
                <ul className="ml-4 text-gray-600 space-y-1">
                  <li>• <code className="bg-gray-200 px-1">components/logout-button.tsx</code></li>
                  <li>• <code className="bg-gray-200 px-1">components/profile-form.tsx</code></li>
                  <li>• <code className="bg-gray-200 px-1">components/navbar.tsx</code></li>
                </ul>
              </div>

              <div className="text-sm space-y-2">
                <p><strong>Pages:</strong></p>
                <ul className="ml-4 text-gray-600 space-y-1">
                  <li>• <code className="bg-gray-200 px-1">app/home/page.tsx</code></li>
                  <li>• <code className="bg-gray-200 px-1">app/protected/page.tsx</code></li>
                  <li>• <code className="bg-gray-200 px-1">app/profile/page.tsx</code></li>
                  <li>• <code className="bg-gray-200 px-1">app/auth/login/page.tsx</code></li>
                  <li>• <code className="bg-gray-200 px-1">app/auth/sign-up/page.tsx</code></li>
                  <li>• <code className="bg-gray-200 px-1">app/setup-supabase/page.tsx</code></li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Navigation Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">🚀</span> Prochaines Étapes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="list-decimal list-inside space-y-3 text-gray-700">
                <li>Exécutez le SQL ci-dessus dans votre tableau de bord Supabase</li>
                <li>Testez la page d&apos;inscription : <code className="bg-gray-200 px-2 py-1">/auth/sign-up</code></li>
                <li>Confirmez votre email</li>
                <li>Connectez-vous : <code className="bg-gray-200 px-2 py-1">/auth/login</code></li>
                <li>Accédez à la page protégée : <code className="bg-gray-200 px-2 py-1">/protected</code></li>
              </ol>

              <div className="flex gap-4 pt-4 border-t">
                <Link href="/home">
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    Aller à l&apos;accueil
                  </Button>
                </Link>
                <Link href="/auth/sign-up">
                  <Button variant="outline">
                    Tester l&apos;inscription
                  </Button>
                </Link>
                <Link href="/setup-supabase">
                  <Button variant="outline">
                    Guide détaillé
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Documentation Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">📚</span> Documentation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 mb-4">Un fichier <code className="bg-gray-200 px-2 py-1">SUPABASE_SETUP.md</code> contient la documentation complète de l&apos;intégration.</p>
              <p className="text-sm text-gray-600">Consultez-le pour :</p>
              <ul className="ml-4 mt-2 text-sm text-gray-600 space-y-1">
                <li>• Les instructions de configuration détaillées</li>
                <li>• Les exemples d&apos;utilisation</li>
                <li>• Les bonnes pratiques de sécurité</li>
                <li>• Les solutions de dépannage</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
