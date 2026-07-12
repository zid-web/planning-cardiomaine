"use client"

import { useState, useEffect } from "react"
import {
  Activity,
  ArrowRight,
  Download,
  HeartPulse,
  LogOut,
  MoreVertical,
  Phone,
  Share,
  ShieldCheck,
  Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LearnMoreModal } from "@/components/learn-more-modal"

export function LandingPage({ onLoginClick }: { onLoginClick: () => void }) {
  const [showInstallModal, setShowInstallModal] = useState<"ios" | "android" | null>(null)
  const [showLearnMore, setShowLearnMore] = useState(false)
  const [currentDateTime, setCurrentDateTime] = useState<Date | null>(null)

  useEffect(() => {
    // Initialize on client only to prevent hydration mismatch
    setCurrentDateTime(new Date())
    const interval = setInterval(() => {
      setCurrentDateTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Get current year safely after hydration
  const currentYear = currentDateTime?.getFullYear() || new Date().getFullYear()

  const formatDate = (date: Date | null) => {
    if (!date) return "--"
    return date.toLocaleDateString("fr-FR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const formatTime = (date: Date | null) => {
    if (!date) return "--:--:--"
    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-2 rounded-lg">
              <HeartPulse className="h-6 w-6 text-primary" />
            </div>
            <span className="text-xl font-bold text-primary tracking-tight">Groupe Cardiomaine</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#" className="hover:text-primary transition-colors">
              L'Équipe
            </a>
            <a href="#" className="hover:text-primary transition-colors">
              Spécialités
            </a>
            <a href="#" className="hover:text-primary transition-colors">
              Patients
            </a>
            <a href="#" className="hover:text-primary transition-colors">
              Contact
            </a>
          </nav>
          <Button onClick={onLoginClick} className="shadow-lg shadow-primary/20">
            Espace Pro
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="py-20 md:py-32 bg-gradient-to-b from-blue-50/50 to-white">
          <div className="container mx-auto px-4 text-center max-w-4xl">
            <div className="mb-6 flex items-center justify-center gap-4">
              <Card className="inline-flex items-center gap-3 px-6 py-3 border-blue-200 bg-white/80 backdrop-blur-sm shadow-md">
                <Clock className="h-5 w-5 text-blue-600" />
                <div className="text-left">
                  <div className="text-2xl font-bold text-slate-900 tabular-nums tracking-tight">
                    {formatTime(currentDateTime)}
                  </div>
                  <div className="text-sm text-slate-600 capitalize">{formatDate(currentDateTime)}</div>
                </div>
              </Card>
            </div>

            <Badge className="mb-6 px-4 py-1 text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 border-none">
              Planning Médical {currentYear}
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-slate-900 mb-6">
              Plateforme de gestion : planning Cardiomaine
            </h1>
            <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
              Une équipe de cardiologues passionnés, unis pour offrir des soins de pointe. Accédez à votre planning et
              gérez vos gardes en toute simplicité.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" onClick={onLoginClick} className="h-12 px-8 text-lg shadow-xl shadow-primary/20">
                Accéder au Planning
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-8 text-lg bg-transparent"
                onClick={() => setShowLearnMore(true)}
              >
                En savoir plus
              </Button>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-3 gap-8">
              <Card className="border-none shadow-lg bg-slate-50/50">
                <CardHeader>
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                    <Activity className="h-6 w-6 text-blue-600" />
                  </div>
                  <CardTitle>Suivi Temps Réel</CardTitle>
                  <CardDescription>
                    Visualisez les gardes, astreintes et vacations en temps réel. Mises à jour instantanées pour toute
                    l'équipe.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="border-none shadow-lg bg-slate-50/50">
                <CardHeader>
                  <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center mb-4">
                    <ShieldCheck className="h-6 w-6 text-teal-600" />
                  </div>
                  <CardTitle>Sécurité Maximale</CardTitle>
                  <CardDescription>
                    Accès sécurisé avec authentification forte. Vos données de planning sont protégées et
                    confidentielles.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="border-none shadow-lg bg-slate-50/50">
                <CardHeader>
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                    <Phone className="h-6 w-6 text-purple-600" />
                  </div>
                  <CardTitle>Accès Mobile</CardTitle>
                  <CardDescription>
                    Une application fluide disponible sur iOS et Android. Consultez votre emploi du temps où que vous
                    soyez.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        {/* App Download Section */}
        <section className="py-20 bg-slate-900 text-white">
          <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-12">
            <div className="max-w-xl">
              <h2 className="text-3xl font-bold mb-4">Emportez votre planning partout</h2>
              <p className="text-slate-300 mb-8 text-lg">
                Installez l'application Cardiomaine sur votre smartphone pour un accès rapide et sécurisé. Disponible
                pour tous les médecins du groupe.
              </p>
              <div className="flex gap-4">
                <Button variant="secondary" className="h-14 px-6" onClick={() => setShowInstallModal("ios")}>
                  <Download className="mr-2 h-5 w-5" />
                  Installer sur iPhone
                </Button>
                <Button variant="secondary" className="h-14 px-6" onClick={() => setShowInstallModal("android")}>
                  <Download className="mr-2 h-5 w-5" />
                  Installer sur Android
                </Button>
              </div>
            </div>
            <div className="relative w-full max-w-xs aspect-[9/19] bg-slate-800 rounded-[3rem] border-8 border-slate-700 shadow-2xl overflow-hidden hidden md:block">
              <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
                <div className="text-center p-6">
                  <HeartPulse className="h-16 w-16 text-primary mx-auto mb-4" />
                  <h3 className="text-xl font-bold">Cardiomaine</h3>
                  <p className="text-sm text-slate-400 mt-2">Bienvenue Dr P</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {showInstallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md relative bg-white">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2"
              onClick={() => setShowInstallModal(null)}
            >
              <LogOut className="h-4 w-4 rotate-45" />
            </Button>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {showInstallModal === "ios" ? <Phone className="h-6 w-6" /> : <Download className="h-6 w-6" />}
                Installation sur {showInstallModal === "ios" ? "iPhone" : "Android"}
              </CardTitle>
              <CardDescription>Suivez ces étapes pour ajouter l'app à votre écran d'accueil</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {showInstallModal === "ios" ? (
                <ol className="list-decimal list-inside space-y-3 text-sm text-slate-600">
                  <li className="flex items-center gap-2">
                    Ouvrez ce site dans <span className="font-bold text-slate-900">Safari</span>
                  </li>
                  <li className="flex items-center gap-2">
                    Appuyez sur le bouton Partager <Share className="h-4 w-4" />
                  </li>
                  <li className="flex items-center gap-2">
                    Faites défiler et choisissez{" "}
                    <span className="font-bold text-slate-900">"Sur l'écran d'accueil"</span>
                  </li>
                  <li className="flex items-center gap-2">
                    Appuyez sur <span className="font-bold text-slate-900">Ajouter</span>
                  </li>
                </ol>
              ) : (
                <ol className="list-decimal list-inside space-y-3 text-sm text-slate-600">
                  <li className="flex items-center gap-2">
                    Ouvrez ce site dans <span className="font-bold text-slate-900">Chrome</span>
                  </li>
                  <li className="flex items-center gap-2">
                    Appuyez sur le menu (3 points) <MoreVertical className="h-4 w-4" />
                  </li>
                  <li className="flex items-center gap-2">
                    Sélectionnez <span className="font-bold text-slate-900">"Installer l'application"</span> ou "Ajouter
                    à l'écran d'accueil"
                  </li>
                  <li className="flex items-center gap-2">
                    Confirmez en appuyant sur <span className="font-bold text-slate-900">Installer</span>
                  </li>
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {showLearnMore && <LearnMoreModal onClose={() => setShowLearnMore(false)} />}

      {/* Footer */}
      <footer className="bg-white border-t py-12">
        <div className="container mx-auto px-4 text-center text-slate-500 text-sm">
          <p>© {currentYear} Groupe Cardiomaine. Tous droits réservés.</p>
          <p className="mt-2">Accès réservé aux professionnels de santé.</p>
        </div>
      </footer>
    </div>
  )
}
