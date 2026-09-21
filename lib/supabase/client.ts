import { createBrowserClient } from '@supabase/ssr'

/**
 * Client Supabase côté navigateur.
 *
 * Il n'y a **volontairement plus de valeurs de repli** codées en dur ici.
 *
 * Le fichier en contenait, présentées comme un secours pour la prévisualisation
 * v0. Le projet Supabase a depuis régénéré ses clés, ce qui invalide toutes les
 * précédentes même non expirées — la clé de repli était donc morte, tout en
 * restant syntaxiquement valable et non expirée (`exp` en 2099). Résultat : tout
 * environnement où `NEXT_PUBLIC_SUPABASE_ANON_KEY` n'est pas défini
 * s'authentifiait contre une clé refusée par Supabase, et **chaque** tentative
 * de connexion échouait — y compris avec le bon mot de passe.
 *
 * L'écran de connexion traduisant ces échecs en « Email ou mot de passe
 * incorrect », la panne était indiagnosticable : l'utilisateur s'acharnait sur
 * un mot de passe correct, l'administrateur réinitialisait sans effet, et rien
 * n'indiquait que la configuration était en cause.
 *
 * Mieux vaut donc échouer bruyamment, avec un message qui nomme la cause, que
 * de retomber en silence sur une valeur qui peut pourrir sans prévenir.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    const missing = [
      !url && 'NEXT_PUBLIC_SUPABASE_URL',
      !key && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ]
      .filter(Boolean)
      .join(' et ')

    console.error(
      `[supabase/client] Configuration absente : ${missing}. ` +
        "Aucune connexion n'est possible depuis cet environnement tant que " +
        'ces variables ne sont pas définies (Vercel → Settings → Environment Variables).',
    )
    throw new Error(
      `Configuration Supabase absente (${missing}). ` +
        "Ce n'est pas un problème de mot de passe : contactez l'administrateur.",
    )
  }

  return createBrowserClient(url, key)
}
