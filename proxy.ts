import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

/**
 * Proxy (Next.js 16 — remplace middleware.ts).
 * Auth Supabase SSR + garde must_change_password.
 * @see https://nextjs.org/docs/messages/middleware-to-proxy
 */
export async function proxy(request: NextRequest) {
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

  const { pathname } = request.nextUrl

  const publicRoutes = ["/", "/auth/login", "/auth/sign-up", "/auth/forgot-password"]
  // Vercel Cron keep-alive (optionally protected by CRON_SECRET in the route)
  if (publicRoutes.includes(pathname) || pathname === "/api/ping-solver") {
    return response
  }

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
