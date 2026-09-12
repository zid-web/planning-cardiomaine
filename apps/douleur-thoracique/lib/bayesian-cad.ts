/**
 * Bayesian CAD — moteur mathématique continu (0–100 %) pour l'estimation
 * itérative de la probabilité de coronaropathie obstructive.
 *
 * Pile de modèles intégrés :
 *   1. RF-CL continu — interpolation logistique de la table Winther 2020
 *      (lissage logit-affine en âge × nombre de FdR, indexée par sexe et
 *      type de symptôme). Donne une probabilité continue plutôt qu'une
 *      probabilité par bin.
 *   2. Facteurs d'enrichissement — coefficients log-odds (β) appliqués
 *      additivement sur le logit (ESC 2024 + littérature) :
 *        · ATCD coronaropathie documentée  : β =  1.40  (OR ~4.0)
 *        · ECG ischémique de repos         : β =  0.95  (OR ~2.6)
 *        · Dysfonction VG (FEVG < 50 %)    : β =  0.75  (OR ~2.1)
 *      Borné dans [logit(0.005), logit(0.97)].
 *   3. CACS-CL — formule officielle Winther 2020 (lib/cacs-cl.ts). Si CACS
 *      connu, remplace le RF-CL par CACS-CL avant application des autres
 *      modificateurs.
 *   4. Mise à jour bayésienne séquentielle (Knuuti 2018) — chaque test
 *      d'imagerie multiplie les odds par son rapport de vraisemblance
 *      (LR+ si positif, LR- si négatif).
 *   5. Intervalle de confiance — IC95 indicatif sur l'échelle logit :
 *        SE_total² = SE_modèle² + Σ SE_LR²
 *      avec SE_modèle ≈ 0.30 (incertitude de la régression Winther),
 *      et SE_LR estimée par la largeur des IC publiés dans Knuuti 2018.
 *
 * Références :
 *   · Winther S et al., JACC 2020;76:2421-2432 (RF-CL et CACS-CL)
 *   · Knuuti J et al., Eur Heart J 2018;39:3322-3330 (méta-analyse LR
 *     des tests non-invasifs pour CAD obstructive)
 *   · Vrints C et al., ESC CCS 2024, Eur Heart J 2024;45:3415-3537
 *
 * Usage strictement médical — outil d'aide à la décision, ne remplace
 * pas le jugement clinique.
 */

import { computeCACSCLFromBin, type CACSBin } from "./cacs-cl"

// ── Types fondamentaux ─────────────────────────────────────────────────────

export type Sex = "homme" | "femme"
export type SymptomClass = "typique" | "atypique" | "non-angineux" | "non-coronarien"

export interface PatientInput {
  /** Âge en années (continu, 30–90). */
  age: number
  sex: Sex
  symptom: SymptomClass
  /** Nombre de facteurs de risque CV majeurs (0–5). */
  rfCount: number
}

export interface EnrichmentFactors {
  /** Antécédent de coronaropathie documentée (stent, pontage, IDM). */
  atcdCoronaire: boolean
  /** ECG de repos : modifications ischémiques. */
  ecgIschemique: boolean
  /** Dysfonction VG documentée (FEVG < 50 %). */
  dvgFEVG: boolean
  /** Catégorie CACS d'Agatston (null si non réalisé). */
  cacs: CACSBin | null
}

export const DEFAULT_ENRICHMENT: EnrichmentFactors = {
  atcdCoronaire: false,
  ecgIschemique: false,
  dvgFEVG: false,
  cacs: null,
}

/** Coefficients log-odds des facteurs d'enrichissement (β). */
export const ENRICHMENT_COEFS = {
  atcdCoronaire: 1.40, // OR ~4.0
  ecgIschemique: 0.95, // OR ~2.6
  dvgFEVG: 0.75, // OR ~2.1
} as const

/** SE (échelle logit) du modèle clinique de base — incertitude RF-CL. */
const MODEL_SE_LOGIT = 0.3

/** SE additionnelle si facteurs d'enrichissement actifs (cumulative). */
const ENRICHMENT_SE_LOGIT = 0.15

// ── Tables Winther 2020 (RF-CL) ────────────────────────────────────────────
// Identique à la table déjà utilisée dans le wizard (composants/wizard/step3-rfcl).
// Indexée par : sexe → âge (cinq tranches) → catégorie FdR (3) → symptôme (4).
// Les valeurs sont des % entiers issus de la publication originale.

type AgeKey = "30-39" | "40-49" | "50-59" | "60-69" | "70+"
type RFKey = "0-1" | "2-3" | "4-5"

const WINTHER_TABLE: Record<Sex, Record<AgeKey, Record<RFKey, Record<SymptomClass, number>>>> = {
  homme: {
    "30-39": {
      "0-1": { typique: 18, atypique: 5, "non-angineux": 2, "non-coronarien": 2 },
      "2-3": { typique: 26, atypique: 7, "non-angineux": 3, "non-coronarien": 3 },
      "4-5": { typique: 36, atypique: 11, "non-angineux": 4, "non-coronarien": 4 },
    },
    "40-49": {
      "0-1": { typique: 24, atypique: 7, "non-angineux": 3, "non-coronarien": 3 },
      "2-3": { typique: 33, atypique: 10, "non-angineux": 4, "non-coronarien": 4 },
      "4-5": { typique: 44, atypique: 15, "non-angineux": 6, "non-coronarien": 6 },
    },
    "50-59": {
      "0-1": { typique: 33, atypique: 11, "non-angineux": 4, "non-coronarien": 4 },
      "2-3": { typique: 44, atypique: 16, "non-angineux": 6, "non-coronarien": 6 },
      "4-5": { typique: 55, atypique: 23, "non-angineux": 9, "non-coronarien": 9 },
    },
    "60-69": {
      "0-1": { typique: 44, atypique: 16, "non-angineux": 7, "non-coronarien": 7 },
      "2-3": { typique: 55, atypique: 23, "non-angineux": 10, "non-coronarien": 10 },
      "4-5": { typique: 66, atypique: 32, "non-angineux": 14, "non-coronarien": 14 },
    },
    "70+": {
      "0-1": { typique: 55, atypique: 23, "non-angineux": 10, "non-coronarien": 10 },
      "2-3": { typique: 65, atypique: 32, "non-angineux": 14, "non-coronarien": 14 },
      "4-5": { typique: 74, atypique: 42, "non-angineux": 20, "non-coronarien": 20 },
    },
  },
  femme: {
    "30-39": {
      "0-1": { typique: 6, atypique: 2, "non-angineux": 1, "non-coronarien": 1 },
      "2-3": { typique: 9, atypique: 3, "non-angineux": 1, "non-coronarien": 1 },
      "4-5": { typique: 14, atypique: 4, "non-angineux": 2, "non-coronarien": 2 },
    },
    "40-49": {
      "0-1": { typique: 11, atypique: 3, "non-angineux": 1, "non-coronarien": 1 },
      "2-3": { typique: 16, atypique: 5, "non-angineux": 2, "non-coronarien": 2 },
      "4-5": { typique: 23, atypique: 7, "non-angineux": 3, "non-coronarien": 3 },
    },
    "50-59": {
      "0-1": { typique: 17, atypique: 6, "non-angineux": 2, "non-coronarien": 2 },
      "2-3": { typique: 25, atypique: 8, "non-angineux": 3, "non-coronarien": 3 },
      "4-5": { typique: 34, atypique: 13, "non-angineux": 5, "non-coronarien": 5 },
    },
    "60-69": {
      "0-1": { typique: 27, atypique: 9, "non-angineux": 4, "non-coronarien": 4 },
      "2-3": { typique: 37, atypique: 14, "non-angineux": 5, "non-coronarien": 5 },
      "4-5": { typique: 47, atypique: 21, "non-angineux": 8, "non-coronarien": 8 },
    },
    "70+": {
      "0-1": { typique: 38, atypique: 14, "non-angineux": 5, "non-coronarien": 5 },
      "2-3": { typique: 49, atypique: 21, "non-angineux": 8, "non-coronarien": 8 },
      "4-5": { typique: 59, atypique: 30, "non-angineux": 12, "non-coronarien": 12 },
    },
  },
}

