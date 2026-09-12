/**
 * ANOCA-Rescue — outil INDICATIF et NON VALIDÉ d'estimation du risque d'angor
 * par atteinte microvasculaire / vasospastique (ANOCA : Angina with
 * Non-Obstructive Coronary Arteries) chez un patient dont le CACS-CL est
 * TRÈS FAIBLE (probabilité de maladie coronaire épicardique obstructive
 * quasi nulle, mais symptômes persistants à expliquer).
 *
 * ⚠️ Ce n'est PAS un score validé par une cohorte de dérivation/validation
 * publiée. Il s'agit d'une construction pédagogique assemblant, sur le même
 * schéma méthodologique que le RF-CL/CACS-CL (score clinique → probabilité
 * prétest → décision), des seuils rapportés dans la littérature sur l'ANOCA
 * (WISE, COVADIS). Le testing non invasif intermédiaire (TTDE-CFR, PET,
 * IRM de perfusion) n'étant pas disponible localement, la décision indicative
 * est dérivée directement de la probabilité issue du score clinique. Une mise
 * en œuvre clinique réelle nécessiterait une cohorte de dérivation dédiée. À
 * utiliser uniquement comme aide à la réflexion, jamais comme seul fondement
 * d'une décision de coronarographie + étude de la microcirculation (test de
 * provocation coronaire invasif).
 */

export interface AnocaItem {
  key: string
  label: string
  points: number
}

/** Items du score, hors sexe (reporté automatiquement depuis l'étape RF-CL). */
export const ANOCA_ITEMS: AnocaItem[] = [
  { key: "ageMoins55", label: "Âge < 55 ans", points: 1 },
  { key: "douleurAtypiqueSansIrradiation", label: "Douleur atypique (gauche, cervicale, palpitations) sans irradiation mâchoire/bras", points: 1 },
  { key: "terrainVasomoteur", label: "Terrain vasomoteur (migraine, Raynaud)", points: 2 },
  { key: "tabagismeActif", label: "Tabagisme actif (marqueur de vasospasme, pas d'athérome ici)", points: 2 },
  { key: "hba1cPrediabete", label: "HbA1c prédiabète (5,7–6,4 %)", points: 1 },
  { key: "hdlBas", label: "HDL bas", points: 1 },
  { key: "crpElevee", label: "CRP élevée (> 3 mg/L)", points: 1 },
  { key: "anxieteFibromyalgie", label: "Anxiété ou terrain fibromyalgique documenté", points: 1 },
  { key: "absenceFrcvMalgreTypique", label: "Absence de FRCV classique malgré symptômes typiques d'effort", points: 2 },
]

export const ANOCA_SEX_FEMININ_POINTS = 2
export const ANOCA_MAX_SCORE = ANOCA_SEX_FEMININ_POINTS + ANOCA_ITEMS.reduce((s, i) => s + i.points, 0)

export interface AnocaCategory {
  key: "tres-faible" | "faible" | "intermediaire" | "elevee" | "tres-elevee"
  label: string
  range: string
  /** Point médian de la fourchette, utilisé comme probabilité indicative pour la décision. */
  priorPercent: number
  color: string
}

const ANOCA_CATEGORIES: AnocaCategory[] = [
  { key: "tres-faible", label: "Très faible", range: "< 10 %", priorPercent: 5, color: "#15803d" },
  { key: "faible", label: "Faible", range: "10–30 %", priorPercent: 20, color: "#16a34a" },
  { key: "intermediaire", label: "Intermédiaire", range: "30–60 %", priorPercent: 45, color: "#d97706" },
  { key: "elevee", label: "Élevée", range: "60–80 %", priorPercent: 70, color: "#dc2626" },
  { key: "tres-elevee", label: "Très élevée", range: "> 80 %", priorPercent: 85, color: "#991b1b" },
]

export function computeAnocaScore(sexFeminin: boolean, checked: Record<string, boolean>): number {
  const itemsPoints = ANOCA_ITEMS.reduce((s, i) => s + (checked[i.key] ? i.points : 0), 0)
  return (sexFeminin ? ANOCA_SEX_FEMININ_POINTS : 0) + itemsPoints
}

export function getAnocaCategory(score: number): AnocaCategory {
  if (score <= 2) return ANOCA_CATEGORIES[0]
  if (score <= 5) return ANOCA_CATEGORIES[1]
  if (score <= 8) return ANOCA_CATEGORIES[2]
  if (score <= 11) return ANOCA_CATEGORIES[3]
  return ANOCA_CATEGORIES[4]
}

export interface AnocaDecision {
  key: "pas-icft" | "icft-recommande" | "icft-direct"
  label: string
  rationale: string
  color: string
}

/**
 * Décision indicative dérivée directement de la probabilité issue du score
 * clinique ANOCA-Rescue (pas de testing non invasif intermédiaire disponible).
 */
export function getAnocaDecision(scoreProbability: number): AnocaDecision {
  if (scoreProbability < 15) {
    return {
      key: "pas-icft",
      label: "Pas de coro + étude de la microcirculation",
      rationale:
        "Réassurance, traitement empirique, réévaluation si persistance des symptômes. Rendement diagnostique attendu trop faible pour justifier le test invasif.",
      color: "#15803d",
    }
  }
  if (scoreProbability <= 70) {
    return {
      key: "icft-recommande",
      label: "Coro + étude de la microcirculation recommandée",
      rationale:
        "Correspond à l'indication Classe I ESC 2024 en cas de diagnostic incertain — le testing non invasif intermédiaire (TTDE-CFR, PET, IRM de perfusion) n'étant pas disponible localement.",
      color: "#d97706",
    }
  }
  return {
    key: "icft-direct",
    label: "Coro + étude de la microcirculation d'emblée",
    rationale:
      "Rendement diagnostique déjà élevé dès le score clinique — la coro + étude de la microcirculation endotype (spasme vs microvasculaire) ET guide le traitement.",
    color: "#dc2626",
  }
}
