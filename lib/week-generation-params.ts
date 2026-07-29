/**
 * Paramètres de semaine envoyés au solveur avant « Générer »
 * (VISITE / LFB / PSSL) — désignés par l’admin, avec défauts de rotation.
 */

export const VISITE_POOL = ["U", "A", "B"] as const
export type VisiteDoctor = (typeof VISITE_POOL)[number]

/** Pool LFB live solveur (≠ ancien B/Z/A côté front). */
export const LFB_POOL = ["H", "S", "G"] as const
export type LfbDoctor = (typeof LFB_POOL)[number]

export type WeekGenerationParams = {
  /** Qui est en semaine de VISITE (roulement 1/3). Vide = aucune contrainte. */
  visite_doctor: VisiteDoctor | ""
  /** Qui fait LFB ce jeudi (roulement 1/3). Vide = aucune contrainte. */
  lfb_doctor: LfbDoctor | ""
  /** B fait PSSL ce jeudi. */
  pssl_b_active: boolean
  /** Z fait PSSL ce mardi. */
  pssl_z_active: boolean
}

/** Défaut Visite = même formule que `VISITE_ROTATION` (U → A → B). */
export function defaultVisiteDoctor(weekNum: number): VisiteDoctor {
  return VISITE_POOL[((weekNum % 3) + 3) % 3]
}

/** Défaut LFB jeudi = H → S → G. */
export function defaultLfbDoctor(weekNum: number): LfbDoctor {
  return LFB_POOL[((weekNum % 3) + 3) % 3]
}

/**
 * Défauts PSSL (suggestions) :
 * - semaines impaires → B jeudi
 * - semaines paires → Z mardi
 * (les deux peuvent être cochés manuellement la même semaine)
 */
export function defaultPsslFlags(weekNum: number): {
  pssl_b_active: boolean
  pssl_z_active: boolean
} {
  const odd = weekNum % 2 === 1
  return {
    pssl_b_active: odd,
    pssl_z_active: !odd,
  }
}

/** Pré-remplit les params pour une semaine ISO (admin peut corriger). */
export function defaultWeekGenerationParams(weekNum: number): WeekGenerationParams {
  const pssl = defaultPsslFlags(weekNum)
  return {
    visite_doctor: defaultVisiteDoctor(weekNum),
    lfb_doctor: defaultLfbDoctor(weekNum),
    pssl_b_active: pssl.pssl_b_active,
    pssl_z_active: pssl.pssl_z_active,
  }
}

/** Forme envoyée au solveur (undefined = champ omis / rétrocompatible). */
export type WeekGenerationSolverOverrides = {
  visite_doctor?: VisiteDoctor | null
  lfb_doctor?: LfbDoctor | null
  pssl_b_active?: boolean
  pssl_z_active?: boolean
}

export function toSolverWeekGenerationOverrides(
  params: WeekGenerationParams,
): WeekGenerationSolverOverrides {
  return {
    visite_doctor: params.visite_doctor || null,
    lfb_doctor: params.lfb_doctor || null,
    pssl_b_active: Boolean(params.pssl_b_active),
    pssl_z_active: Boolean(params.pssl_z_active),
  }
}