// ── Utilitaires logit / sigmoid ────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

/** logit(p) = ln(p / (1-p)) avec p ∈ (0, 1). */
function logit(p: number): number {
  const eps = 1e-6
  const q = clamp(p, eps, 1 - eps)
  return Math.log(q / (1 - q))
}

/** sigmoid(x) = 1 / (1 + e^-x). */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

// ── 1. RF-CL continu par interpolation logit ──��────────────────────────────

/**
 * Centre numérique d'une tranche d'âge utilisé comme abscisse pour
 * l'interpolation. La tranche "70+" est ancrée à 75 ans (la table couvre
 * principalement 70–80 ans).
 */
const AGE_CENTERS: Record<AgeKey, number> = {
  "30-39": 35,
  "40-49": 45,
  "50-59": 55,
  "60-69": 65,
  "70+": 75,
}

const RF_CENTERS: Record<RFKey, number> = {
  "0-1": 0.5, // moyenne de 0 et 1
  "2-3": 2.5,
  "4-5": 4.5,
}

const AGE_KEYS: AgeKey[] = ["30-39", "40-49", "50-59", "60-69", "70+"]
const RF_KEYS: RFKey[] = ["0-1", "2-3", "4-5"]

/**
 * Interpolation linéaire entre deux ancres sur l'échelle logit.
 * Garantit une probabilité continue, monotone et bornée dans (0, 1).
 */
function interpolateLogit(
  x: number,
  x0: number,
  x1: number,
  p0: number,
  p1: number,
): number {
  if (x1 === x0) return logit(p0)
  const t = (x - x0) / (x1 - x0)
  return logit(p0) + t * (logit(p1) - logit(p0))
}

/**
 * RF-CL continu : interpolation bilinéaire sur l'échelle logit en âge × FdR,
 * avec sélection de la table selon sexe × symptôme.
 *
 * @returns probabilité ∈ [0, 1]
 */
export function continuousRFCL(input: PatientInput): number {
  const age = clamp(input.age, 30, 90)
  const rf = clamp(input.rfCount, 0, 5)

  // Trouver les ancres d'âge bordant `age`
  let ageLow: AgeKey = "30-39"
  let ageHigh: AgeKey = "30-39"
  for (let i = 0; i < AGE_KEYS.length - 1; i++) {
    if (age >= AGE_CENTERS[AGE_KEYS[i]] && age <= AGE_CENTERS[AGE_KEYS[i + 1]]) {
      ageLow = AGE_KEYS[i]
      ageHigh = AGE_KEYS[i + 1]
      break
    }
  }
  if (age < AGE_CENTERS["30-39"]) {
    ageLow = "30-39"
    ageHigh = "30-39"
  } else if (age > AGE_CENTERS["70+"]) {
    ageLow = "70+"
    ageHigh = "70+"
  }

  // Trouver les ancres de FdR bordant `rf`
  let rfLow: RFKey = "0-1"
  let rfHigh: RFKey = "0-1"
  for (let i = 0; i < RF_KEYS.length - 1; i++) {
    if (rf >= RF_CENTERS[RF_KEYS[i]] && rf <= RF_CENTERS[RF_KEYS[i + 1]]) {
      rfLow = RF_KEYS[i]
      rfHigh = RF_KEYS[i + 1]
      break
    }
  }
  if (rf < RF_CENTERS["0-1"]) {
    rfLow = "0-1"
    rfHigh = "0-1"
  } else if (rf > RF_CENTERS["4-5"]) {
    rfLow = "4-5"
    rfHigh = "4-5"
  }

  const T = WINTHER_TABLE[input.sex]

  const p_ll = T[ageLow][rfLow][input.symptom] / 100
  const p_lh = T[ageLow][rfHigh][input.symptom] / 100
  const p_hl = T[ageHigh][rfLow][input.symptom] / 100
  const p_hh = T[ageHigh][rfHigh][input.symptom] / 100

  // Interpolation 1 : selon FdR à âge bas
  const logitLow = interpolateLogit(rf, RF_CENTERS[rfLow], RF_CENTERS[rfHigh], p_ll, p_lh)
  // Interpolation 2 : selon FdR à âge haut
  const logitHigh = interpolateLogit(rf, RF_CENTERS[rfLow], RF_CENTERS[rfHigh], p_hl, p_hh)

  // Interpolation finale : selon âge
  const ageL = AGE_CENTERS[ageLow]
  const ageH = AGE_CENTERS[ageHigh]
  let finalLogit: number
  if (ageH === ageL) {
    finalLogit = logitLow
  } else {
    const t = (age - ageL) / (ageH - ageL)
    finalLogit = logitLow + t * (logitHigh - logitLow)
  }

  return sigmoid(finalLogit)
}

// ── 2. Application des facteurs d'enrichissement ───────────────────────────

export interface EnrichmentContribution {
  label: string
  /** Variation absolue de probabilité (en points de %). */
  deltaPct: number
  /** Coefficient log-odds appliqué. */
  beta: number
}

export interface AdjustedProbabilityResult {
  /** Probabilité finale (0–100 %). */
  probability: number
  /** Borne basse IC95 (0–100 %). */
  ciLow: number
  /** Borne haute IC95 (0–100 %). */
  ciHigh: number
  /** Probabilité brute RF-CL avant tout ajustement (0–100 %). */
  baseRFCL: number
  /** Probabilité après application du CACS-CL si CACS connu (0–100 %). */
  postCACS: number
  /** Décomposition étape par étape des contributions. */
  contributions: EnrichmentContribution[]
  /** Logit final (utile pour la mise à jour bayésienne séquentielle). */
  finalLogit: number
  /** SE totale sur l'échelle logit (utile pour mise à jour des IC). */
  seLogit: number
}

