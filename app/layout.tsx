import React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Toaster } from "sonner"
import { ServiceWorkerRegister } from "@/components/service-worker-register"
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
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="h-full overflow-hidden">
      <body className={`font-sans antialiased h-full overflow-hidden m-0 p-0`}>
        <div id="root" className="h-full overflow-hidden">
          {children}
        </div>
        <Toaster richColors position="top-center" />
        <Analytics />
        <SpeedInsights />
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
