import { getOrRequestIntegration } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function SetupSupabasePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="border-b bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Configuration Supabase</h1>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">
            Configuration des tables Supabase
          </h2>

          <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h3 className="font-semibold text-yellow-900 mb-2">⚠️ Instructions de configuration</h3>
            <p className="text-yellow-800">
              Veuillez exécuter les requêtes SQL suivantes dans votre tableau de bord Supabase pour créer les tables nécessaires.
            </p>
          </div>

          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">1. Créer la table des profils</h3>
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto font-mono text-sm">
                <pre>{`-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, now()) NOT NULL
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete their own profile" ON public.profiles
  FOR DELETE USING (auth.uid() = id);`}</pre>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">2. Créer le trigger pour auto-créer les profils</h3>
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto font-mono text-sm">
                <pre>{`-- Create trigger function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data ->> 'first_name', ''),
    COALESCE(new.raw_user_meta_data ->> 'last_name', '')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();`}</pre>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold text-blue-900 mb-2">✓ Prochaines étapes</h3>
              <ol className="list-decimal list-inside text-blue-800 space-y-2">
                <li>Allez sur votre <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline font-semibold">tableau de bord Supabase</a></li>
                <li>Sélectionnez votre projet</li>
                <li>Allez dans "SQL Editor"</li>
                <li>Exécutez le SQL fourni ci-dessus</li>
                <li>Retournez à l&apos;application pour commencer</li>
              </ol>
            </div>

            <div className="flex gap-4">
              <Link href="/home">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  Retour à l&apos;accueil
                </Button>
              </Link>
              <Link href="/auth/login">
                <Button variant="outline">
                  Se connecter
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
