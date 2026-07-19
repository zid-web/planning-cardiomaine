import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow Service Worker, API routes, static assets, and next assets
  if (
    pathname === '/sw.js' ||
    pathname === '/api/sw' ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/icon-') ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico)$/)
  ) {
    return NextResponse.next()
  }

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Check if Supabase environment variables are configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // If Supabase is not configured, allow request to proceed
    return response
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Allow public routes
  const publicRoutes = ['/auth/login', '/auth/sign-up', '/auth/forgot-password', '/']
  if (publicRoutes.includes(pathname)) {
    return response
  }

  // If no user, redirect to login
  if (!user) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Check if user needs to change password
  const { data: profile } = await supabase
    .from('profiles')
    .select('must_change_password')
    .eq('id', user.id)
    .single()

  // Allow access to setup-account page
  if (pathname === '/auth/setup-account') {
    return response
  }

  // If must_change_password is true, redirect to setup page
  if (profile?.must_change_password) {
    return NextResponse.redirect(new URL('/auth/setup-account', request.url))
  }

  // Allow all other authenticated requests
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
