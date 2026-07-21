# Configuration de l'Authentification Supabase dans V0 Preview

## État: Configuration Initiale Complétée

### Actions Effectuées

1. **Variables d'environnement ajoutées**
   - `NEXT_PUBLIC_SUPABASE_URL` ✓
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` ✓
   
   Ces variables sont maintenant disponibles dans l'environnement de développement V0.

2. **Logs de debug ajoutés**
   - `lib/supabase/client.ts` : Logs détaillés pour vérifier le chargement des variables
   - `app/auth/login/page.tsx` : Logs complets du flux d'authentification

3. **Architecture Supabase vérifie**
   - Client SSR/Browser via `createBrowserClient` ✓
   - Gestion d'erreur gracieuse si les variables manquent ✓
   - Page de login avec validation complète ✓

### Configuration Requise dans Supabase Dashboard

Pour que l'authentification fonctionne complètement en V0 preview, vous devez :

1. **Aller sur Supabase Dashboard**
   - URL: https://app.supabase.com/
   - Sélectionnez votre projet

2. **Authentication → URL Configuration**
   - Site URL: Ajoutez l'URL du preview V0 (ex: `https://vm-*.vusercontent.net`)
   - Redirect URLs: Ajoutez `https://vm-*.vusercontent.net/**`

3. **Optionnel: Ajouter un utilisateur de test**
   - Authentication → Users
   - Créez un utilisateur avec email `test@example.com` et mot de passe `1234`

### Flux d'Authentification

1. Utilisateur visite `/auth/login`
2. Entre email et mot de passe
3. Appel API Supabase via `signInWithPassword()`
4. Redirection vers `/protected/planning` si succès
5. Les cookies de session sont stockés automatiquement

### Dépannage

#### Les variables d'environnement ne se chargent pas
- Solution: Relancer le preview V0 (rafraîchir la page dans le navigateur)
- Vérifier dans les Settings → Environment Variables que les deux variables sont présentes

#### Le login échoue avec "Invalid credentials"
- Vérifier que l'utilisateur existe dans Supabase (`test@example.com`)
- Vérifier le mot de passe
- Vérifier dans les logs Supabase

#### Le login échoue avec erreur CORS
- Vous devez ajouter l'URL du preview dans Supabase URL Configuration
- Relancer la page après la modification

### Logs de Debug

Pour vérifier l'authentification en local, ouvrez la console (F12) et cherchez:
- `[v0] Supabase Client Initialization` : Vérifie que le client est créé
- `[v0] ===== LOGIN ATTEMPT START =====` : Début de la connexion
- `[v0] Auth response received` : Réponse d'authentification

### Prochaines Étapes

1. Configurez les URLs dans Supabase Dashboard
2. Créez un utilisateur de test
3. Rafraîchissez le preview V0
4. Testez la connexion avec `test@example.com` / `1234`
5. Une fois connecté, vous pouvez tester le planning à `/protected/planning`

### Fichiers Modifiés

- `lib/supabase/client.ts` : Ajout de logs de debug
- `app/auth/login/page.tsx` : Logs complètes du processus d'authentification
- Environment Variables : Variables Supabase ajoutées

### Notes

- L'authentification SSR utilise le pattern Supabase SSR pour gérer les cookies
- Les variables publiques (`NEXT_PUBLIC_*`) sont exposées au client (c'est intentionnel et sécurisé)
- La clé ANON_KEY permet uniquement les opérations autorisées par les policies RLS