/**
 * Calcule la probabilité ajustée intégrant RF-CL continu, CACS-CL et
 * facteurs d'enrichissement, avec décomposition et IC95.
 */
export function computeAdjustedProbability(
  input: PatientInput,
  enrichment: EnrichmentFactors = DEFAULT_ENRICHMENT,
): AdjustedProbabilityResult {
  const contributions: EnrichmentContribution[] = []

  // 1. RF-CL continu
  const baseProb = continuousRFCL(input)
  const baseRFCL = baseProb * 100

  // 2. CACS-CL (remplace la base si CACS connu)
  let probAfterCACS = baseProb
  if (enrichment.cacs !== null) {
    const cacsProb = computeCACSCLFromBin(baseRFCL, enrichment.cacs) / 100
    contributions.push({
      label: `CACS ${cacsBinLabel(enrichment.cacs)}`,
      deltaPct: (cacsProb - baseProb) * 100,
      beta: logit(cacsProb) - logit(baseProb),
    })
    probAfterCACS = cacsProb
  }
  const postCACS = probAfterCACS * 100

  // 3. Facteurs d'enrichissement (additifs sur le logit)
  let currentLogit = logit(probAfterCACS)
  let seLogit = MODEL_SE_LOGIT
  let activeEnrichment = 0

  if (enrichment.atcdCoronaire) {
    const beta = ENRICHMENT_COEFS.atcdCoronaire
    const probBefore = sigmoid(currentLogit)
    currentLogit += beta
    const probAfter = sigmoid(currentLogit)
    contributions.push({
      label: "ATCD coronaropathie",
      deltaPct: (probAfter - probBefore) * 100,
      beta,
    })
    activeEnrichment++
  }
  if (enrichment.ecgIschemique) {
    const beta = ENRICHMENT_COEFS.ecgIschemique
    const probBefore = sigmoid(currentLogit)
    currentLogit += beta
    const probAfter = sigmoid(currentLogit)
    contributions.push({
      label: "ECG ischémique",
      deltaPct: (probAfter - probBefore) * 100,
      beta,
    })
    activeEnrichment++
  }
  if (enrichment.dvgFEVG) {
    const beta = ENRICHMENT_COEFS.dvgFEVG
    const probBefore = sigmoid(currentLogit)
    currentLogit += beta
    const probAfter = sigmoid(currentLogit)
    contributions.push({
      label: "Dysfonction VG (FEVG < 50 %)",
      deltaPct: (probAfter - probBefore) * 100,
      beta,
    })
    activeEnrichment++
  }

  // SE totale (variance additive sur logit) — chaque facteur ajoute de
  // l'incertitude proportionnelle à son poids.
  if (activeEnrichment > 0) {
    seLogit = Math.sqrt(MODEL_SE_LOGIT ** 2 + activeEnrichment * ENRICHMENT_SE_LOGIT ** 2)
  }

  // Bornes physiologiques
  const finalLogit = clamp(currentLogit, logit(0.005), logit(0.97))
  const probability = sigmoid(finalLogit) * 100

  // IC95 sur logit puis transformation
  const ciLowLogit = finalLogit - 1.96 * seLogit
  const ciHighLogit = finalLogit + 1.96 * seLogit
  const ciLow = sigmoid(ciLowLogit) * 100
  const ciHigh = sigmoid(ciHighLogit) * 100

  return {
    probability,
    ciLow,
    ciHigh,
    baseRFCL,
    postCACS,
    contributions,
    finalLogit,
    seLogit,
  }
}

function cacsBinLabel(bin: CACSBin): string {
  switch (bin) {
    case "0":
      return "= 0"
    case "1-9":
      return "1–9"
    case "10-99":
      return "10–99"
    case "100-399":
      return "100–399"
    case "400-999":
      return "400–999"
    case ">=1000":
      return "≥ 1000"
  }
}

// ── 3. Likelihood Ratios — méta-analyse Knuuti 2018 ────────────────────────

export type TestKey =
  | "ccta"
  | "ffr-ct"
  | "spect"
  | "stress-echo"
  | "stress-cmr"
  | "pet"
  | "stress-ecg"

export interface TestPerformance {
  key: TestKey
  label: string
  shortLabel: string
  /** Sensibilité (proportion). */
  sensitivity: number
  /** Spécificité (proportion). */
  specificity: number
  /** LR+ (rule-in). */
  lrPositive: number
  /** LR- (rule-out). */
  lrNegative: number
  /** IC95 du LR+ (utilisé pour propager l'incertitude). */
  lrPositiveCI: [number, number]
  lrNegativeCI: [number, number]
  /** Notes sur la place dans la stratégie ESC 2024. */
  note: string
}

/**
 * Performances diagnostiques issues de la méta-analyse Knuuti 2018
 * (« The performance of non-invasive tests to rule-in and rule-out
 * significant coronary artery disease in patients with stable angina »,
 * Eur Heart J 2018;39:3322-3330) — référence ESC CCS 2024.
 *
 * Les LR+ et LR- sont reportés tels que publiés ; les IC95 sont ceux
 * fournis dans le supplément du papier (utilisés ici pour estimer la
 * SE de log(LR) et propager l'incertitude jusqu'à l'IC final).
 */
