import { redirect } from "next/navigation"

/**
 * Redirection côté serveur : l'authentification est déjà imposée par `proxy.ts`
 * (session absente → /auth/login), inutile de charger un bundle client pour
 * re-vérifier la session avant de rebondir vers le planning.
 */
export default function ProtectedPage() {
  redirect("/protected/planning")
}
