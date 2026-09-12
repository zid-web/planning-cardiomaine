/**
 * Pathway recommendation engine — ESC 2024 CCS guidelines + ajustements pratiques.
 *
 * Génère une conduite à tenir personnalisée en fonction de :
 *  - la catégorie de probabilité (RF-CL ou CACS-CL ajusté)
 *  - la sous-catégorie pour la zone intermédiaire (15-30% bas / 30-50% haut)
 *  - l'âge du patient
 *  - la disponibilité du CCTA et de la coronarographie ambulatoire
 *  - les comorbidités modulant le choix de l'examen
 *
 * Références :
 *  - Vrints et al., ESC Guidelines for CCS 2024, Eur Heart J 2024;45:3415-3537
 *  - Winther et al., JACC 2020;76:2421-2432 (CACS-CL)
 */

import type { Step3Data } from "@/components/wizard/step3-rfcl"

// ── Types des modificateurs ──────────────────────────────────────────────────

export type Availability = "rapide" | "differe" | "non-dispo"
export type IRCLevel = "non" | "moderee" | "severe"

export interface ClinicalModifiers {
  /** Disponibilité du CCTA : rapide < 7j / différé > 7j / non disponible */
  ccta: Availability
  /** Disponibilité de la coronarographie ambulatoire */
  ica: Availability
  /** Insuffisance rénale : non / modérée (DFG 30-45) / sévère (DFG < 30) */
  irc: IRCLevel
  /** Fibrillation atriale ou arythmie */
  fa: boolean
  /** Obésité morbide IMC > 40 */
  obesite: boolean
  /** Fragilité ou âge > 80 ans */
  fragilite: boolean
  /** Allergie iode ou asthme sévère */
  allergieIode: boolean
  /** Calcifications massives connues (CACS ≥ 400) */
  calcifMassives: boolean
}

export const DEFAULT_MODIFIERS: ClinicalModifiers = {
  ccta: "rapide",
  ica: "differe",
  irc: "non",
  fa: false,
  obesite: false,
  fragilite: false,
  allergieIode: false,
  calcifMassives: false,
}

// ── Sous-catégorisation de la zone intermédiaire ────────────────────────────

export type IntermediateSubCategory = "bas" | "haut" | null

/**
 * Sous-segmentation de la zone intermédiaire en bas (15-30%) et haut (30-50%).
 * La zone haute justifie un examen rapide ; la zone basse autorise un délai.
 */
export function getIntermediateSubCategory(
  category: Step3Data["finalCategory"],
  pct: number,
): IntermediateSubCategory {
  if (category !== "intermediaire") return null
  return pct >= 30 ? "haut" : "bas"
}

// ── Pathway ──────────────────────────────────────────────────────────────────

export type ExamKey =
  | "ccta"
  | "cacs"
  | "irm-stress"
  | "scinti"
  | "echo-stress"
  | "ica"
  | "rassurance"

const EXAM_LABELS: Record<ExamKey, string> = {
  ccta: "Coroscanner (CCTA)",
  cacs: "Score calcique coronarien (CACS)",
  "irm-stress": "IRM cardiaque de stress",
  scinti: "Scintigraphie myocardique (SPECT/PET)",
  "echo-stress": "Échographie de stress",
  ica: "Coronarographie invasive ambulatoire (coro)",
  rassurance: "Pas d'examen complémentaire",
}

export function examLabel(key: ExamKey): string {
  return EXAM_LABELS[key]
}

export interface PathwayStep {
  rank: 1 | 2 | 3
  exam: ExamKey
  label: string
  delai: string
  rationale: string
  classe?: "I" | "IIa" | "IIb"
}

export interface PathwayFlag {
  type: "info" | "warning" | "danger"
  title: string
  message: string
}

