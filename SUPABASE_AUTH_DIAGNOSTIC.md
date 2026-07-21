# Diagnostic d'Authentification Supabase - "Failed to fetch"

## Problème Actuel

Error: **"Failed to fetch"** lors de la tentative de connexion avec m@example.com / 1234

## Configuration Vérifiée ✓

- ✓ Variables d'environnement Supabase chargées
- ✓ URL Redirect configurée: `https://vm-*.vusercontent.net/**`
- ✓ Client Supabase initialisé correctement
- ✓ Logs de debug présents et détaillés

## Causes Possibles

### 1. Utilisateur n'existe pas dans Supabase

**À vérifier:**
- Allez sur https://app.supabase.com/
- Sélectionnez votre projet
- Authentication → Users
- Cherchez l'utilisateur `m@example.com`

**Si l'utilisateur n'existe pas:**
- Cliquez sur "Create new user"
- Email: `m@example.com`
- Password: `1234`
- Assurez-vous qu'il est **confirmé** (Confirm email checkbox)

### 2. Erreur CORS non liée à l'URL redirect

**À vérifier:**
- Ouvrez F12 (Developer Tools)
- Onglet Network
- Tentez une connexion
- Cherchez une requête échouée vers Supabase
- Vérifiez le message d'erreur CORS

**Solution:**
- Authentication → URL Configuration
- Ajouter: `https://vm-*.vusercontent.net/`

### 3. Problème de credentials Supabase

**À vérifier:**
- Vérifiez que `NEXT_PUBLIC_SUPABASE_URL` est correct
- Vérifiez que `NEXT_PUBLIC_SUPABASE_ANON_KEY` est correct (commence par `sb_anon_` ou `sb_publishable_`)

**En cas de doute:**
- Allez à Settings → API
- Copiez à nouveau les valeurs exactes
- Mettez à jour le fichier `.env.development.local`
- Recharge la page

### 4. Problème Supabase côté serveur

**À vérifier dans les logs Supabase:**
- Allez à https://app.supabase.com/
- Logs → Authentication
- Cherchez les erreurs lors de vos tentatives de connexion

## Commandes de Debug pour Console F12

Ouvrez la console F12 et exécutez:

```javascript
// Vérifiez que le client Supabase est créé
console.log(window.location)

// Vérifier les variables d'environnement (client)
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
```

## Étapes de Dépannage

### Étape 1: Vérifier les logs locaux
1. Ouvrez F12 → Console
2. Tentez une connexion
3. Cherchez les logs `[v0]`
4. Relevez le message d'erreur exact

### Étape 2: Vérifier Supabase Dashboard
1. Allez à https://app.supabase.com/
2. Sélectionnez votre projet
3. Vérifiez qu'un utilisateur `m@example.com` existe
4. Vérifiez le statut (confirmé ou pas)

### Étape 3: Vérifier les logs Supabase
1. Dans Supabase Dashboard
2. Allez à Logs → Authentication
3. Cherchez les erreurs lors de vos tentatives
4. Notez le message d'erreur exact

### Étape 4: Tester avec un autre email
- Si `m@example.com` ne fonctionne pas
- Essayez avec un autre email connu

## Solution Rapide - Recréer l'Utilisateur

1. Allez à https://app.supabase.com/
2. Authentication → Users
3. Supprimez `m@example.com` (si existe)
4. Créez un nouvel utilisateur:
   - Email: `m@example.com`
   - Password: `1234`
   - **Important:** Cochez "Confirm email" pour que l'utilisateur soit confirmé immédiatement
5. Recharge la page du preview V0
6. Testez la connexion

## Fichiers Impliqués

- `app/auth/login/page.tsx` - Page de connexion avec logs complets
- `lib/supabase/client.ts` - Client Supabase avec vérification des variables
- `.env.development.local` - Variables d'environnement locales

## Après Résolution

Une fois l'authentification fonctionnelle:
1. Vous serez redirigé à `/protected/planning`
2. Le planning s'affichera avec les données de la semaine courante
3. Vous pourrez ajouter/supprimer des médecins dans les cellules

## Note

Si le problème persiste après toutes ces vérifications, veuillez me fournir:
1. Le message d'erreur exact de la console F12
2. Une copie de la requête échouée dans l'onglet Network
3. Le message d'erreur du Supabase Dashboard (Logs → Authentication)
