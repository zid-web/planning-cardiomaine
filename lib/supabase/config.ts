/**
 * Configuration Supabase unique de l'application (navigateur, serveur, proxy).
 *
 * Le projet de production est fixé **dans le code** : les variables Vercel
 * `NEXT_PUBLIC_SUPABASE_*` ne sont plus prises en compte, sauf pour un
 * Supabase **local** (`supabase start`, adresse localhost / 127.0.0.1) utilisé
 * pour les tests de bout en bout (voir AGENTS.md).
 *
 * Pourquoi : l'intégration Supabase de Vercel (ajoutée le 17/07) crée son propre
 * projet et injecte `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
 * qui pointent vers un autre projet que celui des plannings. Dès que ces
 * variables atteignent le build, la connexion échoue (« Impossible de joindre le
 * serveur d'authentification »). Garder la configuration ici évite qu'un réglage
 * de tableau de bord remplace silencieusement la base de production.
 *
 * L'adresse et la clé « anon » sont publiques par conception : le navigateur les
 * reçoit à chaque chargement, ce sont les règles RLS qui protègent les données.
 * Pour changer de projet : modifier les deux constantes ci-dessous.
 */
export const SUPABASE_PROJECT_URL = 'https://rmrxsaiianffhpxpntws.supabase.co'
export const SUPABASE_PROJECT_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtcnhzYWlpYW5mZmhweHBudHdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMzI3MTUsImV4cCI6MjA5OTgwODcxNX0.WlUydbEb3oZ2ZnyStE7du6wZhtuzKxGzgFyJPZOQdbo'

export type SupabaseConfigSource = 'project' | 'local-env'

export type SupabaseConfig = {
  url: string
  anonKey: string
  source: SupabaseConfigSource
  /** Adresse issue de l'environnement, ignorée parce qu'elle ne vise pas un Supabase local. */
  ignoredEnvUrl?: string
}

const LOCAL_URL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i

export function resolveSupabaseConfig(
  envUrl: string | undefined,
  envKey: string | undefined,
): SupabaseConfig {
  if (envUrl && envKey && LOCAL_URL.test(envUrl)) {
    return { url: envUrl, anonKey: envKey, source: 'local-env' }
  }
  return {
    url: SUPABASE_PROJECT_URL,
    anonKey: SUPABASE_PROJECT_ANON_KEY,
    source: 'project',
    ignoredEnvUrl: envUrl && envUrl !== SUPABASE_PROJECT_URL ? envUrl : undefined,
  }
}

let warned = false

/** Configuration courante (lit l'environnement à chaque appel : testable). */
export function getSupabaseConfig(): SupabaseConfig {
  const config = resolveSupabaseConfig(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
  if (config.ignoredEnvUrl && !warned) {
    warned = true
    let host = config.ignoredEnvUrl
    try {
      host = new URL(config.ignoredEnvUrl).host
    } catch {
      // adresse invalide : affichée telle quelle
    }
    console.warn(
      `[supabase/config] NEXT_PUBLIC_SUPABASE_URL (${host}) ignorée : l'application utilise le projet ` +
        `de production défini dans lib/supabase/config.ts.`,
    )
  }
  return config
}

/** Hôte réellement utilisé (pour les messages d'erreur de connexion). */
export function configuredSupabaseHost(): string {
  try {
    return new URL(getSupabaseConfig().url).host
  } catch {
    return getSupabaseConfig().url
  }
}
