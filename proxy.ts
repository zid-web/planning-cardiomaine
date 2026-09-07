import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

/**
 * Proxy (Next.js 16 — remplace middleware.ts).
 * Une seule définition de `proxy` + `config` (évite les doublons de build).
 * Auth via Supabase SSR `getUser()` — ne pas revenir à un check cookie
 * `sb-access-token` (cassé avec les cookies chunkés modernes).
 * @see https://nextjs.org/docs/messages/middleware-to-proxy
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const publicRoutes = [
    "/",
    "/auth/login",
    "/auth/sign-up",
    "/auth/forgot-password",
    "/auth/callback",
    "/auth/error",
    "/auth/sign-up-success",
    "/auth/reset-password-confirm",
    "/api/ping-solver", // keep-alive cron (cron-job.org / Vercel Cron) — no login
    "/api/version", // version du déploiement (AppUpdateWatcher) — monté aussi sur la page de connexion
    "/api/test-s44",
  ]

  // Public routes: skip auth entirely (needed for external keep-alive cron)
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next({
      request: { headers: request.headers },
    })
  }

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // Misconfigured env: do not hard-block the whole app
    return response
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  /**
   * Une redirection est une réponse **neuve** : elle ne porte aucun des
   * cookies que `getUser()` vient éventuellement de rafraîchir. Les renvoyer
   * sans les recopier fait diverger le navigateur et le serveur, et coupe la
   * session prématurément — c'est l'écueil que documente le commentaire de
   * `lib/supabase/proxy.ts`. On recopie donc systématiquement.
   */
  const redirectTo = (path: string) => {
    const redirect = NextResponse.redirect(new URL(path, request.url))
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
    return redirect
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return redirectTo("/auth/login")
  }

  if (pathname === "/auth/setup-account") {
    return response
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("must_change_password")
    .eq("id", user.id)
    .single()

  if (profile?.must_change_password) {
    return redirectTo("/auth/setup-account")
  }

  return response
}

export const config = {
  // `_vercel` exclu (confirmé 25/08/2026) : sans cela, les scripts de
  // `<Analytics />` et `<SpeedInsights />` (/_vercel/insights/script.js,
  // /_vercel/speed-insights/script.js) partaient en redirection vers
  // /auth/login. Le navigateur recevait du HTML à la place du JS et rejetait
  // les deux fichiers ("Unexpected token '<'"), donc aucune métrique n'était
  // collectée — y compris le `?source=pwa` du manifest. Ces chemins sont
  // servis par la plateforme Vercel et n'exposent aucune donnée applicative :
  // les soustraire au contrôle d'authentification est sans effet de bord.
  matcher: [
    "/((?!_next/static|_next/image|_vercel|favicon.ico|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
