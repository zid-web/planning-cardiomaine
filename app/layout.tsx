import React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Toaster } from "sonner"
import AppUpdateWatcher from "@/components/app-update-watcher"
import { BUILD_ID } from "@/lib/build-id"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Plateforme de gestion : planning Cardiomaine",
  description: "Plateforme de gestion du planning - Cardiomaine",
  generator: "v0.app",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    // Permet l'installation "Sur l'écran d'accueil" sur iOS/Safari - iOS ne
    // suit pas le manifest.json standard pour cette partie, il faut ces
    // balises spécifiques (confirmé utilisateur 24/08/2026).
    capable: true,
    statusBarStyle: "default",
    title: "Cardiomaine",
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
  // Pas de `maximumScale: 1` : bloquer le zoom pincé casse l'accessibilité
  // (WCAG 1.4.4) sur une grille de planning dense. Les champs de saisie sont
  // en `text-base` (16 px) sur mobile, donc iOS ne déclenche pas de zoom
  // automatique à la prise de focus.
  // `viewportFit: "cover"` : indispensable en mode standalone iOS pour que
  // `env(safe-area-inset-*)` (déjà utilisé par `.safe-area-pb`) renvoie autre
  // chose que 0 — sinon encoche et barre d'accueil recouvrent l'UI.
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" className="h-full overflow-hidden">
      <body className={`font-sans antialiased h-full overflow-hidden m-0 p-0`}>
        <div id="root" className="h-full overflow-hidden">
          {children}
        </div>
        <Toaster richColors position="top-center" />
        {/* Détecte une nouvelle version après déploiement et rattrape les
            chunks manquants sur un onglet resté ouvert. */}
        <AppUpdateWatcher buildId={BUILD_ID} />
        <Analytics />
        <SpeedInsights />
        {/* Enregistrement du service worker en ligne (confirmé utilisateur
            24/08/2026) - évite toute dépendance à un fichier composant
            séparé, qui posait problème au déploiement.
            + Capture TRÈS TÔT de "beforeinstallprompt" : le navigateur émet
            souvent cet événement avant l'hydratation React, donc l'écouter
            seulement depuis un composant faisait perdre l'invite native et le
            bouton « Installer l'application » restait inerte. On mémorise
            l'événement sur window.__pwaInstallPrompt pour que le bouton
            puisse le déclencher au clic, quel que soit le moment. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== "undefined") {
                window.__pwaInstallPrompt = window.__pwaInstallPrompt || null;
                window.addEventListener("beforeinstallprompt", function (e) {
                  e.preventDefault();
                  window.__pwaInstallPrompt = e;
                });
                window.addEventListener("appinstalled", function () {
                  window.__pwaInstallPrompt = null;
                });
                if ("serviceWorker" in navigator) {
                  window.addEventListener("load", function () {
                    navigator.serviceWorker.register("/sw.js").catch(function (err) {
                      console.warn("[pwa] Échec de l'enregistrement du service worker:", err);
                    });
                  });
                }
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
