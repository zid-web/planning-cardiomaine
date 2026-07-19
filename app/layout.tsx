import React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "CardioPlanning - Optimisez vos plannings médicaux avec l'IA",
  description: "Plateforme intelligente de gestion des plannings hospitaliers. Réduisez les conflits, équilibrez les charges de travail et augmentez la satisfaction des médecins.",
  generator: "v0.app",
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
        <Analytics />
      </body>
    </html>
  )
}
