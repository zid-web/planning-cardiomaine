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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL("/auth/login", request.url))
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
    return NextResponse.redirect(new URL("/auth/setup-account", request.url))
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
