import React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import ServiceWorkerRegistrar from "@/components/service-worker-registrar"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const viewport: Viewport = {
  themeColor: "#1e40af",
}

export const metadata: Metadata = {
  title: "Plateforme de gestion : planning Cardiomaine",
  description: "Plateforme de gestion de planning pour le Groupe Cardiomaine",
  generator: "v0.app",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Cardiomaine",
  },
  icons: {
    icon: [
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
    apple: "/apple-icon.png",
  },
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
        <ServiceWorkerRegistrar />
        <Analytics />
      </body>
    </html>
  )
}
