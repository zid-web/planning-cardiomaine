# Configuration de l'Authentification Supabase

## Problème identifié

L'authentification ne fonctionne pas car les variables d'environnement Supabase ne sont pas configurées dans V0.

Logs d'erreur visibles:
```
[v0] NEXT_PUBLIC_SUPABASE_URL env var: false
[v0] NEXT_PUBLIC_SUPABASE_ANON_KEY env var: false
[v0] Missing Supabase environment variables
```

---

## Solution : Configurer les variables d'environnement

### Étape 1 : Obtenir vos clés Supabase

1. Allez à [https://app.supabase.com](https://app.supabase.com)
2. Ouvrez votre projet
3. Cliquez sur **Settings** (⚙️) → **API**
4. Vous verrez :
   - **Project URL** → Copier cette valeur
   - **anon public key** → Copier cette valeur

### Étape 2 : Ajouter les variables dans V0

1. Cliquez sur le bouton **Settings** (⚙️) en haut à droite de l'écran V0
2. Allez à **Vars**
3. Ajoutez deux variables d'environnement :

| Variable | Valeur |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Votre URL Supabase (ex: `https://xxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Votre clé anon (longue chaîne) |

### Étape 3 : Redémarrer la page

Une fois les variables ajoutées:
1. Cliquez sur **Version Box** pour relancer la preview
2. Les variables seront automatiquement rechargées

---

## Vérification que ça fonctionne

Après ajout des variables, ouvrez **F12 Console** et cherchez:

```
✅ [v0] NEXT_PUBLIC_SUPABASE_URL env var: true
✅ [v0] NEXT_PUBLIC_SUPABASE_ANON_KEY env var: true
✅ [v0] Supabase client created successfully
```

Si vous voyez ces logs → L'authentification est prête!

---

## Flux d'authentification attendu

1. **Page d'accueil** → Cliquez "Connexion"
2. **Page de login** → Entrez email/password
3. **Logs de confirmation** :
   - `[v0] ===== LOGIN ATTEMPT START =====`
   - `[v0] Supabase client created successfully`
   - `[v0] ===== LOGIN SUCCESSFUL =====`
   - `[v0] Redirecting to /protected/planning...`
4. **Redirection** → Vous êtes redirigé vers `/protected/planning`
5. **Planning page** → Le design médical s'affiche

---

## Détails techniques

### Fichiers clés

- **`lib/supabase/client.ts`** - Création du client Supabase
  - Charge les variables d'environnement
  - Crée un client SSR (Server-Side Rendering)
  - Lance une erreur si les variables manquent

- **`app/auth/login/page.tsx`** - Page de login
  - Valide email/password
  - Crée le client Supabase
  - Appelle `supabase.auth.signInWithPassword()`
  - Redirige vers `/protected/planning` en cas de succès

- **`middleware.ts`** - Middleware de protection
  - Protège les routes `/protected/*`
  - Vérifie que l'utilisateur est authentifié
  - Redirige vers `/auth/login` si non authentifié

### Environnement de production (Vercel)

Pour Vercel (production), ajoute les mêmes variables dans:
- **Vercel Dashboard** → Project Settings → Environment Variables
- Les valeurs NEXT_PUBLIC sont publiques (sans secrets)

---

## Troubleshooting

### Erreur: "Authentication service is not properly configured"

**Solution:** Vérifiez que les deux variables sont présentes et correctes dans V0 Settings → Vars

### Erreur: "Invalid credentials"

**Solution:** Vérifiez que l'email/password existent dans votre projet Supabase
- Allez à Supabase Dashboard → Authentication → Users
- Vérifiez que l'utilisateur est créé

### La page ne charge pas après login

**Solution:** Vérifiez les logs de redirection:
- F12 Console → Cherchez `[v0] Redirecting to /protected/planning...`
- Si absent → L'authentification a échoué silencieusement

---

## Besoin d'aide?

Si ça ne fonctionne pas après avoir suivi ces étapes:
1. Copiez les logs de F12 Console
2. Vérifiez que votre projet Supabase existe et est actif
3. Contactez le support V0 via le bouton d'aide