export const TEST_PERFORMANCE: Record<TestKey, TestPerformance> = {
  ccta: {
    key: "ccta",
    label: "Coroscanner (CCTA)",
    shortLabel: "CCTA",
    sensitivity: 0.97,
    specificity: 0.78,
    lrPositive: 4.4,
    lrNegative: 0.04,
    lrPositiveCI: [3.7, 5.2],
    lrNegativeCI: [0.02, 0.08],
    note: "Excellente valeur d'exclusion (LR- = 0.04). Premier choix ESC 2024 si probabilité 5–50 %.",
  },
  "ffr-ct": {
    key: "ffr-ct",
    label: "FFR-CT (CCTA + analyse fonctionnelle)",
    shortLabel: "FFR-CT",
    sensitivity: 0.9,
    specificity: 0.83,
    lrPositive: 5.3,
    lrNegative: 0.12,
    lrPositiveCI: [4.0, 7.0],
    lrNegativeCI: [0.07, 0.21],
    note: "Évalue le retentissement fonctionnel des sténoses 40–90 % détectées au CCTA.",
  },
  spect: {
    key: "spect",
    label: "Scintigraphie myocardique (SPECT)",
    shortLabel: "SPECT",
    sensitivity: 0.87,
    specificity: 0.7,
    lrPositive: 2.9,
    lrNegative: 0.19,
    lrPositiveCI: [2.5, 3.4],
    lrNegativeCI: [0.13, 0.27],
    note: "Bon test fonctionnel, largement disponible. Sous-performe vs PET et IRM stress.",
  },
  "stress-echo": {
    key: "stress-echo",
    label: "Échographie de stress",
    shortLabel: "Écho stress",
    sensitivity: 0.85,
    specificity: 0.82,
    lrPositive: 4.7,
    lrNegative: 0.18,
    lrPositiveCI: [3.6, 6.2],
    lrNegativeCI: [0.13, 0.26],
    note: "Pas d'irradiation ; opérateur-dépendant ; difficile si obésité ou BPCO.",
  },
  "stress-cmr": {
    key: "stress-cmr",
    label: "IRM cardiaque de stress",
    shortLabel: "IRM stress",
    sensitivity: 0.9,
    specificity: 0.84,
    lrPositive: 5.6,
    lrNegative: 0.12,
    lrPositiveCI: [4.4, 7.1],
    lrNegativeCI: [0.08, 0.18],
    note: "Excellente performance ; recommandé si IRC sévère ou allergie iode.",
  },
  pet: {
    key: "pet",
    label: "PET myocardique de stress",
    shortLabel: "PET",
    sensitivity: 0.9,
    specificity: 0.85,
    lrPositive: 6.0,
    lrNegative: 0.12,
    lrPositiveCI: [4.6, 7.8],
    lrNegativeCI: [0.07, 0.2],
    note: "Meilleure performance des tests fonctionnels ; disponibilité limitée.",
  },
  "stress-ecg": {
    key: "stress-ecg",
    label: "ECG d'effort",
    shortLabel: "ECG effort",
    sensitivity: 0.58,
    specificity: 0.62,
    lrPositive: 1.5,
    lrNegative: 0.68,
    lrPositiveCI: [1.3, 1.7],
    lrNegativeCI: [0.6, 0.77],
    note: "Discriminance médiocre ; déclassé en 1ère intention par l'ESC 2024.",
  },
}

// ── 4. Mise à jour bayésienne séquentielle ─────────────────────────────────

export type TestOutcome = "positive" | "negative" | "inconclusive"

export interface TestEvent {
  test: TestKey
  outcome: TestOutcome
}

export interface SequentialStep {
  /** Numéro de l'étape (0 = pré-test). */
  index: number
  label: string
  /** Probabilité après cette étape (0–100 %). */
  probability: number
  ciLow: number
  ciHigh: number
  /** Variation par rapport à l'étape précédente, en points de %. */
  delta: number
  /** Logit utilisé en interne (pour debug / propagation). */
  logit: number
  seLogit: number
}

/** SE de log(LR) déduite de l'IC95 publié par Knuuti 2018. */
function logLRSE(ci: [number, number]): number {
  const [lo, hi] = ci
  if (lo <= 0 || hi <= 0) return 0.2
  return (Math.log(hi) - Math.log(lo)) / (2 * 1.96)
}

/**
 * Applique séquentiellement une liste de tests à la probabilité ajustée
 * pré-test et retourne la trajectoire complète.
 *
 * - Test positif → odds × LR+
 * - Test négatif → odds × LR-
 * - Test inconclusif → pas de mise à jour (mais on enregistre l'événement
 *   pour la règle de décision sur les tests inconclusifs)
 *
 * L'incertitude (variance) sur le logit est cumulée additivement à chaque
 * mise à jour valide, ce qui élargit l'IC à mesure qu'on enchaîne les tests.
 */
export function runSequentialUpdate(
  preTest: AdjustedProbabilityResult,
  events: TestEvent[],
): SequentialStep[] {
  const trail: SequentialStep[] = []

  // Étape 0 : pré-test
  trail.push({
    index: 0,
    label: "Probabilité ajustée pré-test",
    probability: preTest.probability,
    ciLow: preTest.ciLow,
    ciHigh: preTest.ciHigh,
    delta: 0,
    logit: preTest.finalLogit,
    seLogit: preTest.seLogit,
  })

  let currentLogit = preTest.finalLogit
  let varLogit = preTest.seLogit ** 2

  events.forEach((ev, i) => {
    const perf = TEST_PERFORMANCE[ev.test]
    const prevProb = sigmoid(currentLogit) * 100

    let logLR = 0
    let logLRSEval = 0
    let label = `${perf.shortLabel} — `

    if (ev.outcome === "positive") {
      logLR = Math.log(perf.lrPositive)
      logLRSEval = logLRSE(perf.lrPositiveCI)
      label += "positif"
    } else if (ev.outcome === "negative") {
      logLR = Math.log(perf.lrNegative)
      logLRSEval = logLRSE(perf.lrNegativeCI)
      label += "négatif"
    } else {
      label += "inconclusif (pas de MàJ)"
    }

    if (ev.outcome !== "inconclusive") {
      currentLogit += logLR
      // Variance additive sur le logit : modèle indépendant des tests
      varLogit += logLRSEval ** 2
    }

    // Bornes physiologiques
    currentLogit = clamp(currentLogit, logit(0.001), logit(0.99))
    const seLogit = Math.sqrt(varLogit)

    const newProb = sigmoid(currentLogit) * 100
    const ciLow = sigmoid(currentLogit - 1.96 * seLogit) * 100
    const ciHigh = sigmoid(currentLogit + 1.96 * seLogit) * 100

    trail.push({
      index: i + 1,
      label,
      probability: newProb,
      ciLow,
      ciHigh,
      delta: newProb - prevProb,
      logit: currentLogit,
      seLogit,
    })
  })

  return trail
}

// ── 5. Architecture ESC 2024 en 3 couches ──────────────────────────────────
//
// La chaîne bayésienne ALIMENTE les 4 voies d'indication ICA — elle ne les
// remplace pas. La séquence correcte est :
//
//   Couche 1 — RF-CL ajusté → orientation (CCTA / fonctionnel / CACS / aucun)
//   Couche 2 — Résultat du test → deux questions distinctes :
//      a) probabilité post-test > 85 % ?    (Voie 1, probabiliste)
//      b) critère qualitatif de haut risque ? (Voies 2 & 3, anatomique
//         ou fonctionnel — indépendamment de la probabilité calculée)
//   Couche 3 — Clinique → angor réfractaire / SCA (Voie 4, indépendante
//      de toute probabilité)
//
// Les Voies 2, 3 et 4 sont des CRITÈRES QUALITATIFS définis dans les
// Tableaux 11 et 14 des ESC CCS 2024 — leur déclenchement n'exige PAS
// que la probabilité bayésienne franchisse un seuil.
//
// Une voie suffit : les 4 voies sont indépendantes et non hiérarchiques.

