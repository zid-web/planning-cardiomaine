'use client'

import { Button } from '@/components/ui/button'
import Link from 'next/link'

export function LandingPageNew() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex flex-col items-center justify-center px-4">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg" />
            <span className="text-lg font-semibold text-slate-900">CardioPlanning</span>
          </div>
          <Link href="/auth/login">
            <Button variant="outline" size="sm">
              Connexion
            </Button>
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex flex-col items-center justify-center flex-1 w-full max-w-4xl text-center mt-20">
        {/* Title */}
        <h1 className="text-6xl md:text-8xl font-bold text-slate-900 mb-8 leading-tight">
          Planning Médical
        </h1>

        {/* Subtitle */}
        <p className="text-lg md:text-xl text-slate-600 mb-12 max-w-2xl mx-auto">
          Optimisez la gestion de vos plannings hospitaliers avec intelligence artificielle
        </p>

        {/* Download Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto justify-center mb-12">
          {/* iOS */}
          <a
            href="https://apps.apple.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="lg" className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 h-12 px-8">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.05 13.5c-.91 0-1.82.55-2.25 1.51.93.64 1.54 1.71 1.54 2.88 0 1.17-.61 2.24-1.54 2.88.43.96 1.34 1.51 2.25 1.51 2.18 0 3.95-1.79 3.95-4 0-2.2-1.77-3.98-3.95-3.98zM6.08 9.02C6.3 7.85 7.3 7 8.5 7c1.41 0 2.57 1.16 2.57 2.58s-1.16 2.57-2.58 2.57c-1.2 0-2.2-.85-2.41-2.13m14.42.71c1.65 0 3 1.35 3 3s-1.35 3-3 3-3-1.35-3-3 1.35-3 3-3zM6.5 11.9c2.8 0 5.1 2.3 5.1 5.1s-2.3 5.1-5.1 5.1-5.1-2.3-5.1-5.1 2.3-5.1 5.1-5.1z" />
              </svg>
              iOS
            </Button>
          </a>

          {/* Android */}
          <a
            href="https://play.google.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="lg" variant="outline" className="w-full sm:w-auto border-2 border-slate-900 text-slate-900 hover:bg-slate-50 h-12 px-8">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5S11.5 23.33 11.5 22.5V19h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zm3.5-9c.83 0 1.5-.67 1.5-1.5S10.33 6 9.5 6 8 6.67 8 7.5 8.67 9 9.5 9zm5 0c.83 0 1.5-.67 1.5-1.5S15.33 6 14.5 6 13 6.67 13 7.5 13.67 9 14.5 9zM15.5 13H8.5v2h7v-2z" />
              </svg>
              Android
            </Button>
          </a>
        </div>

        {/* Web App Link */}
        <Link href="/schedule">
          <Button variant="ghost" size="lg" className="text-slate-600 hover:text-slate-900">
            Ou accédez à la version web
          </Button>
        </Link>
      </div>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200 bg-white/50 backdrop-blur mt-16 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-slate-600">
            © 2024 CardioPlanning. Tous droits réservés.
          </p>
        </div>
      </footer>
    </div>
  )
}
