import type { MetadataRoute } from "next"

// Requis par `output: "export"` : le manifeste est écrit une fois à la
// compilation plutôt que servi par une route dynamique.
export const dynamic = "force-static"

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Douleur Thoracique au Cabinet",
    short_name: "Douleur Thx",
    description:
      "Aide à la décision pour la douleur thoracique au cabinet : RF-CL, CACS-CL et chaîne bayésienne ESC 2024. Fonctionne hors ligne.",
    lang: "fr",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f8fafc",
    theme_color: "#1e293b",
    categories: ["medical", "health", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