// ─── Critères qualitatifs détaillés (ESC 2024 Tableaux 11 & 14) ───────────

/** Voie 2 — critères anatomiques de haut risque (CCTA / FFR-CT). */
export interface AnatomicHighRiskCriteria {
  /** Sténose du tronc commun ≥ 50 %. */
  leftMain50: boolean
  /** Sténose IVA proximale ≥ 70 %. */
  proxLAD70: boolean
  /** Atteinte tritronculaire (≥ 70 % sur 3 axes). */
  threeVessel70: boolean
  /** Tritronculaire + FFR-CT ≤ 0.80 sur ≥ 1 axe. */
  threeVesselFFRct: boolean
  /** FEVG < 35 % d'origine ischémique sur CCTA / imagerie associée. */
  lvDysfunctionIschemic: boolean
}

export const DEFAULT_ANATOMIC_HR: AnatomicHighRiskCriteria = {
  leftMain50: false,
  proxLAD70: false,
  threeVessel70: false,
  threeVesselFFRct: false,
  lvDysfunctionIschemic: false,
}

/** Voie 3 — critères fonctionnels de haut risque (PET/SPECT/IRM/écho stress). */
export interface FunctionalHighRiskCriteria {
  /** Ischémie ≥ 10 % du myocarde VG (PET / SPECT / IRM stress). */
  ischemia10pctLV: boolean
  /** ≥ 3 segments hypokinétiques sur 16 à l'écho de stress. */
  dse3segments: boolean
  /** ≥ 2 segments avec hypoperfusion / défaut à l'IRM stress. */
  cmr2segments: boolean
  /** Défaut de perfusion réversible > 10 % VG (PET / SPECT). */
  largePerfusionDefect: boolean
}

export const DEFAULT_FUNCTIONAL_HR: FunctionalHighRiskCriteria = {
  ischemia10pctLV: false,
  dse3segments: false,
  cmr2segments: false,
  largePerfusionDefect: false,
}

/** Voie 4 — critères cliniques (indépendants de toute probabilité). */
export interface ClinicalHighRiskCriteria {
  /** Angor réfractaire malgré traitement médical optimal (TMO double). */
  refractoryAngina: boolean
  /** SCA suspecté / instabilité — orientation urgences. */
  acuteFeatures: boolean
}

export const DEFAULT_CLINICAL_HR: ClinicalHighRiskCriteria = {
  refractoryAngina: false,
  acuteFeatures: false,
}

// ─── Couche 1 — orientation depuis RF-CL ajusté ───────────────────────────

export type Layer1Decision =
  | "urgence"
  | "ica-clinique-direct"
  | "rassurance"
  | "cacs"
  | "ccta-1ere-intention"
  | "ccta-ou-fonctionnel"
  | "fonctionnel-1ere-intention"
  | "ica-tres-haute-prob"

export interface Layer1Result {
  decision: Layer1Decision
  /** Étiquette FR. */
  label: string
  /** Couleur hex de la zone de probabilité. */
  color: string
  /** Zone de probabilité atteinte. */
  zone: "tres-faible" | "faible" | "modere-bas" | "modere" | "eleve" | "tres-eleve"
  /** Justification synthétique. */
  rationale: string
  /** Test recommandé en 1ère intention (null si pas de test). */
  recommendedTest: "ccta" | "fonctionnel" | "ccta-ou-fonctionnel" | "cacs" | null
}

/**
 * Couche 1 — détermine si un test est indiqué et lequel, à partir du
 * RF-CL ajusté (probabilité bayésienne pré-test).
 *
 * Cette couche n'évalue PAS l'indication ICA — elle décide uniquement
 * de l'orientation initiale. La voie clinique (Voie 4) court-circuite
 * tout : SCA → urgence ; angor réfractaire au TMO → ICA directe.
 *
 * Seuils ESC 2024 :
 *   · ≤ 5 %      → maladie obstructive très peu probable (rassurance)
 *   · 5–15 %     → CACS de reclassification
 *   · 15–50 %    → CCTA en 1ère intention (excellent rule-out)
 *   · 50–85 %    → fonctionnel privilégié (quantification de l'ischémie)
 *   · > 85 %     → la probabilité bayésienne pré-test elle-même franchit
 *                  déjà la Voie 1 — ICA directe sans test (rare hors haut
 *                  risque clinique préalable).
 */
export function recommendLayer1(
  adjustedProb: number,
  clinical: ClinicalHighRiskCriteria = DEFAULT_CLINICAL_HR,
): Layer1Result {
  // Court-circuit clinique
  if (clinical.acuteFeatures) {
    return {
      decision: "urgence",
      label: "Urgence — appel SAMU 15",
      color: "#991b1b",
      zone: "tres-eleve",
      rationale:
        "Suspicion de SCA / instabilité. La probabilité bayésienne n'est pas appliquée — orientation immédiate vers une filière SCA.",
      recommendedTest: null,
    }
  }
  if (clinical.refractoryAngina) {
    return {
      decision: "ica-clinique-direct",
      label: "Coronarographie directe (Voie 4 — angor réfractaire)",
      color: "#b91c1c",
      zone: "tres-eleve",
      rationale:
        "Angor réfractaire malgré TMO double : Voie 4 ESC 2024 — indication de coro indépendante de toute probabilité bayésienne.",
      recommendedTest: null,
    }
  }

  // Couche 1 standard
  if (adjustedProb > 85) {
    return {
      decision: "ica-tres-haute-prob",
      label: "Coronarographie d'emblée envisageable",
      color: "#dc2626",
      zone: "tres-eleve",
      rationale:
        "Probabilité bayésienne pré-test > 85 % : la Voie 1 probabiliste est déjà franchie sans test. Discuter une coro directe (rare en l'absence d'enrichissement majeur).",
      recommendedTest: null,
    }
  }
  if (adjustedProb > 50) {
    return {
      decision: "fonctionnel-1ere-intention",
      label: "Imagerie fonctionnelle en 1re intention",
      color: "#f97316",
      zone: "eleve",
      rationale:
        "Probabilité ajustée 50–85 % : test fonctionnel (PET / IRM stress / SPECT / écho stress) privilégié pour quantifier l'ischémie et orienter la revascularisation.",
      recommendedTest: "fonctionnel",
    }
  }
  if (adjustedProb >= 15) {
    return {
      decision: "ccta-ou-fonctionnel",
      label: "CCTA ou imagerie fonctionnelle selon disponibilité",
      color: "#d97706",
      zone: "modere",
      rationale:
        "Probabilité ajustée 15–50 % : zone de choix optimal pour le CCTA (excellent rule-out, LR− = 0.04). Imagerie fonctionnelle acceptable selon disponibilité locale.",
      recommendedTest: "ccta-ou-fonctionnel",
    }
  }
  if (adjustedProb >= 5) {
    return {
      decision: "ccta-1ere-intention",
      label: "CCTA en 1re intention",
      color: "#16a34a",
      zone: "modere-bas",
      rationale:
        "Probabilité ajustée 5–15 % : CCTA recommandé pour rule-out (Classe I ESC 2024). Le CACS reste une alternative si très bas symptômes.",
      recommendedTest: "ccta",
    }
  }
  return {
    decision: "rassurance",
    label: "Pas d'exploration coronarienne",
    color: "#15803d",
    zone: "tres-faible",
    rationale:
      "Probabilité ajustée < 5 % : maladie obstructive très peu probable. Rechercher un diagnostic alternatif (musculo-squelettique, digestif, anxiété, pleuro-pulmonaire).",
    recommendedTest: null,
  }
}

