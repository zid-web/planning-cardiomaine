/**
 * Paramètres de semaine envoyés au solveur avant « Générer »
 * (VISITE / LFB / PSSL) — calculés automatiquement selon les rotations
 * définies par l'utilisateur, sans intervention manuelle.
 *
 * Règles métier (confirmées utilisateur 04/08/2026) :
 *  - PSSL  : B et Z alternent le jeudi (1 jeudi sur 2).
 *            Si c'est la semaine de VISITE de B → repli automatique sur Z.
 *            PSSL fermé S28 à S36 inclus (congés d'été).
 *  - LFB   : G, S, H alternent le jeudi (1 jeudi sur 3, round-robin).
 *            Si le désigné est indisponible → repli sur l'un des deux autres
 *            (logique déjà gérée côté solveur via la liste candidates).
 *            LFB fermé S28 à S36 inclus (congés d'été).
 *  - VISITE: U → A → B (rotation 1 semaine sur 3).
 */

export const VISITE_POOL = ["U", "A", "B"] as const
export type VisiteDoctor = (typeof VISITE_POOL)[number]

/**
 * Pool LFB — rotation **H → S → G** (modulo 3 sur le numéro ISO de semaine).
 * Source unique : `apply-structural-constraints` et `schedule-utils` importent
 * cette constante. L'ordre était auparavant divergent entre les trois fichiers
 * (`G, S, H` ici contre `H, S, G` ailleurs), si bien que le `lfb_doctor` envoyé
 * au solveur ne désignait pas le médecin que la contrainte structurelle posait
 * ensuite — deux semaines sur trois. Ordre confirmé utilisateur 26/08/2026.
 */
export const LFB_POOL = ["H", "S", "G"] as const

/** Titulaire LFB du jeudi pour une semaine ISO, hors suspension estivale. */
export function lfbDoctorForWeekNum(weekNum: number): (typeof LFB_POOL)[number] {
  return LFB_POOL[((weekNum % 3) + 3) % 3]
}
export type LfbDoctor = (typeof LFB_POOL)[number]

/** Pool PSSL (B, Z). */
export const PSSL_POOL = ["B", "Z"] as const
export type PsslDoctor = (typeof PSSL_POOL)[number]

export type WeekGenerationParams = {
  /** Qui est en semaine de VISITE (roulement 1/3). Vide = aucune contrainte. */
  visite_doctor: VisiteDoctor | ""
  /** Qui fait LFB ce jeudi (roulement 1/3). Null = LFB fermé (été). */
  lfb_doctor: LfbDoctor | null
  /** Qui fait PSSL ce jeudi (roulement 1/2, avec repli si visite). Null = PSSL fermé (été). */
  pssl_doctor: PsslDoctor | null
}

/** Semaines de suspension estivale LFB + PSSL (S28 à S36 inclus). */
const SUMMER_SUSPENSION_START = 28
const SUMMER_SUSPENSION_END   = 36

function isSummerSuspension(weekNum: number): boolean {
  return weekNum >= SUMMER_SUSPENSION_START && weekNum <= SUMMER_SUSPENSION_END
}

/** Défaut Visite = U → A → B (modulo 3 sur numéro ISO de semaine). */
export function defaultVisiteDoctor(weekNum: number): VisiteDoctor {
  return VISITE_POOL[((weekNum % 3) + 3) % 3]
}

/**
 * Défaut LFB jeudi = H → S → G (modulo 3).
 * Retourne null pendant les congés d'été (S28-S36).
 */
export function defaultLfbDoctor(weekNum: number): LfbDoctor | null {
  if (isSummerSuspension(weekNum)) return null
  return lfbDoctorForWeekNum(weekNum)
}

/**
 * Défaut PSSL jeudi = B (semaines impaires) / Z (semaines paires).
 * Règle de repli : si le désigné principal est aussi en VISITE → l'autre fait PSSL.
 *   Ex : si B est en VISITE cette semaine et c'est la semaine de B pour PSSL → Z prend.
 * Retourne null pendant les congés d'été (S28-S36).
 */
export function defaultPsslDoctor(weekNum: number, visitDoctor?: VisiteDoctor | ""): PsslDoctor | null {
  if (isSummerSuspension(weekNum)) return null
  // B = semaines impaires, Z = semaines paires
  const primary: PsslDoctor = weekNum % 2 === 1 ? "B" : "Z"
  const fallback: PsslDoctor = primary === "B" ? "Z" : "B"
  // Repli si le désigné est aussi en VISITE cette semaine
  if (visitDoctor && primary === visitDoctor) {
    return fallback
  }
  return primary
}

/** Pré-remplit les params pour une semaine ISO — tout automatique. */
export function defaultWeekGenerationParams(weekNum: number): WeekGenerationParams {
  const visite_doctor = defaultVisiteDoctor(weekNum)
  return {
    visite_doctor,
    lfb_doctor:  defaultLfbDoctor(weekNum),
    pssl_doctor: defaultPsslDoctor(weekNum, visite_doctor),
  }
}

/** Forme envoyée au solveur. */
export type WeekGenerationSolverOverrides = {
  visite_doctor?: VisiteDoctor | null
  lfb_doctor?: LfbDoctor | null
  pssl_doctor?: PsslDoctor | null
  // Champs legacy conservés pour rétrocompatibilité solveur
  pssl_b_active?: boolean
  pssl_z_active?: boolean
}

export function toSolverWeekGenerationOverrides(
  params: WeekGenerationParams,
): WeekGenerationSolverOverrides {
  return {
    visite_doctor: params.visite_doctor || null,
    lfb_doctor:    params.lfb_doctor    ?? null,
    pssl_doctor:   params.pssl_doctor   ?? null,
    // Legacy : on infère les flags booléens depuis pssl_doctor pour
    // les éventuelles versions du solveur qui liraient encore pssl_b/z_active.
    pssl_b_active: params.pssl_doctor === "B",
    pssl_z_active: params.pssl_doctor === "Z",
  }
}
