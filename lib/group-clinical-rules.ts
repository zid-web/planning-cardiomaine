/**
 * Consignes groupe Cardiomaine extraites du PDF DOC022 (fonctionnement / répartition).
 * Source scannée → OCR agent Cursor (2026-07-28).
 *
 * Sert de base machine-readable pour :
 * - contraintes structurelles front (`applyDoc022FixedClinicalSlots`)
 * - payload / patch `rules_config` solveur (`toSolverClinicalRulesPayload`)
 * - documentation agents (`docs/CONSIGNES-GROUPE-DOC022.md`)
 */

export type HalfSlot = "matin" | "am"

/** Identité métier (code planning → nom DOC022). */
export const DOC022_DOCTOR_NAMES: Record<string, string> = {
  A: "Amirault",
  H: "Bachelet",
  W: "Ben Amara",
  B: "Braun",
  O: "Bros",
  T: "Cloitre",
  Z: "Denizet",
  K: "Dericbourg",
  U: "Kabalu",
  V: "Lefebvre",
  P: "Poret",
  R: "Rousseau",
  G: "Terrien",
  S: "Saint André",
  M: "Zid",
  FV: "FV (externe garde/coro)",
  DAAS: "DAAS (EE2 externe)",
  D: "D (echo PSS stress externe)",
  CH: "Centre Hospitalier",
  I: "Interne",
  Val: "Val",
}

/**
 * Éligibilité tâches cliniques (qui peut faire quoi).
 * Aligné DOC022 ; utilisé pour guider historical_patterns / proposals.
 */
export const DOC022_CLINICAL_ELIGIBILITY = {
  /** Écho simple / ETT */
  echo: ["A", "H", "W", "B", "Z", "K", "P", "R", "G", "S", "M", "O", "V"],
  /** Épreuve d’effort */
  ee: ["A", "H", "W", "B", "O", "T", "Z", "K", "U", "V", "G", "S", "M", "R"],
  /** Echo de stress / EDS — W non éligible (consigne métier) */
  stress: ["A", "H", "B", "Z", "K", "G", "S"],
  /** ETO */
  eto: ["H", "Z", "G"],
  /** CORO / angioplastie */
  coro: ["W", "M", "O", "FV"],
  /** Rythmologie */
  rythmo: ["A", "U", "P"],
  /** Rééducation */
  reeduc: ["Z", "B", "S", "G", "H", "K"],
  /** Contrôle pace-maker */
  controle_pm: ["A", "U", "P"],
  /** IRM cœur */
  irm: ["S"],
  /** Scintigraphie */
  scinti: ["T", "R"],
  /** Cs cabinet Tessé (préférence) */
  cs_tesse: ["B", "S", "V", "U"],
} as const

/**
 * ½ journées libres habituelles (après-midi sauf mention).
 * Doit rester aligné `HABITUAL_HALF_DAYS_OFF` / rules_config half_days_off.
 */
export const DOC022_HALF_DAYS_OFF: Array<{ day: string; slot: HalfSlot; doctors: string[] }> = [
  { day: "LUNDI", slot: "matin", doctors: ["R", "K"] },
  { day: "LUNDI", slot: "am", doctors: ["K"] },
  { day: "MARDI", slot: "am", doctors: ["S"] },
  { day: "MERCREDI", slot: "am", doctors: ["M", "W", "G", "Z", "H", "B"] },
  { day: "JEUDI", slot: "am", doctors: ["U", "P"] },
  { day: "VENDREDI", slot: "matin", doctors: ["K"] },
  { day: "VENDREDI", slot: "am", doctors: ["O", "A", "K", "R", "T"] },
]

/**
 * Créneaux structurels DOC022 à injecter (hors IRM/FV/DAAS/Rythmo/Visite déjà gérés).
 * row_key = ligne planning UI.
 */
export type Doc022FixedSlot = {
  row: string
  day: string
  doctor: string
  note: string
}

