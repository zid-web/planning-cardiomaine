import { NextResponse } from "next/server"
import { BUILD_ID } from "@/lib/build-id"

/**
 * Version du déploiement servant actuellement l'application.
 *
 * Interrogé par `AppUpdateWatcher` pour comparer avec la version qui a rendu
 * la page. Route publique (déclarée dans `proxy.ts`) : le layout racine monte
 * le watcher partout, page de connexion comprise.
 */
export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  return NextResponse.json(
    { buildId: BUILD_ID },
    { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } },
  )
}
