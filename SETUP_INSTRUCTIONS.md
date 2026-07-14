# 🚀 Instructions de Configuration - Cardiomaine Planning + Supabase

## ✅ Ce qui a été fait

Votre application **Cardiomaine Planning** est maintenant intégrée avec **Supabase** pour l'authentification complète !

### 1. **Authentification Supabase configurée**
- ✅ Clients Supabase (browser & server)
- ✅ Middleware pour les sessions
- ✅ Pages d'authentification (Sign-up, Login, Callback)
- ✅ Gestion des erreurs d'authentification

### 2. **Pages créées**
- 🏠 **Page d'accueil** : `/home`
- 📝 **S'inscrire** : `/auth/sign-up`
- 🔑 **Se connecter** : `/auth/login`
- 🔒 **Page protégée** : `/protected` (nécessite authentification)
- 👤 **Profil utilisateur** : `/profile`
- 📋 **Résumé config** : `/supabase-summary`
- ℹ️ **Guide détaillé** : `/setup-supabase`

### 3. **Composants créés**
- Bouton de déconnexion
- Formulaire de profil
- Barre de navigation dynamique

---

## 🔧 Étape 1 : Créer les tables dans Supabase

**Durée : 2-3 minutes**

1. Allez sur [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Sélectionnez votre projet Cardiomaine Planning
3. Cliquez sur **"SQL Editor"** dans le menu de gauche
4. Créez une nouvelle requête
5. Copiez-collez le SQL suivant :

```sql
-- Créer la table profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, now()) NOT NULL
);

-- Activer Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Créer les politiques RLS
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete their own profile" ON public.profiles
  FOR DELETE USING (auth.uid() = id);

-- Créer la fonction trigger
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

-- Créer le trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

6. Cliquez sur **"Run"** ou appuyez sur **Ctrl+Enter**
7. ✅ Les tables sont créées !

---

## 🧪 Étape 2 : Tester l'application

**Durée : 5 minutes**

### Test d'inscription :
1. Allez à http://localhost:3000/auth/sign-up
2. Entrez une adresse email (ex: `test@example.com`)
3. Entrez un mot de passe
4. Cliquez sur "Sign up"
5. ✅ Vous verrez un message de confirmation

### Test de connexion :
1. Allez à http://localhost:3000/auth/login
2. Entrez l'email et le mot de passe
3. Cliquez sur "Login"
4. ✅ Vous êtes redirigé vers `/protected`

### Voir votre profil :
1. Cliquez sur "Mon Profil" en haut à droite
2. ✅ Vous pouvez voir vos informations de profil

### Se déconnecter :
1. Cliquez sur "Se déconnecter" en haut à droite
2. ✅ Vous êtes redirigé vers la page de connexion

---

## 📋 Architecture de l'authentification

```
app/
├── auth/
│   ├── login/page.tsx          ← Page de connexion
│   ├── sign-up/page.tsx        ← Page d'inscription
│   ├── callback/route.ts       ← Gère les callbacks Supabase
│   ├── error/page.tsx          ← Erreurs d'authentification
│   └── sign-up-success/page.tsx ← Confirmation inscription
├── protected/page.tsx           ← Page protégée (authentification requise)
├── profile/page.tsx            ← Profil utilisateur (authentification requise)
├── home/page.tsx               ← Page d'accueil publique
└── supabase-summary/page.tsx   ← Résumé de configuration

lib/supabase/
├── client.ts                   ← Client côté navigateur
├── server.ts                   ← Client côté serveur
└── proxy.ts                    ← Gestion des sessions

components/
├── logout-button.tsx           ← Bouton de déconnexion
├── profile-form.tsx            ← Formulaire de profil
└── navbar.tsx                  ← Navigation avec authentification

middleware.ts                   ← Middleware de session
```

---

## 🔐 Sécurité - Comment cela fonctionne

### Row Level Security (RLS)
- Les utilisateurs ne voient que **leurs propres données**
- Les politiques sont vérifiées au niveau de la **base de données**
- Impossible d'accéder aux données d'autres utilisateurs

### Sessions sécurisées
- Les tokens JWT sont **signés par Supabase**
- Stockés dans les **cookies HttpOnly** (sécurisés)
- Vérifié automatiquement à chaque requête

### Redirects de sécurité
- Les pages protégées redirigent vers `/auth/login` si non authentifié
- Les URLs sont vérifiées côté serveur

---

## 📱 Routes disponibles

| Route | Type | Description |
|-------|------|-------------|
| `/home` | Public | Page d'accueil |
| `/auth/sign-up` | Public | Inscription |
| `/auth/login` | Public | Connexion |
| `/auth/callback` | Public | Callback Supabase (automatique) |
| `/protected` | Protégée | Tableau de bord utilisateur |
| `/profile` | Protégée | Profil utilisateur |
| `/supabase-summary` | Public | Résumé de configuration |
| `/setup-supabase` | Public | Guide détaillé |

---

## 🛠️ Troubleshooting

### Problème : "Email confirmation required"
**Solution** : Vérifiez votre email et cliquez sur le lien de confirmation

### Problème : "User not found" en connexion
**Solution** : Vérifiez que vous avez confirmé votre email après inscription

### Problème : Les tables ne s'affichent pas dans Supabase
**Solution** : Allez dans l'onglet "SQL Editor" → "Saved Queries" et vérifiez les erreurs d'exécution

### Problème : La page protégée fait une boucle infinie
**Solution** : Vérifiez votre token JWT dans les cookies (F12 → Application → Cookies)

---

## 📚 Documentation complète

Consultez **`SUPABASE_SETUP.md`** pour :
- Les exemples d'utilisation détaillés
- Comment faire des requêtes sécurisées
- Comment ajouter d'autres tables
- Les bonnes pratiques

---

## 🎯 Prochaines étapes (optionnelles)

1. **Ajouter OAuth** (Google, GitHub, etc.)
   - Supabase supporte OAuth nativement
   - Consultez les docs Supabase

2. **Intégrer à votre planning existant**
   - Utilisez les clients Supabase créés
   - Protégez vos données avec RLS

3. **Ajouter d'autres tables**
   - Créer une table pour les plannings
   - Créer une table pour les médecins
   - Protéger avec des politiques RLS

4. **Déployer sur Vercel**
   - Les variables d'environnement sont prêtes
   - Cliquez sur "Publish" dans v0

---

## ✨ Vous avez tout ce qu'il faut !

L'authentification **Supabase** est maintenant complètement configurée sur **Cardiomaine Planning**.

**Prochaine étape** : Exécutez le SQL dans votre tableau de bord Supabase (voir Étape 1 ci-dessus) et testez l'application !

Besoin d'aide ? Consultez :
- 📖 [Documentation Supabase](https://supabase.com/docs)
- 📖 [Documentation Next.js 16](https://nextjs.org/docs)
- 📖 [Fichier SUPABASE_SETUP.md](./SUPABASE_SETUP.md)
