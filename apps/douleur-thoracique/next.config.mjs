import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

const projectRoot = dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Export statique : l'application est entièrement cliente (aucun calcul
  // n'est fait côté serveur, aucune donnée patient ne quitte l'appareil).
  // Le dossier `out/` est déployable sur n'importe quel hébergeur statique
  // et sert de base au wrapper Android (TWA) / iOS.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },

  // Cette application vit dans le dossier `apps/` d'un dépôt qui contient une
  // autre application Next.js. Sans racine explicite, Turbopack remonte au
  // lockfile du dépôt parent et compile les fichiers de l'autre projet.
  turbopack: { root: projectRoot },
  outputFileTracingRoot: projectRoot,
}

export default nextConfig