export const DOC022_FIXED_CLINICAL_SLOTS: Doc022FixedSlot[] = [
  // Echo 1 réservé Poret lundi matin
  {
    row: "Matin - ETT salle 1",
    day: "LUNDI",
    doctor: "P",
    note: "DOC022 ECHO1 réservé Dr Poret 9h30–11h30",
  },
  // Echo enfants Saint André mercredi apm
  {
    row: "Apm - ETT salle 1",
    day: "MERCREDI",
    doctor: "S",
    note: "DOC022 ECHO1 écho enfants Dr Saint André 14h–16h30",
  },
  // EE2 : Lefebvre lundi matin ; Bros vendredi matin (DAAS reste apm lundi)
  {
    row: "Matin - EE2",
    day: "LUNDI",
    doctor: "V",
    note: "DOC022 EE2 matin réservé Dr Lefebvre 9h30–11h30",
  },
  {
    row: "Matin - EE2",
    day: "VENDREDI",
    doctor: "O",
    note: "DOC022 EE2 matin réservé Dr Bros",
  },
  // Scinti CCS
  {
    row: "Hors site - Scinti",
    day: "LUNDI",
    doctor: "T",
    note: "DOC022 Scinti CCS Dr Cloitre lundi matin",
  },
  {
    row: "Hors site - Scinti",
    day: "MERCREDI",
    doctor: "T",
    note: "DOC022 Scinti CCS Dr Cloitre mercredi matin",
  },
  {
    row: "Hors site - Scinti",
    day: "MARDI",
    doctor: "R",
    note: "DOC022 Scinti Dr Rousseau mardi matin",
  },
]

/** Hors site / sites externes (fréquence soft — pas forcés chaque semaine). */
export const DOC022_EXTERNAL_SITES = {
  "Hors site - IRM": {
    doctors: ["S"],
    fixed: [
      { day: "LUNDI", slot: "matin" },
      { day: "VENDREDI", slot: "am" },
    ],
  },
  "Hors site - Scinti": {
    doctors: ["T", "R"],
    preferred: [
      { day: "LUNDI", doctor: "T", slot: "matin" },
      { day: "MERCREDI", doctor: "T", slot: "matin" },
      { day: "MARDI", doctor: "R", slot: "matin" },
    ],
  },
  /** La Ferté Bernard — ~1 jeudi / mois (H, U, G, S) */
  la_ferte_bernard: { doctors: ["H", "U", "G", "S"], cadence: "1_jeudi_par_mois" },
  /** Pôle santé Sarthe Loir — ~2 jeudis / mois (B, Z) */
  pole_sante_sarthe_loir: { doctors: ["B", "Z"], cadence: "2_jeudis_par_mois" },
  /** CH Château-du-Loir — mardi matin (O, parfois V) */
  chateau_du_loir: { doctors: ["O", "V"], cadence: "mardi_matin" },
  /** NCT+ — 1 jeudi / mois ou calendrier fixe (M, W) */
  nct_plus: { doctors: ["M", "W"], cadence: "calendrier_nct" },
} as const

/**
 * Payload additionnel pour `rules_override` / merge rules_config solveur.
 * Le backend ignore les clés inconnues ; les clés supportées enrichissent la génération.
 */
export function toSolverClinicalRulesPayload() {
  return {
    clinical_eligibility: DOC022_CLINICAL_ELIGIBILITY,
    doc022_fixed_slots: DOC022_FIXED_CLINICAL_SLOTS.map((s) => ({
      row_key: s.row,
      day_name: s.day,
      doctor: s.doctor,
      note: s.note,
    })),
    half_days_off: DOC022_HALF_DAYS_OFF,
    // Aligné DOC022 + déjà en prod
    reeduc_allowed: [...DOC022_CLINICAL_ELIGIBILITY.reeduc],
    coro_allowed: [...DOC022_CLINICAL_ELIGIBILITY.coro],
    rythmo_allowed: [...DOC022_CLINICAL_ELIGIBILITY.rythmo],
    nct_allowed: ["M", "W"],
  }
}