// ─── Couches 2 & 3 — évaluation indépendante des 4 voies ──────────────────

export interface PathwayStatus {
  met: boolean
  /** Critères individuels remplis (étiquettes courtes pour affichage). */
  triggers: string[]
}

export interface FourPathwaysEvaluation {
  /** Voie 1 — probabiliste : probabilité post-test (bayésienne) > 85 %. */
  pathway1: PathwayStatus & {
    postTestProb: number
    ciLow: number
    ciHigh: number
    /** Borne basse de l'IC95 confirme-t-elle le seuil (> 70 %) ? */
    ciConfirmed: boolean
  }
  /** Voie 2 — anatomique haut risque (CCTA / FFR-CT). */
  pathway2: PathwayStatus
  /** Voie 3 — fonctionnel haut risque (imagerie de stress). */
  pathway3: PathwayStatus
  /** Voie 4 — clinique (angor réfractaire). SCA = court-circuit en amont. */
  pathway4: PathwayStatus
  /** Au moins une voie est satisfaite ? */
  anyMet: boolean
  /** Numéros des voies satisfaites (pour affichage). */
  metPathways: (1 | 2 | 3 | 4)[]
}

/**
 * Couches 2 et 3 — évalue indépendamment les 4 voies ESC 2024 d'indication
 * de coronarographie. Une voie suffit ; aucune n'est hiérarchiquement
 * dominante.
 *
 * Voie 1 : la probabilité post-test (après mise à jour bayésienne par les
 * tests effectués) franchit 85 %. C'est la SEULE voie qui dépend de la
 * chaîne bayésienne.
 *
 * Voie 2 : critère anatomique de haut risque sur le CCTA/FFR-CT
 * (Tableau 11 ESC 2024). Indépendant de la probabilité calculée — un CCTA
 * montrant un TC ≥ 50 % suffit même si la probabilité post-test est faible.
 *
 * Voie 3 : critère fonctionnel de haut risque sur l'imagerie de stress
 * (Tableau 14 ESC 2024). Idem — l'ampleur de l'ischémie suffit, la
 * probabilité post-test n'est pas requise.
 *
 * Voie 4 : angor réfractaire au TMO double. Indication purement clinique.
 */
export function evaluateFourPathways(
  postTestProb: number,
  ciLow: number,
  ciHigh: number,
  anatomic: AnatomicHighRiskCriteria,
  functional: FunctionalHighRiskCriteria,
  clinical: ClinicalHighRiskCriteria,
): FourPathwaysEvaluation {
  // Voie 1
  const pathway1Met = postTestProb > 85
  const pathway1: FourPathwaysEvaluation["pathway1"] = {
    met: pathway1Met,
    triggers: pathway1Met ? [`Probabilité post-test ${postTestProb.toFixed(1)} %`] : [],
    postTestProb,
    ciLow,
    ciHigh,
    ciConfirmed: pathway1Met && ciLow > 70,
  }

  // Voie 2
  const v2Triggers: string[] = []
  if (anatomic.leftMain50) v2Triggers.push("TC ≥ 50 %")
  if (anatomic.proxLAD70) v2Triggers.push("IVA prox. ≥ 70 %")
  if (anatomic.threeVessel70) v2Triggers.push("Tritronculaire ≥ 70 %")
  if (anatomic.threeVesselFFRct) v2Triggers.push("Tritronc + FFR-CT ≤ 0.80")
  if (anatomic.lvDysfunctionIschemic) v2Triggers.push("FEVG < 35 % ischémique")

  // Voie 3
  const v3Triggers: string[] = []
  if (functional.ischemia10pctLV) v3Triggers.push("Ischémie ≥ 10 % VG")
  if (functional.largePerfusionDefect) v3Triggers.push("Défaut perfusion > 10 % VG")
  if (functional.dse3segments) v3Triggers.push("≥ 3/16 segments DSE")
  if (functional.cmr2segments) v3Triggers.push("≥ 2 segments IRM stress")

  // Voie 4
  const v4Triggers: string[] = []
  if (clinical.refractoryAngina) v4Triggers.push("Angor réfractaire au TMO")
  if (clinical.acuteFeatures) v4Triggers.push("SCA / instabilité")

  const pathway2: PathwayStatus = { met: v2Triggers.length > 0, triggers: v2Triggers }
  const pathway3: PathwayStatus = { met: v3Triggers.length > 0, triggers: v3Triggers }
  const pathway4: PathwayStatus = { met: v4Triggers.length > 0, triggers: v4Triggers }

  const metPathways: (1 | 2 | 3 | 4)[] = []
  if (pathway1.met) metPathways.push(1)
  if (pathway2.met) metPathways.push(2)
  if (pathway3.met) metPathways.push(3)
  if (pathway4.met) metPathways.push(4)

  return {
    pathway1,
    pathway2,
    pathway3,
    pathway4,
    anyMet: metPathways.length > 0,
    metPathways,
  }
}

// ─── Décision ICA finale (synthèse des 4 voies) ───────────────────────────

export interface ICADecisionResult {
  /** Indication ICA atteinte ? */
  icaIndicated: boolean
  /** Niveau de gravité agrégé pour la couleur d'affichage. */
  severity: "urgence" | "haute" | "moderee" | "basse"
  /** Étiquette FR. */
  label: string
  color: string
  rationale: string
  /** Voies satisfaites avec leurs déclencheurs. */
  metDetails: { pathway: 1 | 2 | 3 | 4; pathwayLabel: string; triggers: string[] }[]
  /** Niveau de confiance (1–5) basé sur la largeur de l'IC95 — Voie 1 uniquement. */
  confidence: 1 | 2 | 3 | 4 | 5
}

const PATHWAY_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: "Voie 1 — probabilité post-test > 85 %",
  2: "Voie 2 — haut risque anatomique (CCTA / FFR-CT)",
  3: "Voie 3 — haut risque fonctionnel (imagerie stress)",
  4: "Voie 4 — critère clinique direct",
}

