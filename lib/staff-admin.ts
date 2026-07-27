/**
 * Admins staff avec initiale de connexion (`profiles.doctor_code`)
 * qui **ne sont pas** des médecins du planning.
 *
 * - PAS dans `DOCTORS` / `STAFF_INITIALS` → jamais proposés aux cases,
 *   hors équité / hors solveur / hors vacances médicales.
 * - `profiles.role = 'admin'` → édition complète du planning des autres.
 */
export const NON_SCHEDULING_STAFF_ADMINS = [
  {
    code: "L",
    email: "luciecardiomaine@gmail.com",
    first_name: "Lucie",
    last_name: "",
  },
] as const

export type NonSchedulingStaffAdmin = (typeof NON_SCHEDULING_STAFF_ADMINS)[number]

/** Codes dont les saisies admin passent directement en `validated` (M/Z médecins-admins + L). */
export const AUTO_VALIDATE_ADMIN_CODES = new Set<string>([
  "M",
  "Z",
  ...NON_SCHEDULING_STAFF_ADMINS.map((a) => a.code),
])

export function isNonSchedulingStaffAdminCode(code: string | null | undefined): boolean {
  if (!code) return false
  const upper = code.trim().toUpperCase()
  return NON_SCHEDULING_STAFF_ADMINS.some((a) => a.code === upper)
}

/** True si ce `doctor_code` valide immédiatement ses modifications grille. */
export function adminEditsAreValidated(doctorCode: string | null | undefined): boolean {
  if (!doctorCode) return false
  return AUTO_VALIDATE_ADMIN_CODES.has(doctorCode.trim().toUpperCase())
}

export function findNonSchedulingStaffAdminByEmail(
  email: string | null | undefined,
): NonSchedulingStaffAdmin | undefined {
  if (!email) return undefined
  const normalized = email.trim().toLowerCase()
  return NON_SCHEDULING_STAFF_ADMINS.find((a) => a.email === normalized)
}
