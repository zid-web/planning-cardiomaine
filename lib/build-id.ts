/**
 * Identifiant de version du déploiement courant.
 *
 * Sert à détecter qu'un onglet resté ouvert tourne sur une version périmée
 * du code (voir `components/app-update-watcher.tsx`). Le service worker ne
 * peut pas jouer ce rôle : `sw.js` est un fichier statique, un déploiement
 * qui ne le modifie pas ne déclenche aucune mise à jour côté navigateur.
 *
 * NE PAS importer depuis un composant client : ces variables ne sont pas
 * préfixées NEXT_PUBLIC_ et ne sont donc pas inlinées côté navigateur. Le
 * layout racine (composant serveur) la passe en prop.
 */
export const BUILD_ID =
  process.env.VERCEL_DEPLOYMENT_ID ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.NEXT_PUBLIC_BUILD_ID ||
  "dev"