/**
 * Synthèse finale de la décision ICA à partir de l'évaluation des 4 voies.
 * Une voie suffit. Si aucune n'est satisfaite, l'ICA n'est pas indiquée
 * (le bilan reste ouvert : tests complémentaires possibles, ou rassurance).
 */
export function synthesizeICADecision(
  evaluation: FourPathwaysEvaluation,
): ICADecisionResult {
  const ciWidth = evaluation.pathway1.ciHigh - evaluation.pathway1.ciLow
  let confidence: ICADecisionResult["confidence"] = 3
  if (ciWidth < 10) confidence = 5
  else if (ciWidth < 20) confidence = 4
  else if (ciWidth < 30) confidence = 3
  else if (ciWidth < 45) confidence = 2
  else confidence = 1

  const metDetails: ICADecisionResult["metDetails"] = evaluation.metPathways.map((p) => ({
    pathway: p,
    pathwayLabel: PATHWAY_LABELS[p],
    triggers:
      p === 1
        ? evaluation.pathway1.triggers
        : p === 2
        ? evaluation.pathway2.triggers
        : p === 3
        ? evaluation.pathway3.triggers
        : evaluation.pathway4.triggers,
  }))

  // SCA → urgence prioritaire
  if (evaluation.pathway4.triggers.includes("SCA / instabilité")) {
    return {
      icaIndicated: true,
      severity: "urgence",
      label: "Urgence — filière SCA",
      color: "#991b1b",
      rationale:
        "Critères d'instabilité aiguë. Hospitalisation immédiate, pas de bilan ambulatoire.",
      metDetails,
      confidence,
    }
  }

  if (!evaluation.anyMet) {
    return {
      icaIndicated: false,
      severity: "basse",
      label: "Coro non indiquée — aucune voie satisfaite",
      color: "#475569",
      rationale:
        "Aucune des 4 voies ESC 2024 n'est franchie. Selon le contexte : compléter le bilan non invasif, traiter médicalement, ou rassurer.",
      metDetails,
      confidence,
    }
  }

  // Au moins une voie satisfaite
  const onlyV1 = evaluation.metPathways.length === 1 && evaluation.pathway1.met
  const hasAnatomic = evaluation.pathway2.met
  const hasFunctional = evaluation.pathway3.met
  const hasClinicalRefr = evaluation.pathway4.triggers.includes("Angor réfractaire au TMO")

  let label = "Coronarographie indiquée"
  let rationale = ""
  if (onlyV1) {
    label = evaluation.pathway1.ciConfirmed
      ? "Coronarographie indiquée (Voie 1 — IC95 confirmé)"
      : "Coronarographie indiquée (Voie 1 — IC95 large, confirmation possible)"
    rationale = evaluation.pathway1.ciConfirmed
      ? `Probabilité post-test ${evaluation.pathway1.postTestProb.toFixed(1)} % avec borne basse IC95 ${evaluation.pathway1.ciLow.toFixed(0)} % > 70 % : Voie 1 robustement franchie.`
      : `Probabilité post-test ${evaluation.pathway1.postTestProb.toFixed(1)} % mais IC95 large (borne basse ${evaluation.pathway1.ciLow.toFixed(0)} %) : confirmation par imagerie complémentaire envisageable avant la coro.`
  } else {
    const reasons: string[] = []
    if (hasClinicalRefr) reasons.push("angor réfractaire (Voie 4)")
    if (hasAnatomic) reasons.push("haut risque anatomique (Voie 2)")
    if (hasFunctional) reasons.push("haut risque fonctionnel (Voie 3)")
    if (evaluation.pathway1.met) reasons.push("probabilité post-test > 85 % (Voie 1)")
    rationale = `Critère(s) ESC 2024 atteint(s) : ${reasons.join(" · ")}. Bénéfice pronostique attendu de la revascularisation.`
  }

  return {
    icaIndicated: true,
    severity: "haute",
    label,
    color: "#b91c1c",
    rationale,
    metDetails,
    confidence,
  }
}

// ─── API legacy (DEPRECATED — conservée pour rétro-compatibilité) ─────────

export type Decision =
  | "rassurance"
  | "cacs"
  | "ccta"
  | "fonctionnel"
  | "ica-shared"
  | "ica-direct"
  | "urgence"

export interface DecisionResult {
  decision: Decision
  label: string
  color: string
  rationale: string
  confidence: 1 | 2 | 3 | 4 | 5
  flags: string[]
}

/** @deprecated Utiliser la nouvelle architecture en 3 couches (recommendLayer1, evaluateFourPathways, synthesizeICADecision). */
export interface HighRiskFeatures {
  extensiveIschemia: boolean
  highRiskAnatomy: boolean
  refractoryAngina: boolean
  acuteFeatures: boolean
  twoInconclusiveTests: boolean
}

/** @deprecated */
export const DEFAULT_HIGH_RISK: HighRiskFeatures = {
  extensiveIschemia: false,
  highRiskAnatomy: false,
  refractoryAngina: false,
  acuteFeatures: false,
  twoInconclusiveTests: false,
}

