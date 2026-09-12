import type { Metadata, Viewport } from "next"
import { ServiceWorkerRegistrar } from "@/components/shell/service-worker-registrar"
import { InstallPrompt } from "@/components/shell/install-prompt"
import { OfflineBadge } from "@/components/shell/offline-badge"
import "./globals.css"

export const metadata: Metadata = {
  title: "Douleur Thoracique au Cabinet — Aide à la décision",
  description:
    "Outil d'aide à la décision pour la douleur thoracique au cabinet : triage, classification symptomatique ESC 2024, probabilité clinique RF-CL (Winther 2020), pondération CACS-CL et chaîne bayésienne séquentielle. Fonctionne hors ligne, aucune donnée patient ne quitte l'appareil.",
  applicationName: "Douleur Thoracique",
  manifest: "/manifest.webmanifest",
  keywords: [
    "douleur thoracique",
    "RF-CL",
    "CACS-CL",
    "probabilité pré-test",
    "ESC 2024",
    "syndrome coronarien chronique",
    "cardiologie",
  ],
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Douleur Thx",
  },
  formatDetection: { telephone: true },
  openGraph: {
    type: "website",
    siteName: "Douleur Thoracique au Cabinet",
    title: "Douleur Thoracique au Cabinet — Aide à la décision",
    description:
      "Probabilité clinique RF-CL / CACS-CL et stratégie diagnostique ESC 2024, utilisable hors ligne au cabinet.",
  },
}

export const viewport: Viewport = {
  themeColor: "#1e293b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className="antialiased">
        {children}
        {/* Pile flottante : les indicateurs s'empilent au lieu de se recouvrir
            sur les écrans étroits. */}
        <div className="pointer-events-none fixed bottom-3 right-3 z-50 flex flex-col items-end gap-2 print:hidden [&>*]:pointer-events-auto">
          <OfflineBadge />
          <InstallPrompt />
        </div>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  )
}