export interface PathwayRecommendation {
  steps: PathwayStep[]
  flags: PathwayFlag[]
  contraindications: string[]
  rationaleSummary: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isElderlyOrFragile(
  ageRange: Step3Data["ageRange"],
  mods: ClinicalModifiers,
): boolean {
  return mods.fragilite || ageRange === "70+"
}

function isYoung(ageRange: Step3Data["ageRange"]): boolean {
  return (
    ageRange === "30-39" ||
    ageRange === "40-49" ||
    ageRange === "50-59"
  )
}

/**
 * Le CCTA est dégradé en cas de FA, calcifications massives ou obésité morbide.
 * Dans ces cas, on bascule vers un test fonctionnel d'emblée.
 */
function isCCTAUsable(mods: ClinicalModifiers): boolean {
  return !mods.fa && !mods.calcifMassives && !mods.obesite
}

/**
 * Le contraste iodé est contre-indiqué relativement en cas d'allergie iode
 * ou d'IRC sévère. Dans ces cas, l'IRM stress est privilégiée.
 */
function isIodineCI(mods: ClinicalModifiers): boolean {
  return mods.allergieIode || mods.irc === "severe"
}

/**
 * Choix du test fonctionnel optimal selon les comorbidités.
 * - IRM stress : si allergie iode, IRC sévère, obésité morbide
 * - Scintigraphie/PET : sinon
 */
function pickFonctionnel(mods: ClinicalModifiers): ExamKey {
  if (isIodineCI(mods) || mods.obesite) return "irm-stress"
  return "scinti"
}

function delaiFromAvail(avail: Availability, fast = "Sous 7 jours", slow = "Sous 2-4 semaines"): string {
  if (avail === "rapide") return fast
  if (avail === "differe") return slow
  return "Non disponible"
}

// ── Algorithme principal ────────────────────────────────────────────────────

/**
 * Génère le pathway recommandé selon ESC 2024 + ajustements pratiques.
 *
 * Principes :
 *  - Probabilité ≤ 15% : CACS de reclassification (Classe I)
 *  - Probabilité 15-30% (intermédiaire-bas) : CCTA différé acceptable
 *  - Probabilité 30-50% (intermédiaire-haut) : CCTA RAPIDE prioritaire
 *  - Probabilité 50-85% : test fonctionnel ou coro directe selon âge/comorb.
 *  - Si CCTA non disponible et probabilité ≥ 30% : coro ambulatoire (Classe IIa)
 *  - Si CCTA non interprétable (FA / calcif / obésité) : test fonctionnel d'emblée
 *  - Si contre-indication iode : IRM stress prioritaire
 *  - Sujet jeune (< 60) : préférer CCTA (faible irradiation, valeur pronostique)
 *  - Sujet âgé/fragile à forte probabilité : coro directe pertinente (Classe IIa)
 */
export function getPathwayRecommendation(
  category: Step3Data["finalCategory"],
  ageRange: Step3Data["ageRange"],
  pct: number,
  mods: ClinicalModifiers,
): PathwayRecommendation {
  const subCat = getIntermediateSubCategory(category, pct)
  const elderlyFragile = isElderlyOrFragile(ageRange, mods)
  const young = isYoung(ageRange)
  const cctaUsable = isCCTAUsable(mods)
  const iodineCI = isIodineCI(mods)
  const fonctionnel = pickFonctionnel(mods)

  const steps: PathwayStep[] = []
  const flags: PathwayFlag[] = []
  const contraindications: string[] = []

  // Contre-indications transversales
  if (mods.allergieIode) {
    contraindications.push(
      "Allergie iode → CCTA et coronarographie nécessitent prémédication ; privilégier IRM de stress",
    )
  }
  if (mods.irc === "severe") {
    contraindications.push(
      "IRC sévère (DFG < 30) → éviter le contraste iodé ; IRM stress sans gadolinium privilégiée",
    )
  } else if (mods.irc === "moderee") {
    contraindications.push(
      "IRC modérée (DFG 30-45) → hydratation pré-procédure et contraste iso-osmolaire si CCTA/coro",
    )
  }
  if (mods.fa) {
    contraindications.push(
      "FA / arythmie → CCTA souvent dégradé (artefacts) ; test fonctionnel ou coro préférés",
    )
  }
  if (mods.calcifMassives) {
    contraindications.push(
      "Calcifications massives (CACS ≥ 400) → CCTA limité par blooming artifact ; test fonctionnel préféré",
    )
  }
  if (mods.obesite) {
    contraindications.push(
      "Obésité morbide (IMC > 40) → CCTA et écho de stress souvent ininterprétables ; IRM stress préférée",
    )
  }

  // ── Catégorie : très faible (≤ 5%) ──────────────────────────────────────
  if (category === "tres-faible") {
    steps.push({
      rank: 1,
      exam: "rassurance",
      label: "Pas d'exploration coronarienne en 1ère intention",
      delai: "—",
      rationale:
        "Probabilité ≤ 5% : maladie obstructive très peu probable. Rechercher un diagnostic alternatif (musculo-squelettique, digestif, anxiété, pleuro-pulmonaire).",
      classe: "IIa",
    })
    return {
      steps,
      flags,
      contraindications,
      rationaleSummary:
        "Probabilité ≤ 5% → diagnostic alternatif prioritaire. CACS uniquement si doute persistant ou anxiété majeure.",
    }
  }

  // ── Catégorie : faible (5-15%) ──────────────────────────────────────────
  if (category === "faible") {
    steps.push({
      rank: 1,
      exam: "cacs",
      label: "Score calcique (CACS) en 1ère intention",
      delai: "Sous 4 semaines",
      rationale:
        "Reclassification : si CACS = 0 → fermeture du bilan. Si CACS > 0 → CCTA (CACS 1-99 IIa, ≥ 100 I) ou test fonctionnel.",
      classe: "I",
    })
    if (mods.ccta === "non-dispo") {
      flags.push({
        type: "warning",
        title: "Si CACS positif et CCTA non disponible",
        message:
          "Orienter vers test fonctionnel non-invasif (IRM stress en priorité si IRC/iode) ou consultation cardiologique.",
      })
    }
    return {
      steps,
      flags,
      contraindications,
      rationaleSummary:
        "Probabilité 5-15% → CACS de reclassification (Classe I ESC 2024). Pas d'urgence sauf récidive.",
    }
  }

  // ── Catégorie : intermédiaire ───────────────────────────────────────────
  if (category === "intermediaire") {
    if (subCat === "bas") {
      // 15-30% : CCTA différé acceptable
      if (!cctaUsable) {
        steps.push({
          rank: 1,
          exam: fonctionnel,
          label: examLabel(fonctionnel),
          delai: "Sous 2-4 semaines",
          rationale:
            "CCTA non interprétable (FA / calcifications / obésité) → test d'ischémie d'emblée (Classe I).",
          classe: "I",
        })
      } else if (mods.ccta !== "non-dispo") {
        steps.push({
          rank: 1,
          exam: "ccta",
          label:
            mods.ccta === "rapide"
              ? "Coroscanner (CCTA) — rapide ou différé"
              : "Coroscanner (CCTA) en différé",
          delai: delaiFromAvail(mods.ccta, "Sous 7 jours", "Sous 2-4 semaines"),
          rationale:
            "Probabilité 15-30% : CCTA premier choix (Classe I si CACS < 400). Délai différé acceptable car risque MACE faible.",
          classe: "I",
        })
        if (iodineCI) {
          steps.push({
            rank: 2,
            exam: "irm-stress",
            label: "IRM stress (alternative non-iodée)",
            delai: "Sous 2-4 semaines",
            rationale:
              "Si contre-indication au contraste iodé (IRC sévère, allergie) : IRM stress en alternative.",
            classe: "I",
          })
        }
      } else {
        // CCTA non disponible
        steps.push({
          rank: 1,
          exam: "cacs",
          label: "Score calcique en 1ère intention",
          delai: "Sous 7 jours",
          rationale:
            "CCTA non disponible : commencer par CACS pour stratification rapide en cabinet de ville.",
          classe: "I",
        })
        steps.push({
          rank: 2,
          exam: fonctionnel,
          label: `${examLabel(fonctionnel)} (si CACS > 0)`,
          delai: "Sous 4 semaines",
          rationale:
            "Si CACS > 0 : test fonctionnel non-invasif pour confirmer ischémie. Coro pas indiquée d'emblée à cette probabilité.",
          classe: "I",
        })
      }
      return {
        steps,
        flags,
        contraindications,
        rationaleSummary: `Probabilité ${pct}% (intermédiaire-bas) → CCTA en différé sauf contre-indication. Pas d'indication coro d'emblée.`,
      }
    }

    // intermédiaire-haut (30-50%) — la zone qui "tend vers le haut"
    flags.push({
      type: "warning",
      title: "Zone intermédiaire-haute (30-50%)",
      message:
        "Risque MACE significatif → délai d'examen à raccourcir. CCTA RAPIDE en 1er choix ; à défaut, coro ambulatoire (Classe IIa ESC 2024).",
    })

    if (!cctaUsable) {
      steps.push({
        rank: 1,
        exam: fonctionnel,
        label: examLabel(fonctionnel),
        delai: "Sous 7 jours",
        rationale:
          "CCTA non interprétable (FA / calcifications massives / obésité) → test d'ischémie d'emblée (Classe I).",
        classe: "I",
      })
      if (mods.ica !== "non-dispo") {
        steps.push({
          rank: 2,
          exam: "ica",
          label: "Coronarographie ambulatoire si test positif/non concluant",
          delai: delaiFromAvail(mods.ica, "Sous 7 jours", "Sous 2 semaines"),
          rationale: "Confirmation anatomique et revascularisation si nécessaire.",
          classe: "I",
        })
      }
    } else if (mods.ccta === "rapide") {
      steps.push({
        rank: 1,
        exam: "ccta",
        label: "Coroscanner (CCTA) RAPIDE",
        delai: "Sous 7 jours",
        rationale: young
          ? "Sujet jeune (< 60 ans), probabilité 30-50% : CCTA rapide prioritaire (Classe I) — exclusion CAD, visualisation des plaques, valeur pronostique, faible irradiation."
          : "Probabilité 30-50% : CCTA rapide (Classe I). Exclusion CAD + stratification du risque MACE.",
        classe: "I",
      })
      if (mods.ica !== "non-dispo") {
        steps.push({
          rank: 2,
          exam: "ica",
          label: "Coronarographie ambulatoire si CCTA positif (sténose ≥ 50%)",
          delai: delaiFromAvail(mods.ica),
          rationale:
            "Confirmation anatomique et revascularisation si lésion significative.",
          classe: "I",
        })
      }
    } else if (mods.ccta === "differe") {
      // CCTA disponible mais en différé
      if (elderlyFragile && mods.ica === "rapide") {
        steps.push({
          rank: 1,
          exam: "ica",
          label: "Coronarographie ambulatoire RAPIDE (1er choix)",
          delai: "Sous 7 jours",
          rationale:
            "Sujet âgé/fragile + probabilité 30-50% + CCTA différé → coro ambulatoire pertinente (Classe IIa ESC 2024). Diagnostic et revascularisation en un temps, évite la cascade d'examens.",
          classe: "IIa",
        })
        steps.push({
          rank: 2,
          exam: "ccta",
          label: "CCTA en différé (alternative non-invasive)",
          delai: "Sous 2-4 semaines",
          rationale:
            "Si patient préfère stratégie non-invasive et stabilité clinique. Discuter avec le cardiologue.",
          classe: "I",
        })
      } else {
        steps.push({
          rank: 1,
          exam: "ccta",
          label: "Coroscanner (CCTA) — au plus tôt possible",
          delai: "Sous 2-4 semaines (à raccourcir si possible)",
          rationale:
            "Probabilité 30-50% : CCTA Classe I. Prévenir le radiologue de la priorité clinique pour avancer le rendez-vous.",
          classe: "I",
        })
        if (mods.ica !== "non-dispo") {
          steps.push({
            rank: 2,
            exam: "ica",
            label: "Coronarographie ambulatoire (alternative)",
            delai: delaiFromAvail(mods.ica, "Sous 7 jours", "Sous 2 semaines"),
            rationale:
              "Si CCTA différé > 4 semaines ou symptômes en aggravation : coro ambulatoire (Classe IIa).",
            classe: "IIa",
          })
        }
      }
    } else {
      // CCTA non disponible
      if (mods.ica !== "non-dispo") {
        steps.push({
          rank: 1,
          exam: "ica",
          label: "Coronarographie ambulatoire",
          delai: delaiFromAvail(mods.ica, "Sous 7 jours", "Sous 2 semaines"),
          rationale:
            "CCTA non disponible + probabilité 30-50% → coro ambulatoire (Classe IIa ESC 2024). Diagnostic anatomique et revascularisation.",
          classe: "IIa",
        })
      }
      steps.push({
        rank: mods.ica !== "non-dispo" ? 2 : 1,
        exam: fonctionnel,
        label: `${examLabel(fonctionnel)} (alternative non-invasive)`,
        delai: "Sous 2 semaines",
        rationale:
          "Test d'ischémie si patient préfère approche non-invasive ou si coro non disponible.",
        classe: "I",
      })
    }

    return {
      steps,
      flags,
      contraindications,
      rationaleSummary: `Probabilité ${pct}% (intermédiaire-haut) → CCTA RAPIDE en 1er choix (Classe I). À défaut : coro ambulatoire (Classe IIa) ou test fonctionnel selon contexte.`,
    }
  }

  // ── Catégorie : élevée (50-85%) ─────────────────────────────────────────
  if (category === "elevee") {
    if (!cctaUsable || iodineCI) {
      steps.push({
        rank: 1,
        exam: fonctionnel,
        label: examLabel(fonctionnel),
        delai: "Sous 48-72h",
        rationale:
          "Test d'ischémie de 1ère intention (Classe I). PET privilégié si disponible (haute sensibilité), IRM si IRC/iode.",
        classe: "I",
      })
      if (mods.ica !== "non-dispo") {
        steps.push({
          rank: 2,
          exam: "ica",
          label: "Coronarographie si test positif ou non concluant",
          delai: delaiFromAvail(mods.ica, "Sous 7 jours", "Sous 2 semaines"),
          rationale: "Confirmation anatomique et revascularisation.",
          classe: "I",
        })
      }
    } else if (elderlyFragile && mods.ica !== "non-dispo") {
      steps.push({
        rank: 1,
        exam: "ica",
        label: "Coronarographie ambulatoire (1ère intention)",
        delai: delaiFromAvail(mods.ica, "Sous 48-72h", "Sous 7 jours"),
        rationale:
          "Sujet âgé/fragile + probabilité 50-85% → coro directe pertinente (Classe IIa ESC 2024). Diagnostic et revascularisation en un temps, évite la cascade d'examens et l'irradiation cumulée.",
        classe: "IIa",
      })
      steps.push({
        rank: 2,
        exam: fonctionnel,
        label: `${examLabel(fonctionnel)} (alternative)`,
        delai: "Sous 7 jours",
        rationale:
          "Si comorbidités contre-indiquant la coro d'emblée ou refus du patient.",
        classe: "I",
      })
    } else if (young) {
      steps.push({
        rank: 1,
        exam: fonctionnel,
        label: `${examLabel(fonctionnel)} ou IRM stress`,
        delai: "Sous 7 jours",
        rationale:
          "Sujet jeune (< 60 ans) : test fonctionnel d'abord pour quantifier l'ischémie et guider la décision de revascularisation (réduit le risque de coro inutile).",
        classe: "I",
      })
      if (mods.ica !== "non-dispo") {
        steps.push({
          rank: 2,
          exam: "ica",
          label: "Coronarographie si ischémie significative",
          delai: delaiFromAvail(mods.ica, "Sous 7 jours", "Sous 2 semaines"),
          rationale: "Revascularisation guidée par la quantification de l'ischémie.",
          classe: "I",
        })
      }
    } else {
      steps.push({
        rank: 1,
        exam: fonctionnel,
        label: "Test fonctionnel (IRM stress, PET ou SPECT)",
        delai: "Sous 7 jours",
        rationale: "Test d'ischémie en 1er choix (Classe I).",
        classe: "I",
      })
      if (mods.ica !== "non-dispo") {
        steps.push({
          rank: 2,
          exam: "ica",
          label: "Coronarographie selon résultat",
          delai: delaiFromAvail(mods.ica, "Sous 7 jours", "Sous 2 semaines"),
          rationale: "Si ischémie significative ou test non concluant.",
          classe: "I",
        })
      }
    }

    if (mods.ccta !== "non-dispo") {
      flags.push({
        type: "info",
        title: "CCTA peu pertinent à cette probabilité",
        message:
          "Pour une probabilité ≥ 50%, le CCTA a une moindre valeur ajoutée (forte prévalence de plaques). Préférer test fonctionnel ou coro directe.",
      })
    }
    if (mods.ica === "non-dispo") {
      flags.push({
        type: "warning",
        title: "Coro non disponible en ambulatoire",
        message:
          "À probabilité élevée, organiser une consultation cardiologique rapide pour orientation vers un centre disposant d'un plateau de coro.",
      })
    }

    return {
      steps,
      flags,
      contraindications,
      rationaleSummary: `Probabilité ${pct}% (élevée) → test fonctionnel ou coro directe selon âge/comorbidités. CCTA peu pertinent ici.`,
    }
  }

  // ── Catégorie : très élevée — pas de modulation, urgence ───────────────
  return {
    steps: [],
    flags: [],
    contraindications: [],
    rationaleSummary:
      "Urgence — appel SAMU 15. Pas de modulation par les modificateurs cliniques.",
  }
}