/** @deprecated Conservée pour le wizard legacy. La calculette bayésienne utilise désormais la nouvelle architecture. */
export function decideStrategy(
  probability: number,
  ciLow: number,
  ciHigh: number,
  highRisk: HighRiskFeatures = DEFAULT_HIGH_RISK,
): DecisionResult {
  const flags: string[] = []

  // Niveau de confiance basé sur la largeur de l'IC95
  const ciWidth = ciHigh - ciLow
  let confidence: DecisionResult["confidence"] = 3
  if (ciWidth < 10) confidence = 5
  else if (ciWidth < 20) confidence = 4
  else if (ciWidth < 30) confidence = 3
  else if (ciWidth < 45) confidence = 2
  else confidence = 1

  // 1. Urgence
  if (highRisk.acuteFeatures) {
    return {
      decision: "urgence",
      label: "Urgence — appel SAMU 15",
      color: "#991b1b",
      rationale:
        "Critères d'instabilité (douleur en cours, suspicion SCA). La probabilité pré-test n'est pas appliquée — orientation immédiate vers une filière SCA.",
      confidence,
      flags: ["Hospitalisation immédiate", "Pas de bilan ambulatoire"],
    }
  }

  // 2. Voie directe ICA (haut risque, indépendamment du seuil)
  if (highRisk.highRiskAnatomy || highRisk.extensiveIschemia || highRisk.refractoryAngina) {
    const reasons: string[] = []
    if (highRisk.highRiskAnatomy) reasons.push("anatomie à haut risque suspectée")
    if (highRisk.extensiveIschemia) reasons.push("ischémie étendue (> 10 % VG)")
    if (highRisk.refractoryAngina) reasons.push("angor réfractaire au TMO")
    flags.push("Bénéfice pronostique de la revascularisation supérieur au risque procédural")
    return {
      decision: "ica-direct",
      label: "Coronarographie directe (haut risque d'événements)",
      color: "#b91c1c",
      rationale: `Critère(s) : ${reasons.join(" · ")}. La voie directe vers la coronarographie est justifiée indépendamment du seuil de 85 % (ESC 2024 — décision pronostique).`,
      confidence,
      flags,
    }
  }

  // 3. Probabilité > 85 % avec IC robuste
  if (probability > 85) {
    if (ciLow > 70) {
      flags.push("Seuil ESC 2024 confirmé par l'IC95 (borne basse > 70 %)")
    } else {
      flags.push(
        `Seuil dépassé mais IC95 large (borne basse ${ciLow.toFixed(0)} %) — confirmation par imagerie possible avant ICA`,
      )
    }
    return {
      decision: "ica-direct",
      label: "Coronarographie directe (probabilité ajustée > 85 %)",
      color: "#dc2626",
      rationale:
        "Probabilité ajustée (incluant facteurs d'enrichissement, CACS et imageries préalables) supérieure à 85 % → coronarographie directe (Classe I, ESC 2024).",
      confidence,
      flags,
    }
  }

  // 4. Probabilité > 50 % + 2 tests inconclusifs → ICA acceptable
  if (probability > 50 && highRisk.twoInconclusiveTests) {
    flags.push("Décision partagée recommandée — discuter risques/bénéfices avec le patient")
    return {
      decision: "ica-shared",
      label: "Coronarographie acceptable — décision partagée",
      color: "#ea580c",
      rationale:
        "Probabilité ajustée > 50 % avec 2 tests non-invasifs inconclusifs ou discordants : la coronarographie est une option raisonnable en décision partagée, sans attendre le seuil mécanique de 85 %.",
      confidence,
      flags,
    }
  }

  // 5. Probabilité > 50 % → imagerie fonctionnelle
  if (probability > 50) {
    flags.push("Test fonctionnel privilégié — quantification de l'ischémie pour guider la revascularisation")
    return {
      decision: "fonctionnel",
      label: "Imagerie fonctionnelle (IRM stress / PET / SPECT)",
      color: "#f97316",
      rationale:
        "Probabilité ajustée 50–85 % : test fonctionnel en 1ère intention (Classe I, ESC 2024). Quantifier l'ischémie pour prédire le bénéfice d'une revascularisation.",
      confidence,
      flags,
    }
  }

  // 6. Probabilité 15–50 % → CCTA
  if (probability > 15) {
    flags.push("CCTA = excellent test d'exclusion (LR- = 0.04, Knuuti 2018)")
    return {
      decision: "ccta",
      label: "Coroscanner (CCTA) en 1ère intention",
      color: "#d97706",
      rationale:
        "Probabilité ajustée 15–50 % : CCTA en 1ère intention (Classe I, ESC 2024). Permet exclusion de CAD et stratification pronostique.",
      confidence,
      flags,
    }
  }

  // 7. Probabilité 5–15 % → CACS
  if (probability > 5) {
    flags.push("CACS = 0 → reclassification en très faible probabilité (excellente valeur pronostique)")
    return {
      decision: "cacs",
      label: "Score calcique (CACS) en 1ère intention",
      color: "#16a34a",
      rationale:
        "Probabilité ajustée 5–15 % : CACS recommandé pour reclassification (Classe I, ESC 2024). Si CACS = 0 → fermeture du bilan.",
      confidence,
      flags,
    }
  }

  // 8. Probabilité ≤ 5 % → rassurance
  flags.push("Rechercher un diagnostic alternatif (musculo-squelettique, digestif, anxiété, pleuro-pulmonaire)")
  return {
    decision: "rassurance",
    label: "Pas d'exploration coronarienne — rassurance",
    color: "#15803d",
    rationale:
      "Probabilité ajustée ≤ 5 % : maladie obstructive très peu probable. Pas de test complémentaire recommandé (Classe IIa, ESC 2024).",
    confidence,
    flags,
  }
}

// ── 6. Choix du prochain test — gain diagnostique attendu ─────────────────

export interface ExpectedGain {
  test: TestKey
  /** Probabilité courante (avant le test). */
  preTest: number
  /** Probabilité attendue si test positif. */
  postPositive: number
  /** Probabilité attendue si test négatif. */
  postNegative: number
  /** Variation absolue maximale attendue (en points de %). */
  maxDelta: number
  /** Gain d'information espéré, pondéré par la prévalence pré-test. */
  expectedDelta: number
  /** Recommandation : tester encore vaut-il la peine ? */
  worthTesting: boolean
}

/**
 * Calcule le gain diagnostique attendu d'un test additionnel à la probabilité
 * courante. Sert UNIQUEMENT à orienter le choix du prochain test non invasif
 * (le test le plus informatif déplace le plus la probabilité courante).
 *
 * Important : ce gain n'est PAS un seuil décisionnel de coronarographie.
 * La décision d'ICA suit les quatre voies ESC 2024 (probabilité ajustée
 * > 85 %, anatomie haut risque CCTA, ischémie haut risque imagerie de
 * stress, angor réfractaire au TMO double) — Knuuti 2018 fournit les LR
 * des tests non invasifs, pas de seuil de gain vs risque procédural.
 *
 * @param currentProb probabilité courante (0–100 %)
 * @param tests       tests à évaluer (par défaut : tous)
 * @param threshold   gain attendu minimal pour considérer le test informatif
 *                    en points de % (default = 5)
 */
export function expectedDiagnosticGain(
  currentProb: number,
  tests: TestKey[] = ["ccta", "stress-cmr", "pet", "spect", "stress-echo"],
  threshold = 5,
): ExpectedGain[] {
  const p = clamp(currentProb / 100, 0.001, 0.999)
  const preLogit = logit(p)

  return tests.map((key) => {
    const perf = TEST_PERFORMANCE[key]
    const postPos = sigmoid(preLogit + Math.log(perf.lrPositive)) * 100
    const postNeg = sigmoid(preLogit + Math.log(perf.lrNegative)) * 100

    // Espérance pondérée : E[|p_post - p_pre|]
    // P(test+) = sens × p + (1-spec) × (1-p)
    const pPos = perf.sensitivity * p + (1 - perf.specificity) * (1 - p)
    const pNeg = 1 - pPos
    const expectedDelta =
      pPos * Math.abs(postPos - currentProb) + pNeg * Math.abs(postNeg - currentProb)

    const maxDelta = Math.max(Math.abs(postPos - currentProb), Math.abs(postNeg - currentProb))

    return {
      test: key,
      preTest: currentProb,
      postPositive: postPos,
      postNegative: postNeg,
      maxDelta,
      expectedDelta,
      worthTesting: expectedDelta >= threshold,
    }
  })
}
