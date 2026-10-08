/**
 * Comptes limités à la **consultation du calendrier NCT** (aucun accès au
 * planning ni aux autres rubriques). Identifiés par `profiles.doctor_code`.
 * Un admin n'est jamais restreint, même s'il porte un de ces codes.
 */
export const NCT_ONLY_CODES: readonly string[] = ["C", "E"]

export function isNctOnlyAccount(profile: { role?: string | null; doctor_code?: string | null } | null | undefined): boolean {
  if (!profile || profile.role === "admin") return false
  return NCT_ONLY_CODES.includes((profile.doctor_code || "").trim().toUpperCase())
}
