import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Proxy (anciennement middleware) pour la protection des routes
 * Voir : https://nextjs.org/docs/messages/middleware-to-proxy
 */
export function proxy(request: NextRequest) {
  // Exemple : rediriger vers /auth/login si non authentifié
  // Adaptez selon votre logique d'authentification

  const { pathname } = request.nextUrl;

  // Exclure les routes publiques
  const publicRoutes = ['/', '/auth/login', '/auth/sign-up', '/auth/forgot-password'];
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  // Vérifier la session (via cookie ou header)
  const session = request.cookies.get('sb-access-token') || request.cookies.get('supabase-auth-token');
  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    return NextResponse.redirect(url);
  }

  // Si tout est ok, continuer
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match tous les chemins sauf :
     * - les dossiers statiques (_next, public, favicon, etc.)
     * - les pages publiques d'auth
     */
    '/((?!_next/static|_next/image|favicon.ico|auth/login|auth/sign-up|auth/forgot-password|icon-|manifest.json).*)',
  ],
};
