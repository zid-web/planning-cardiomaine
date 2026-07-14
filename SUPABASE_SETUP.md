# Configuration Supabase - Cardiomaine Planning

## 🚀 Vue d'ensemble

Cette application intègre une authentification complète avec Supabase et Next.js 16. Toutes les routes protégées utilisent Row Level Security (RLS) pour garantir la sécurité des données.

## 📋 Configuration initiale

### 1. Supabase est déjà connecté

L'intégration Supabase est configurée dans ce projet avec les variables d'environnement suivantes :
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Ces variables sont automatiquement disponibles via `/vercel/share/.env.project`.

### 2. Créer les tables dans Supabase

Accédez à votre [tableau de bord Supabase](https://supabase.com/dashboard) et exécutez le SQL suivant dans l'éditeur SQL :

```sql
-- Create profiles table
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
  FOR DELETE USING (auth.uid() = id);

-- Create trigger function to auto-create profile on signup
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
  EXECUTE FUNCTION public.handle_new_user();
```

### 3. Configurer les paramètres d'authentification

Dans le tableau de bord Supabase, allez à **Authentification > Paramètres** :

1. Activez **Email** comme méthode de connexion
2. Définissez les URL de redirection autorisées :
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/` 
   - Votre domaine de production

## 📁 Structure des fichiers d'authentification

```
app/
  auth/
    callback/route.ts       # Gère les callbacks OAuth/email
    error/page.tsx          # Page d'erreur d'authentification
    login/page.tsx          # Page de connexion
    sign-up/page.tsx        # Page d'inscription
    sign-up-success/page.tsx # Confirmation après inscription
  protected/page.tsx        # Page protégée (exemple)
  profile/page.tsx          # Page de profil utilisateur
  home/page.tsx             # Page d'accueil
  setup-supabase/page.tsx   # Guide de configuration

lib/
  supabase/
    client.ts               # Client Supabase (navigateur)
    server.ts               # Client Supabase (serveur)
    proxy.ts                # Gestion des sessions (middleware)

components/
  logout-button.tsx         # Bouton de déconnexion
  profile-form.tsx          # Formulaire de profil
  navbar.tsx                # Barre de navigation
```

## 🔐 Fonctionnalités d'authentification

### Inscription
- **Route**: `/auth/sign-up`
- Les utilisateurs peuvent s'inscrire avec email + mot de passe
- Confirmation d'email requise avant d'accéder aux données protégées
- Création automatique d'un profil utilisateur via trigger

### Connexion
- **Route**: `/auth/login`
- Authentification par email et mot de passe
- Les sessions sont gérées automatiquement par Supabase

### Déconnexion
- Via le bouton "Se déconnecter" disponible partout
- Supprime la session et redirige vers `/auth/login`

### Pages protégées
- **Route**: `/protected`
- Nécessite une authentification
- Affiche les informations de l'utilisateur actif

### Profil utilisateur
- **Route**: `/profile`
- Permet à l'utilisateur de modifier ses informations
- Utilise RLS pour protéger les données

## 🛡️ Sécurité

### Row Level Security (RLS)
Toutes les tables utilisent RLS pour garantir que :
- Les utilisateurs ne peuvent voir/modifier que leurs propres données
- Les politiques sont vérifiées au niveau de la base de données
- Aucune donnée ne peut être exposée via une requête mal formée

### Sessions
- Les sessions sont gérées avec des JWT signés
- Les tokens sont stockés de manière sécurisée dans les cookies HttpOnly
- Le middleware vérifie automatiquement la validité des sessions

### Redirections de sécurité
- Les utilisateurs non authentifiés sont redirigés vers `/auth/login`
- Les pages protégées vérifient les permissions
- Les redirects utilisent le protocole secure

## 🧪 Test de l'authentification

### Via le navigateur
1. Allez à `http://localhost:3000/home`
2. Cliquez sur "S'inscrire"
3. Entrez votre email et mot de passe
4. Confirmez votre email (vérifiez votre boîte de réception)
5. Vous êtes automatiquement redirigé vers `/protected`

### Tester une page protégée
- Accédez à `http://localhost:3000/protected` sans être connecté
- Vous devez être redirigé vers `/auth/login`

### Tester la déconnexion
- Cliquez sur "Se déconnecter"
- Vous êtes redirigé vers `/auth/login`

## 📖 Utilisation dans votre code

### Obtenir l'utilisateur actif (côté serveur)
```typescript
import { createClient } from '@/lib/supabase/server'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/auth/login')
  }

  return <div>{user.email}</div>
}
```

### Obtenir l'utilisateur actif (côté client)
```typescript
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export default function Component() {
  const supabase = createClient()
  const [user, setUser] = useState(null)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()
  }, [supabase])

  return <div>{user?.email}</div>
}
```

### Requêtes protégées par RLS (côté serveur)
```typescript
import { createClient } from '@/lib/supabase/server'

const supabase = await createClient()
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', user.id)
  .single()

// RLS garantit que seules les données de l'utilisateur sont retournées
```

## 🐛 Dépannage

### Erreur: "Connection terminated due to connection timeout"
- C'est un problème temporaire avec Supabase
- Attendez quelques secondes et réessayez
- Vérifiez que votre projet Supabase n'est pas en mode pause

### Erreur: "User not found"
- Vérifiez que vous êtes inscrit
- Vérifiez que votre email est confirmé
- Réinitialisez votre session

### Les tables ne sont pas créées
- Allez sur https://supabase.com/dashboard
- Sélectionnez votre projet
- Allez dans "SQL Editor"
- Exécutez les scripts SQL fournis

### L'authentification ne fonctionne pas localement
- Vérifiez que les variables d'environnement sont chargées
- Vérifiez `process.env` dans la console
- Redémarrez le serveur de développement

## 📚 Ressources

- [Documentation Supabase](https://supabase.com/docs)
- [Auth.js (Supabase)](https://authjs.dev)
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)

## 🎯 Prochaines étapes

1. ✅ Authentification de base - **Complétée**
2. Créer des tables pour votre application
3. Ajouter des politiques RLS personnalisées
4. Intégrer Supabase à vos composants existants
5. Déployer sur Vercel

Besoin d'aide ? Consultez le guide de configuration dans `/app/setup-supabase/page.tsx`.
