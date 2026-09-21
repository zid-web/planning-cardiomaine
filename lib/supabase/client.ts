import { createBrowserClient } from '@supabase/ssr'

/**
 * Client Supabase côté navigateur.
 *
 * Les deux constantes ci-dessous ne sont **pas** un vestige : c'est la
 * configuration sur laquelle la production tourne réellement. Vérifié dans
 * l'onglet Réseau du navigateur sur planning-cardiomaine.vercel.app — la
 * connexion Realtime part vers cet hôte, avec cette clé.
 *
 * La raison est que `NEXT_PUBLIC_*` est figée dans le bundle **à la
 * compilation**, et que les variables Vercel correspondantes n'atteignent pas
 * le build : le repli est donc ce qui s'y retrouve inliné. Les avoir retirées,
 * en les croyant mortes, aurait fait tomber la connexion pour tout le service
 * au premier déploiement.
 *
 * Ces valeurs sont publiques par conception — la clé anon est servie à chaque
 * navigateur et ce sont les règles RLS qui protègent les données. Les inscrire
 * ici n'expose rien que le bundle ne contienne déjà.
 *
 * Avant de les changer ou de les supprimer : ouvrir l'onglet Réseau sur la
 * production, tenter une connexion, et lire l'hôte et la clé réellement
 * envoyés. C'est la seule source de vérité — ni le tableau de bord Supabase,
 * ni les variables d'environnement Vercel ne l'ont donnée correctement.
 */
const FALLBACK_URL = 'https://rmrxsaiianffhpxpntws.supabase.co'
const FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtcnhzYWlpYW5mZmhweHBudHdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMzI3MTUsImV4cCI6MjA5OTgwODcxNX0.WlUydbEb3oZ2ZnyStE7du6wZhtuzKxGzgFyJPZOQdbo'

export function createClient() {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Le repli reste silencieux en usage normal, mais on trace quelle source a
  // servi : quand une connexion échoue, savoir si le bundle porte la valeur
  // d'environnement ou le repli fait gagner des heures de diagnostic.
  if (!envUrl || !envKey) {
    const missing = [
      !envUrl && 'NEXT_PUBLIC_SUPABASE_URL',
      !envKey && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ]
      .filter(Boolean)
      .join(' et ')

    console.warn(
      `[supabase/client] ${missing} absente(s) du bundle : repli sur la ` +
        'configuration intégrée. Ce repli est attendu en production ; il ne ' +
        'signale un problème que si la connexion échoue ensuite.',
    )
  }

  return createBrowserClient(envUrl || FALLBACK_URL, envKey || FALLBACK_ANON_KEY)
}
