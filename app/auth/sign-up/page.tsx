import { redirect } from "next/navigation"

/**
 * Inscription publique — désactivée.
 *
 * Cette page proposait un formulaire d'inscription libre. Il ne produisait que
 * des comptes inutilisables : la confirmation d'adresse est exigée par le
 * projet Supabase, aucun service d'envoi d'e-mail n'y est configuré, et le
 * message de confirmation n'était donc jamais expédié (`confirmation_sent_at`
 * restait nul). L'utilisateur repartait avec des identifiants que l'écran de
 * connexion refusait ensuite sans expliquer pourquoi.
 *
 * Plus grave : `profiles.role` a pour valeur par défaut `'admin'`, et le
 * déclencheur `on_auth_user_created` crée la ligne de profil sans préciser de
 * rôle. Toute inscription libre fabriquait donc un **administrateur** du
 * planning — capable de modifier la grille de tout le service. Seule l'absence
 * d'envoi d'e-mail empêchait d'en arriver là ; configurer un SMTP aurait
 * ouvert la porte sans que rien ne le signale.
 *
 * Les comptes sont créés par un administrateur depuis
 * `/protected/admin/users`, qui fixe le rôle explicitement. La route est
 * conservée plutôt que supprimée pour que les liens et favoris existants
 * mènent à l'écran de connexion au lieu d'une page absente.
 */
export default function SignUpDisabledPage() {
  redirect("/auth/login")
}
