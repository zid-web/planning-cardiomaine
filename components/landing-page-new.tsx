'use client'

import { Button } from '@/components/ui/button'
import { ArrowRight, Download, Smartphone, Clock, Users, Shield } from 'lucide-react'
import Link from 'next/link'

export function LandingPageNew() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-slate-50">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold text-primary">CardioPlanning</div>
          <div className="hidden md:flex gap-8 items-center">
            <Link href="#features" className="text-foreground hover:text-primary transition">
              Fonctionnalités
            </Link>
            <Link href="#download" className="text-foreground hover:text-primary transition">
              Télécharger
            </Link>
            <Link href="/auth/login">
              <Button variant="outline">Connexion</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground leading-tight text-balance">
              Planification intelligente pour vos équipes médicales
            </h1>
            <p className="text-lg sm:text-xl text-slate-600 text-balance">
              Optimisez la gestion des plannings hospitaliers avec intelligence artificielle. Réduisez les conflits, équilibrez les charges de travail et augmentez la satisfaction des médecins.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link href="/auth/login">
                <Button size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90">
                  Commencer gratuitement
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="#download">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  En savoir plus
                </Button>
              </Link>
            </div>
          </div>

          {/* Hero Image */}
          <div className="hidden md:flex justify-center">
            <div className="relative w-full max-w-sm">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-blue-400/20 rounded-3xl blur-2xl" />
              <div className="relative bg-white rounded-3xl shadow-2xl p-6 border border-slate-200">
                <div className="bg-gradient-to-b from-primary/10 to-transparent rounded-2xl p-8 h-96 flex items-center justify-center">
                  <Smartphone className="w-32 h-32 text-primary/30" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Fonctionnalités puissantes
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Tous les outils dont vous avez besoin pour gérer efficacement vos plannings
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 hover:shadow-lg hover:border-primary/30 transition">
            <Clock className="w-12 h-12 text-primary mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">Solveur IA rapide</h3>
            <p className="text-slate-600">
              Générez des plannings optimisés en secondes avec notre moteur de résolution par intelligence artificielle.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 hover:shadow-lg hover:border-primary/30 transition">
            <Users className="w-12 h-12 text-primary mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">Gestion équitable</h3>
            <p className="text-slate-600">
              Distribuez équitablement les gardes, astreintes et formations pour tous les médecins.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 hover:shadow-lg hover:border-primary/30 transition">
            <Shield className="w-12 h-12 text-primary mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">Sécurité garantie</h3>
            <p className="text-slate-600">
              Tous vos données sont chiffrées et hébergées de manière sécurisée avec les normes hospitalières.
            </p>
          </div>
        </div>
      </section>

      {/* Download Section */}
      <section id="download" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="bg-gradient-to-r from-primary/5 to-blue-400/5 rounded-3xl border border-primary/20 p-12 sm:p-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Téléchargez l&apos;application mobile
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Accédez à vos plannings depuis n&apos;importe où, n&apos;importe quand. Disponible sur iOS et Android.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-6 justify-center max-w-lg mx-auto">
            {/* iOS Button */}
            <a
              href="https://apps.apple.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1"
            >
              <Button size="lg" variant="outline" className="w-full border-2 border-primary/30 hover:border-primary/60 h-14">
                <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.05 13.5c-.91 0-1.82.55-2.25 1.51.93.64 1.54 1.71 1.54 2.88 0 1.17-.61 2.24-1.54 2.88.43.96 1.34 1.51 2.25 1.51 2.18 0 3.95-1.79 3.95-4 0-2.2-1.77-3.98-3.95-3.98zM6.08 9.02C6.3 7.85 7.3 7 8.5 7c1.41 0 2.57 1.16 2.57 2.58s-1.16 2.57-2.58 2.57c-1.2 0-2.2-.85-2.41-2.13m14.42.71c1.65 0 3 1.35 3 3s-1.35 3-3 3-3-1.35-3-3 1.35-3 3-3zM6.5 11.9c2.8 0 5.1 2.3 5.1 5.1s-2.3 5.1-5.1 5.1-5.1-2.3-5.1-5.1 2.3-5.1 5.1-5.1z" />
                </svg>
                iPhone
              </Button>
            </a>

            {/* Android Button */}
            <a
              href="https://play.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1"
            >
              <Button size="lg" variant="outline" className="w-full border-2 border-primary/30 hover:border-primary/60 h-14">
                <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6.5 6.5h11v11h-11z" fillOpacity="0" />
                  <path d="M17.5 6.5L8.5 1l-9 5.5v11l9 5.5 9-5.5v-11zm-5 13.5L4 14v-4l8.5-4.5v13.5z" />
                </svg>
                Android
              </Button>
            </a>
          </div>

          <p className="text-center text-sm text-slate-500 mt-8">
            Ou continuez sur le web en vous connectant à votre compte
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="bg-gradient-to-r from-primary to-blue-600 rounded-3xl p-12 sm:p-16 text-center text-white">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Prêt à transformer votre gestion des plannings ?
          </h2>
          <p className="text-lg opacity-90 max-w-2xl mx-auto mb-8">
            Rejoignez des dizaines d&apos;établissements hospitaliers qui font confiance à CardioPlanning.
          </p>
          <Link href="/auth/login">
            <Button size="lg" variant="secondary" className="bg-white hover:bg-slate-100 text-primary">
              Démarrer maintenant
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-bold text-foreground mb-4">CardioPlanning</h3>
              <p className="text-sm text-slate-600">
                Optimisez vos plannings médicaux avec l&apos;intelligence artificielle.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Produit</h4>
              <ul className="space-y-2 text-sm text-slate-600">
                <li><Link href="#features" className="hover:text-primary">Fonctionnalités</Link></li>
                <li><Link href="#download" className="hover:text-primary">Télécharger</Link></li>
                <li><Link href="/auth/login" className="hover:text-primary">Connexion</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Entreprise</h4>
              <ul className="space-y-2 text-sm text-slate-600">
                <li><a href="#" className="hover:text-primary">À propos</a></li>
                <li><a href="#" className="hover:text-primary">Blog</a></li>
                <li><a href="#" className="hover:text-primary">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Légal</h4>
              <ul className="space-y-2 text-sm text-slate-600">
                <li><a href="#" className="hover:text-primary">Confidentialité</a></li>
                <li><a href="#" className="hover:text-primary">Conditions</a></li>
                <li><a href="#" className="hover:text-primary">RGPD</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-200 pt-8 flex flex-col sm:flex-row justify-between items-center">
            <p className="text-sm text-slate-600">© 2024 CardioPlanning. Tous droits réservés.</p>
            <div className="flex gap-6 mt-4 sm:mt-0">
              <a href="#" className="text-slate-600 hover:text-primary">Twitter</a>
              <a href="#" className="text-slate-600 hover:text-primary">LinkedIn</a>
              <a href="#" className="text-slate-600 hover:text-primary">GitHub</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
