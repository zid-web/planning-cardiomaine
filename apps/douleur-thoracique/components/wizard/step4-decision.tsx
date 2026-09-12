"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Phone,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  Pill,
  ChevronDown,
  ChevronUp,
  Settings2,
  Activity,
  Stethoscope,
  Sparkles,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus,
  Brain,
  Ban,
} from "lucide-react"
import type { Step3Data } from "./step3-rfcl"
import type { SymptomType } from "./step2-symptoms"
import { AnocaIndicativePanel } from "./anoca-panel"
import {
  DEFAULT_MODIFIERS,
  getPathwayRecommendation,
  type ClinicalModifiers,
  type IRCLevel,
  type PathwayRecommendation,
  type PathwayStep,
} from "@/lib/pathway"
import {
  runSequentialUpdate,
  synthesizeICADecision,
  TEST_PERFORMANCE,
  type TestKey,
  type TestOutcome,
  type TestEvent,
  type SequentialStep,
  type FourPathwaysEvaluation,
  type ICADecisionResult,
} from "@/lib/bayesian-cad"

/** Scénario directionnel de la chaîne de tests. */
export type BayesianScenario =
  | "all-negative"    // tous négatifs → exclusion probable
  | "all-positive"    // tous positifs → escalade vers coronarographie
  | "discordant"      // résultats contradictoires → orienter vers le test le plus performant
  | "mixed-negative"  // majorité négative + inconclusifs → tendance exclusion
  | "mixed-positive"  // majorité positive + inconclusifs → tendance escalade
  | "none"            // aucun test saisi

/** Données bayésiennes exportées vers le wizard-shell puis step5. */
export interface BayesianWizardData {
  preTestProbability: number
  postTestProbability: number
  postTestCiLow: number
  postTestCiHigh: number
  /** Variation signée = post-test − pré-test (informative uniquement, pas de seuil décisionnel). */
  diagnosticGain: number
  /** Scénario directionnel de la chaîne. */
  scenario: BayesianScenario
  steps: Array<{ label: string; probability: number; delta: number; ciLow: number; ciHigh: number }>
  events: TestEvent[]
  /** Synthèse ESC 2024 des quatre voies — décision finale unique pour le praticien. */
  icaIndicated: boolean
  icaLabel: string
  icaRationale: string
  icaColor: string
  icaConfidence: 1 | 2 | 3 | 4 | 5
  icaMetPathways: (1 | 2 | 3 | 4)[]
}

/**
 * Détermine le scénario directionnel à partir des événements.
 * Un test inconclusif est neutre et ne compte ni comme positif ni négatif.
 */
function computeScenario(events: TestEvent[]): BayesianScenario {
  if (events.length === 0) return "none"
  const conclusive = events.filter((e) => e.outcome !== "inconclusive")
  if (conclusive.length === 0) return "none"
  const positives = conclusive.filter((e) => e.outcome === "positive").length
  const negatives = conclusive.filter((e) => e.outcome === "negative").length
  if (positives > 0 && negatives > 0) return "discordant"
  if (positives === 0) return events.some((e) => e.outcome === "inconclusive") ? "mixed-negative" : "all-negative"
  return events.some((e) => e.outcome === "inconclusive") ? "mixed-positive" : "all-positive"
}

interface Step4Props {
  rfclData: Step3Data
  symptomType: SymptomType
  onNext: () => void
  onPrev: () => void
  onBayesianChange?: (data: BayesianWizardData | null) => void
}

const CATEGORY_CONFIG = {
  "tres-faible": { label: "TRÈS FAIBLE PROBABILITÉ", range: "≤ 5%", color: "#15803d", bg: "#f0fdf4", border: "#86efac", dots: 1, risk: "0.5% / an" },
  faible: { label: "FAIBLE PROBABILITÉ", range: "5–15%", color: "#16a34a", bg: "#f0fdf4", border: "#4ade80", dots: 2, risk: "~1.1% / an" },
  intermediaire: { label: "PROBABILITÉ INTERMÉDIAIRE", range: "15–50%", color: "#d97706", bg: "#fffbeb", border: "#fcd34d", dots: 3, risk: "~2.1% / an" },
  elevee: { label: "PROBABILITÉ ÉLEVÉE", range: "50–85%", color: "#dc2626", bg: "#fef2f2", border: "#fca5a5", dots: 4, risk: "" },
  "tres-elevee": { label: "TRÈS ÉLEVÉE / SCA PROBABLE", range: "> 85%", color: "#991b1b", bg: "#fef2f2", border: "#dc2626", dots: 5, risk: "" },
}

export function Step4Decision({ rfclData, symptomType, onNext, onPrev, onBayesianChange }: Step4Props) {
  const cat = rfclData.finalCategory
  const cfg = CATEGORY_CONFIG[cat]
  const pct = rfclData.adjustedRFCL

  // Pré-remplissage : si le CACS est connu et ≥ 400, on coche "calcifications massives"
  const initialModifiers = useMemo<ClinicalModifiers>(() => {
    const calcifMassives =
      rfclData.modifiers.cacs === "400-999" || rfclData.modifiers.cacs === "1000+"
    return { ...DEFAULT_MODIFIERS, calcifMassives }
  }, [rfclData.modifiers.cacs])

  const [mods, setMods] = useState<ClinicalModifiers>(initialModifiers)
  const [bayesianEvents, setBayesianEvents] = useState<UITestEvent[]>([])

  const supportsModifiers = cat === "intermediaire" || cat === "elevee"
  const recommendation = useMemo(
    () => getPathwayRecommendation(cat, rfclData.ageRange, pct, mods),
    [cat, rfclData.ageRange, pct, mods],
  )

  // Sub-category for intermediate (15-30 vs 30-50)
  const intermediateSubLabel =
    cat === "intermediaire" ? (pct >= 30 ? "haut (30–50%)" : "bas (15–30%)") : null

  // Filter out unavailable tests before passing to the bayesian engine
  const activeEvents = useMemo(
    () => bayesianEvents.filter((e) => e.outcome !== "unavailable") as TestEvent[],
    [bayesianEvents],
  )

  // Bayesian sequential update — only over active (non-unavailable) events
  const bayesianResult = useMemo(() => {
    const p = pct / 100
    const eps = 1e-6
    const preLogit = Math.log(Math.max(eps, Math.min(1 - eps, p)) / (1 - Math.max(eps, Math.min(1 - eps, p))))
    const preTest = {
      probability: pct,
      ciLow: Math.max(0, pct - 12),
      ciHigh: Math.min(100, pct + 12),
      baseRFCL: pct,
      postCACS: pct,
      contributions: [],
      finalLogit: preLogit,
      seLogit: 0.35,
    }
    return runSequentialUpdate(preTest, activeEvents)
  }, [pct, activeEvents])

  const finalStep = bayesianResult[bayesianResult.length - 1]
  const diagnosticGain = finalStep.probability - pct
  const scenario = useMemo(() => computeScenario(activeEvents), [activeEvents])

  // ESC 2024 four-pathway synthesis — the SAME engine drives the headline
  // verdict shown to the practitioner (PostTestProbabilityModule) and the
  // step 5 summary/fiche, so the two never disagree. Voies 2/3/4 reuse the
  // exact triggered criteria already collected on the CCTA/SPECT/DSE panels.
  const pathwayFlags = useMemo(() => computePathwayFlags(bayesianEvents), [bayesianEvents])
  const fourPathwaysEval = useMemo<FourPathwaysEvaluation>(() => {
    const pathway1Met = finalStep.probability > 85
    const metPathways: (1 | 2 | 3 | 4)[] = []
    if (pathway1Met) metPathways.push(1)
    if (pathwayFlags.voie2) metPathways.push(2)
    if (pathwayFlags.voie3) metPathways.push(3)
    if (pathwayFlags.voie4) metPathways.push(4)
    return {
      pathway1: {
        met: pathway1Met,
        triggers: pathway1Met ? [`Probabilité post-test ${finalStep.probability.toFixed(1)} %`] : [],
        postTestProb: finalStep.probability,
        ciLow: finalStep.ciLow,
        ciHigh: finalStep.ciHigh,
        ciConfirmed: pathway1Met && finalStep.ciLow > 70,
      },
      pathway2: { met: pathwayFlags.voie2, triggers: pathwayFlags.voie2Bits },
      pathway3: { met: pathwayFlags.voie3, triggers: pathwayFlags.voie3Bits },
      pathway4: { met: pathwayFlags.voie4, triggers: pathwayFlags.voie4Bits },
      anyMet: metPathways.length > 0,
      metPathways,
    }
  }, [finalStep, pathwayFlags])
  const icaDecision = useMemo<ICADecisionResult>(
    () => synthesizeICADecision(fourPathwaysEval),
    [fourPathwaysEval],
  )

  // Notify parent of Bayesian state on every change (only if at least one active event)
  useEffect(() => {
    if (activeEvents.length === 0) {
      onBayesianChange?.(null)
      return
    }
    onBayesianChange?.({
      preTestProbability: pct,
      postTestProbability: finalStep.probability,
      postTestCiLow: finalStep.ciLow,
      postTestCiHigh: finalStep.ciHigh,
      diagnosticGain,
      scenario,
      steps: bayesianResult.map((s) => ({
        label: s.label,
        probability: s.probability,
        delta: s.delta,
        ciLow: s.ciLow,
        ciHigh: s.ciHigh,
      })),
      events: activeEvents,
      icaIndicated: icaDecision.icaIndicated,
      icaLabel: icaDecision.label,
      icaRationale: icaDecision.rationale,
      icaColor: icaDecision.color,
      icaConfidence: icaDecision.confidence,
      icaMetPathways: fourPathwaysEval.metPathways,
    })
  }, [bayesianResult, activeEvents, pct, finalStep, diagnosticGain, scenario, icaDecision, fourPathwaysEval, onBayesianChange])

  return (
    <div className="space-y-5">
      {/* Category header */}
      <div
        className="rounded-xl border-2 p-4"
        style={{ borderColor: cfg.border, backgroundColor: cfg.bg }}
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="flex gap-1 mb-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: i < cfg.dots ? cfg.color : "#e2e8f0" }}
                />
              ))}
            </div>
            <p className="text-lg font-bold" style={{ color: cfg.color }}>{cfg.label}</p>
            <p className="text-xs text-[#64748b] mt-0.5">
              RF-CL {cfg.range}
              {intermediateSubLabel ? ` — sous-zone ${intermediateSubLabel}` : ""}
              {cfg.risk ? ` — Risque IDM/décès : ${cfg.risk}` : ""}
            </p>
          </div>
          <div className="text-3xl font-black" style={{ color: cfg.color }}>{pct}%</div>
        </div>
      </div>

      {/* Modifier panel — uniquement pour intermédiaire et élevée */}
      {supportsModifiers && (
        <ModifiersPanel
          mods={mods}
          onChange={setMods}
          accentColor={cfg.color}
        />
      )}

      {/* Pathway dynamique pour intermédiaire et élevée — quel premier examen choisir */}
      {supportsModifiers && (
        <PathwayBlock
          recommendation={recommendation}
          accentColor={cfg.color}
          accentBg={cfg.bg}
        />
      )}

      {/* Modèle bayésien continu — probabilité post-test + décision finale (4 voies ESC 2024) */}
      <PostTestProbabilityModule
        preTestProb={pct}
        events={bayesianEvents}
        onEventsChange={(ev) => setBayesianEvents(ev)}
        bayesianResult={bayesianResult}
        diagnosticGain={diagnosticGain}
        scenario={scenario}
        accentColor={cfg.color}
        icaDecision={icaDecision}
        symptomType={symptomType}
        sexFeminin={rfclData.sex === "femme"}
      />

      {/* Contenu spécifique par catégorie */}
      {cat === "tres-faible" && <CategoryTresFaible />}
      {cat === "faible" && <CategoryFaible />}
      {cat === "intermediaire" && <CategoryIntermediaireExtras />}
      {cat === "elevee" && <CategoryEleveeExtras />}
      {cat === "tres-elevee" && <CategoryTresElevee />}

      {/* Nav */}
      {cat !== "tres-elevee" && (
        <div className="flex gap-3 pt-2">
          <button
            onClick={onPrev}
            className="flex-1 py-3 rounded-xl border-2 border-[#e2e8f0] text-[#475569] text-sm font-semibold hover:bg-[#f8fafc] transition-colors"
          >
            Précédent
          </button>
          <button
            onClick={onNext}
            className="flex-[2] py-3 rounded-xl bg-[#1e293b] text-white font-semibold text-sm hover:bg-[#334155] transition-colors"
          >
            Suivant — Résumé & Impression
          </button>
        </div>
      )}
      {cat === "tres-elevee" && (
        <div className="flex gap-3 pt-2">
          <button
            onClick={onPrev}
            className="flex-1 py-3 rounded-xl border-2 border-[#e2e8f0] text-[#475569] text-sm font-semibold hover:bg-[#f8fafc] transition-colors"
          >
            Précédent
          </button>
          <button
            onClick={onNext}
            className="flex-[2] py-3 rounded-xl bg-[#991b1b] text-white font-semibold text-sm hover:bg-[#7f1d1d] transition-colors"
          >
            Générer la fiche d'urgence
          </button>
        </div>
      )}
    </div>
  )
}

// ── Test available in sequential updater ────────────────────────────────────

const TEST_KEYS: TestKey[] = ["ccta", "spect", "stress-echo", "stress-ecg"]

// "unavailable" is a UI-only state: test excluded from the bayesian chain entirely.
type UIOutcome = TestOutcome | "unavailable"

const OUTCOME_OPTIONS: { value: UIOutcome; label: string }[] = [
  { value: "positive", label: "Positif" },
  { value: "negative", label: "Négatif" },
  { value: "inconclusive", label: "Non concluant" },
  { value: "unavailable", label: "Indisponible" },
]

/** SPECT-specific clinical parameters (ESC 2024 Table 14). */
export interface SpectParams {
  /** Étendue de l'hypoperfusion. */
  extent: "none" | "mild" | "moderate" | "severe"
  /** Territoire concerné (impact pronostique par artère nourricière). */
  territory: "proximal" | "mid" | "distal" | "unknown"
  /** Angor persistant malgré double thérapie antiangineux optimisée. */
  refractoryAngina: boolean
  /** Hypokinésie dans le territoire ischémique (dysfonction VG segmentaire). */
  vgDysfunction: boolean
}

const DEFAULT_SPECT_PARAMS: SpectParams = {
  extent: "moderate",
  territory: "mid",
  refractoryAngina: false,
  vgDysfunction: false,
}

/**
 * CCTA-specific high-risk anatomical criteria (ESC 2024 Table 14, Voie 2).
 * Si AU MOINS UN critère est coché → CCTA = positif et Voie 2 active.
 */
export interface CctaParams {
  /** Sténose tronc commun ≥ 50 %. */
  leftMain50: boolean
  /** IVA proximale ≥ 70 %. */
  proxLad70: boolean
  /** Tritronculaire ≥ 70 % (ou FFR-CT ≤ 0,80 si dispo). */
  threeVessel: boolean
  /** Angor réfractaire associé (Voie 4 si présent). */
  refractoryAngina: boolean
}

const DEFAULT_CCTA_PARAMS: CctaParams = {
  leftMain50: false,
  proxLad70: false,
  threeVessel: false,
  refractoryAngina: false,
}

/**
 * Stress-echo (DSE) high-risk functional criteria (ESC 2024 Table 14, Voie 3).
 * Si AU MOINS UN critère est coché → Écho stress = positif et Voie 3 active.
 */
export interface StressEchoParams {
  /** > 3 segments hypokinétiques (≥ 4 / 16) — seuil haut risque ESC 2024. */
  segmentsGt3: boolean
  /** Dilatation VG induite par le stress. */
  lvDilatation: boolean
  /** Chute FE ≥ 10 % sous dobutamine. */
  efDrop: boolean
  /** Angor réfractaire associé (Voie 4 si présent). */
  refractoryAngina: boolean
}

const DEFAULT_STRESS_ECHO_PARAMS: StressEchoParams = {
  segmentsGt3: false,
  lvDilatation: false,
  efDrop: false,
  refractoryAngina: false,
}

// UI-level event extends TestEvent with the optional unavailable flag
interface UITestEvent {
  test: TestKey
  outcome: UIOutcome
  spectParams?: SpectParams
  cctaParams?: CctaParams
  stressEchoParams?: StressEchoParams
}

/**
 * Aggregate ESC 2024 pathway flags computed from every event in the chain.
 *  - Voie 2 : ≥1 CCTA event with at least one anatomical criterion checked.
 *  - Voie 3 : ≥1 functional event (SPECT extent ≥ moderate, OR stress-echo
 *             with any functional criterion checked).
 *  - Voie 4 : refractory angina recorded on any modality.
 */
function computePathwayFlags(events: UITestEvent[]): {
  voie2: boolean
  voie2Bits: string[]
  voie3: boolean
  voie3Bits: string[]
  voie4: boolean
  voie4Bits: string[]
} {
  const voie2Bits: string[] = []
  const voie3Bits: string[] = []
  const voie4Bits: string[] = []
  for (const ev of events) {
    if (ev.outcome === "unavailable") continue
    if (ev.test === "ccta" && ev.cctaParams) {
      // Les critères anatomiques haut risque (Voie 2) n'ont de sens que si le
      // coroscanner est positif — sur un examen négatif, aucune sténose n'est
      // retenue. L'angor réfractaire (Voie 4) reste un critère clinique
      // indépendant du résultat du coroscanner.
      if (ev.outcome !== "negative") {
        const hasSpecificCriterion = ev.cctaParams.leftMain50 || ev.cctaParams.proxLad70 || ev.cctaParams.threeVessel
        if (ev.cctaParams.leftMain50) voie2Bits.push("CCTA : tronc commun ≥ 50 %")
        if (ev.cctaParams.proxLad70) voie2Bits.push("CCTA : IVA proximale ≥ 70 %")
        if (ev.cctaParams.threeVessel) voie2Bits.push("CCTA : tritronculaire ≥ 70 %")
        // Un coroscanner positif active systématiquement le critère anatomique
        // (Voie 2), même si aucun sous-critère spécifique n'a été détaillé.
        if (ev.outcome === "positive" && !hasSpecificCriterion) {
          voie2Bits.push("CCTA : positif — critère anatomique haut risque retenu")
        }
      }
      if (ev.cctaParams.refractoryAngina) voie4Bits.push("CCTA : angor réfractaire malgré TMO")
    }
    if (ev.test === "spect" && ev.spectParams) {
      if (ev.spectParams.extent === "severe") voie3Bits.push("SPECT : ischémie ≥ 20 % VG (≥ 4 segments)")
      else if (ev.spectParams.extent === "moderate") voie3Bits.push("SPECT : ischémie ≥ 10 % VG (2–3 segments)")
      if (ev.spectParams.refractoryAngina) voie4Bits.push("SPECT : angor réfractaire malgré TMO")
    }
    if (ev.test === "stress-echo" && ev.stressEchoParams) {
      if (ev.stressEchoParams.segmentsGt3) voie3Bits.push("DSE : > 3 segments hypokinétiques (≥ 4 / 16)")
      if (ev.stressEchoParams.lvDilatation) voie3Bits.push("DSE : dilatation VG induite")
      if (ev.stressEchoParams.efDrop) voie3Bits.push("DSE : chute FE ≥ 10 %")
      if (ev.stressEchoParams.refractoryAngina) voie4Bits.push("DSE : angor réfractaire malgré TMO")
    }
  }
  return {
    voie2: voie2Bits.length > 0,
    voie2Bits,
    voie3: voie3Bits.length > 0,
    voie3Bits,
    voie4: voie4Bits.length > 0,
    voie4Bits,
  }
}

function outcomeIcon(outcome: TestOutcome, delta: number) {
  if (outcome === "inconclusive") return <Minus className="w-3.5 h-3.5 text-[#94a3b8]" />
  if (delta > 0) return <TrendingUp className="w-3.5 h-3.5 text-[#dc2626]" />
  return <TrendingDown className="w-3.5 h-3.5 text-[#15803d]" />
}

// ── SPECT contextual ESC 2024 criteria panel ─────────────────────────────────

// Référentiel ANSM / SFC : chaque segment = 5–6 % de la masse myocardique (modèle 17 segments AHA).
// Seuil de revascularisation ESC 2024 / SFC : ischémie étendue ≥ 10 % VG ≡ ≥ 2 segments / 17.
const EXTENT_OPTIONS: { value: SpectParams["extent"]; label: string; vg: string; risk: string }[] = [
  { value: "none",     label: "Absente / normale (0 segment)",                vg: "0 %",          risk: "Aucune" },
  { value: "mild",     label: "Limitée — 1 segment / 17",                     vg: "5–6 % VG",     risk: "Sous le seuil de revasc." },
  { value: "moderate", label: "Étendue — 2–3 segments / 17",                  vg: "10–18 % VG",   risk: "Seuil ≥10 % VG atteint" },
  { value: "severe",   label: "Très étendue — ≥4 segments / 17",              vg: "≥20 % VG",     risk: "Haut risque majeur" },
]

/**
 * Mapping ANSM/SFC : l'étendue de l'hypoperfusion détermine la conclusion du SPECT.
 *  - none     → négatif (pas d'ischémie)
 *  - mild     → non concluant (1 segment, sous le seuil de revascularisation)
 *  - moderate → positif (2–3 segments, ≥10 % VG, seuil atteint)
 *  - severe   → positif (≥4 segments, ≥20 % VG, haut risque)
 */
function extentToOutcome(extent: SpectParams["extent"]): UIOutcome {
  switch (extent) {
    case "none":     return "negative"
    case "mild":     return "inconclusive"
    case "moderate":
    case "severe":   return "positive"
  }
}

const TERRITORY_OPTIONS: { value: SpectParams["territory"]; label: string; note: string }[] = [
  { value: "proximal", label: "Proximal — IVA proximale / TC ≥50%", note: "Risque MACE élevé même sans ischémie sévère" },
  { value: "mid",      label: "Moyen — IVA moyenne / CX distale",   note: "Impact pronostique modéré" },
  { value: "distal",   label: "Distal — branches secondaires",       note: "Impact pronostique limité" },
  { value: "unknown",  label: "Non précisé",                         note: "" },
]

function SpectContextPanel({
  outcome,
  params,
  postTestProb,
  preTestProb,
  onChange,
}: {
  outcome: UIOutcome
  params: SpectParams
  postTestProb: number
  preTestProb: number
  onChange: (p: SpectParams) => void
}) {
  const set = <K extends keyof SpectParams>(key: K, val: SpectParams[K]) =>
    onChange({ ...params, [key]: val })

  const extentEntry = EXTENT_OPTIONS.find((e) => e.value === params.extent)!
  const territoryEntry = TERRITORY_OPTIONS.find((t) => t.value === params.territory)!

  // Richardson-Detsky zone
  const rdZone: "non-applicable" | "tres-faible" | "utile" | "tres-elevee" =
    preTestProb <= 5
      ? "non-applicable"
      : preTestProb <= 15
      ? "tres-faible"
      : preTestProb >= 85
      ? "tres-elevee"
      : "utile"

  // ESC 2024 / ANSM-SFC criteria evaluation
  // Seuil de revascularisation ≥ 10 % VG ≡ ≥ 2 segments / 17 → "moderate" et "severe" déclenchent l'ICA directe
  const isHighRiskIschemia = params.extent === "moderate" || params.extent === "severe"
  const isMassiveIschemia  = params.extent === "severe"        // ≥4 segments / ≥20 % VG
  const isProximalTerritory = params.territory === "proximal"  // IVA prox / TC → ICA discutée
  const isRefractoryAngina  = params.refractoryAngina          // ICA indépendante probabilité
  const isVGDysfunction     = params.vgDysfunction             // enrichissement + décision
  const isPragmaticThreshold = postTestProb > 50 && outcome === "positive" // seuil pragmatique

  const directIcaCriteria: string[] = []
  if (isMassiveIschemia)        directIcaCriteria.push("Ischémie très étendue ≥20 % VG (≥4 segments / 17) — haut risque majeur")
  else if (isHighRiskIschemia)  directIcaCriteria.push("Ischémie étendue ≥10 % VG (2–3 segments / 17) — seuil de revascularisation atteint (ESC 2024 · ANSM/SFC)")
  if (isRefractoryAngina)  directIcaCriteria.push("Angor réfractaire au traitement médical optimal")
  if (isProximalTerritory && isHighRiskIschemia) directIcaCriteria.push("Territoire proximal à haut risque anatomique")

  const discussedCriteria: string[] = []
  if (isPragmaticThreshold && !isHighRiskIschemia) discussedCriteria.push(`Probabilité post-test >50% + SPECT positif (${postTestProb.toFixed(1)}% — seuil pragmatique)`)
  if (isVGDysfunction) discussedCriteria.push("Dysfonction VG segmentaire dans le territoire ischémique")

  const hasDirectIndication = directIcaCriteria.length > 0
  const hasDiscussedIndication = discussedCriteria.length > 0

  if (outcome === "unavailable") return null

  return (
    <div className="rounded-lg border border-[#e0e7ff] bg-[#fafbff] p-3 space-y-3 mt-1">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#4338ca]">
          Paramètres SPECT/TEP — critères ESC 2024
        </p>
        <span className="text-[10px] font-semibold rounded-full bg-[#eef2ff] text-[#4338ca] px-2 py-0.5">
          Conclusion déduite de l&apos;étendue (ANSM/SFC)
        </span>
      </div>

      {/* Richardson-Detsky zone warning */}
      {rdZone === "non-applicable" && (
        <div className="rounded-md border border-[#fca5a5] bg-[#fef2f2] px-3 py-2">
          <p className="text-[11px] font-bold text-[#b91c1c]">Zone très faible probabilité (≤5%)</p>
          <p className="text-[11px] text-[#7f1d1d] mt-0.5 leading-relaxed">
            La chaîne bayésienne est mathématiquement valide mais cliniquement non actionnable.
            Même un SPECT très positif (LR+ = 4.6) ne franchit pas le seuil de 15%.
            Traiter les facteurs de risque plutôt que d&apos;initier des examens d&apos;imagerie.
          </p>
        </div>
      )}
      {rdZone === "tres-faible" && (
        <div className="rounded-md border border-[#fde68a] bg-[#fefce8] px-3 py-2">
          <p className="text-[11px] font-bold text-[#854d0e]">Zone de faible utilité (5–15%)</p>
          <p className="text-[11px] text-[#78350f] mt-0.5 leading-relaxed">
            La probabilité pré-test est faible. Le SPECT peut reclassifier mais rarement au-delà du seuil d&apos;action de 50%.
            Privilégier le CCTA pour l&apos;exclusion ou le reclassement en cas de RF-CL entre 5% et 15%.
          </p>
        </div>
      )}

      {/* Extent of hypoperfusion */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold text-[#475569]">
          Étendue de l&apos;hypoperfusion (SPECT/TEP)
          <span className="ml-1 text-[#94a3b8] font-normal">
            — ANSM/SFC · 1 segment ≈ 5–6 % VG · seuil revasc. ≥10 % VG (≥2 seg./17)
          </span>
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {EXTENT_OPTIONS.map((opt) => {
            const isSelected = params.extent === opt.value
            const isHighRisk = opt.value === "moderate" || opt.value === "severe"
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => set("extent", opt.value)}
                className="rounded-md px-2.5 py-2 text-left transition-colors border"
                style={{
                  borderColor: isSelected ? (isHighRisk ? "#dc2626" : "#6366f1") : "#e2e8f0",
                  backgroundColor: isSelected ? (isHighRisk ? "#fef2f2" : "#eef2ff") : "white",
                }}
              >
                <p
                  className="text-[11px] font-semibold leading-snug"
                  style={{ color: isSelected ? (isHighRisk ? "#b91c1c" : "#4338ca") : "#1e293b" }}
                >
                  {opt.label}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: isHighRisk ? "#dc2626" : "#64748b" }}>
                  {isHighRisk ? `${opt.vg} — Critère coro directe` : `${opt.vg} — ${opt.risk}`}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Territory */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold text-[#475569]">
          Territoire concerné
          <span className="ml-1 text-[#94a3b8] font-normal">— impact pronostique selon l&apos;artère nourricière</span>
        </p>
        <select
          value={params.territory}
          onChange={(e) => set("territory", e.target.value as SpectParams["territory"])}
          className="w-full text-xs rounded-md border border-[#c7d2fe] bg-white px-2 py-2 text-[#1e293b] font-medium focus:outline-none focus:ring-1 focus:ring-[#6366f1]"
        >
          {TERRITORY_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        {territoryEntry.note && (
          <p className="text-[10px] text-[#64748b] leading-relaxed">{territoryEntry.note}</p>
        )}
      </div>

      {/* Toggle pairs */}
      <div className="grid grid-cols-1 gap-2">
        {[
          {
            key: "refractoryAngina" as const,
            label: "Angor réfractaire au traitement médical optimal",
            sub: "Persistance des symptômes malgré double thérapie antiangineux optimisée",
            val: params.refractoryAngina,
          },
          {
            key: "vgDysfunction" as const,
            label: "Dysfonction VG segmentaire associée",
            sub: "Hypokinésie dans le territoire ischémique",
            val: params.vgDysfunction,
          },
        ].map(({ key, label, sub, val }) => (
          <div key={key} className="flex items-center justify-between gap-3 bg-white rounded-md border border-[#e2e8f0] px-3 py-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-[#1e293b] leading-snug">{label}</p>
              <p className="text-[10px] text-[#64748b] mt-0.5">{sub}</p>
            </div>
            <div className="flex rounded-md overflow-hidden border border-[#c7d2fe] flex-shrink-0">
              {[false, true].map((bVal) => (
                <button
                  key={String(bVal)}
                  type="button"
                  onClick={() => set(key, bVal)}
                  className="px-3 py-1.5 text-[11px] font-semibold transition-colors"
                  style={{
                    backgroundColor: val === bVal ? (bVal ? "#dc2626" : "#16a34a") : "white",
                    color: val === bVal ? "white" : "#475569",
                  }}
                >
                  {bVal ? "Oui" : "Non"}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ESC 2024 decision synthesis */}
      {outcome === "positive" && (hasDirectIndication || hasDiscussedIndication) && (
        <div
          className="rounded-md border p-2.5 space-y-1.5"
          style={{
            borderColor: hasDirectIndication ? "#fca5a5" : "#fde68a",
            backgroundColor: hasDirectIndication ? "#fef2f2" : "#fefce8",
          }}
        >
          <p
            className="text-[11px] font-bold"
            style={{ color: hasDirectIndication ? "#b91c1c" : "#854d0e" }}
          >
            {hasDirectIndication
              ? "Indication coro directe — critères ESC 2024"
              : "Coronarographie discutable — seuil pragmatique"}
          </p>
          <ul className="space-y-0.5">
            {[...directIcaCriteria, ...discussedCriteria].map((c, ci) => (
              <li key={ci} className="text-[10px] leading-relaxed" style={{ color: hasDirectIndication ? "#7f1d1d" : "#854d0e" }}>
                · {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {outcome === "negative" && (
        <div className="rounded-md border border-[#86efac] bg-[#f0fdf4] px-3 py-2">
          <p className="text-[11px] font-semibold text-[#166534]">
            SPECT négatif — ischémie exclue dans les limites de sensibilité du test
          </p>
          <p className="text-[10px] text-[#166534] mt-0.5 leading-relaxed">
            Sensibilité SPECT ~80%. En cas de forte suspicion clinique persistante, envisager un test complémentaire.
          </p>
        </div>
      )}
    </div>
  )
}

// ── CCTA contextual ESC 2024 criteria panel (Voie 2) ─────────────────────────

const CCTA_CRITERIA: Array<{
  key: keyof Omit<CctaParams, "refractoryAngina">
  label: string
  detail: string
  voie: "Voie 2"
}> = [
  {
    key: "leftMain50",
    label: "TC ≥ 50 %",
    detail: "Sténose du tronc commun ≥ 50 % — critère anatomique haut risque",
    voie: "Voie 2",
  },
  {
    key: "proxLad70",
    label: "IVA proximale ≥ 70 %",
    detail: "Sténose de l'IVA proximale ≥ 70 % — critère anatomique haut risque",
    voie: "Voie 2",
  },
  {
    key: "threeVessel",
    label: "Tritronculaire ≥ 70 %",
    detail: "Atteinte des 3 troncs ≥ 70 % (ou FFR-CT ≤ 0,80 si disponible)",
    voie: "Voie 2",
  },
]

function CctaContextPanel({
  outcome,
  params,
  onChange,
}: {
  outcome: UIOutcome
  params: CctaParams
  onChange: (p: CctaParams) => void
}) {
  const set = <K extends keyof CctaParams>(key: K, val: CctaParams[K]) =>
    onChange({ ...params, [key]: val })

  const anyHighRisk =
    params.leftMain50 || params.proxLad70 || params.threeVessel
  const refractory = params.refractoryAngina
  // Coroscanner négatif → aucune sténose retenue : les critères anatomiques
  // haut risque n'ont pas de sens et ne sont pas affichés.
  const showAnatomicCriteria = outcome !== "negative"
  // Un coroscanner positif active systématiquement le critère anatomique
  // (Voie 2), même sans sous-critère spécifique détaillé (voir computePathwayFlags).
  const voie2ActiveGeneric = outcome === "positive" && !anyHighRisk

  return (
    <div className="rounded-lg border border-[#fca5a5] bg-[#fffafa] p-3 space-y-3 mt-1">
      {showAnatomicCriteria && (
        <>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#b91c1c]">
              Critères anatomiques haut risque — ESC 2024 Table 14
            </p>
            <span className="text-[10px] font-semibold rounded-full bg-[#fef2f2] text-[#b91c1c] px-2 py-0.5">
              Voie 2 — auto-active dès qu'un critère est coché, ou si le test est marqué Positif
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
            {CCTA_CRITERIA.map((opt) => {
              const active = !!params[opt.key]
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => set(opt.key, !active)}
                  aria-pressed={active}
                  className="flex items-start gap-2 rounded-md border px-2.5 py-2 text-left transition-colors"
                  style={{
                    borderColor: active ? "#dc2626" : "#fecaca",
                    backgroundColor: active ? "#fef2f2" : "white",
                  }}
                >
                  <span
                    className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border"
                    style={{
                      borderColor: active ? "#dc2626" : "#cbd5e1",
                      backgroundColor: active ? "#dc2626" : "white",
                      color: "white",
                    }}
                    aria-hidden="true"
                  >
                    {active && (
                      <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2 6 L5 9 L10 3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span
                      className="block text-[11px] font-bold leading-tight"
                      style={{ color: active ? "#7f1d1d" : "#1e293b" }}
                    >
                      {opt.label}
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-snug text-[#64748b]">
                      {opt.detail}
                    </span>
                    <span className="mt-0.5 inline-block rounded bg-[#fee2e2] text-[#b91c1c] px-1.5 py-px text-[9px] font-bold uppercase tracking-wide">
                      Anatomique · {opt.voie}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* Refractory angina toggle (Voie 4) */}
      <div className="flex items-center justify-between gap-3 bg-white rounded-md border border-[#e2e8f0] px-3 py-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-[#1e293b] leading-snug">
            Angor réfractaire malgré TMO double optimisé
          </p>
          <p className="text-[10px] text-[#64748b] mt-0.5">
            Critère clinique direct — Voie 4 ESC 2024 (indépendant de la probabilité)
          </p>
        </div>
        <div className="flex rounded-md overflow-hidden border border-[#fecaca] flex-shrink-0">
          {[false, true].map((bVal) => (
            <button
              key={String(bVal)}
              type="button"
              onClick={() => set("refractoryAngina", bVal)}
              className="px-3 py-1.5 text-[11px] font-semibold transition-colors"
              style={{
                backgroundColor: refractory === bVal ? (bVal ? "#dc2626" : "#16a34a") : "white",
                color: refractory === bVal ? "white" : "#475569",
              }}
            >
              {bVal ? "Oui" : "Non"}
            </button>
          ))}
        </div>
      </div>

      {(anyHighRisk || voie2ActiveGeneric) && (
        <div className="rounded-md border border-[#fca5a5] bg-[#fef2f2] px-3 py-2">
          <p className="text-[11px] font-bold text-[#b91c1c]">
            {anyHighRisk
              ? "→ CCTA classé positif — critère anatomique haut risque retenu (Voie 2 active)"
              : "→ CCTA positif — critère anatomique haut risque retenu par défaut (Voie 2 active)"}
          </p>
        </div>
      )}
      {refractory && !anyHighRisk && !voie2ActiveGeneric && (
        <div className="rounded-md border border-[#fde68a] bg-[#fefce8] px-3 py-2">
          <p className="text-[11px] font-bold text-[#854d0e]">
            → Voie 4 active (angor réfractaire) — coronarographie indépendante de la probabilité
          </p>
        </div>
      )}
    </div>
  )
}

// ── Stress-echo (DSE) contextual ESC 2024 criteria panel (Voie 3) ────────────

const STRESS_ECHO_CRITERIA: Array<{
  key: keyof Omit<StressEchoParams, "refractoryAngina">
  label: string
  detail: string
}> = [
  {
    key: "segmentsGt3",
    label: "> 3 segments hypokinétiques",
    detail: "DSE ≥ 4 / 16 segments avec WMA induites — seuil haut risque ESC 2024",
  },
  {
    key: "lvDilatation",
    label: "Dilatation VG induite",
    detail: "Dilatation ventriculaire gauche induite par le stress",
  },
  {
    key: "efDrop",
    label: "Chute FE ≥ 10 %",
    detail: "Baisse de fraction d'éjection ≥ 10 % sous dobutamine",
  },
]

function StressEchoContextPanel({
  params,
  onChange,
}: {
  params: StressEchoParams
  onChange: (p: StressEchoParams) => void
}) {
  const set = <K extends keyof StressEchoParams>(key: K, val: StressEchoParams[K]) =>
    onChange({ ...params, [key]: val })

  const anyHighRisk = params.segmentsGt3 || params.lvDilatation || params.efDrop
  const refractory = params.refractoryAngina

  return (
    <div className="rounded-lg border border-[#5eead4] bg-[#f0fdfa] p-3 space-y-3 mt-1">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#0f766e]">
          Critères fonctionnels haut risque — ESC 2024 Table 14
        </p>
        <span className="text-[10px] font-semibold rounded-full bg-[#ccfbf1] text-[#0f766e] px-2 py-0.5">
          Voie 3 — auto-active dès qu'un critère est coché
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
        {STRESS_ECHO_CRITERIA.map((opt) => {
          const active = !!params[opt.key]
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => set(opt.key, !active)}
              aria-pressed={active}
              className="flex items-start gap-2 rounded-md border px-2.5 py-2 text-left transition-colors"
              style={{
                borderColor: active ? "#0d9488" : "#99f6e4",
                backgroundColor: active ? "#ccfbf1" : "white",
              }}
            >
              <span
                className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border"
                style={{
                  borderColor: active ? "#0d9488" : "#cbd5e1",
                  backgroundColor: active ? "#0d9488" : "white",
                  color: "white",
                }}
                aria-hidden="true"
              >
                {active && (
                  <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 6 L5 9 L10 3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className="min-w-0">
                <span
                  className="block text-[11px] font-bold leading-tight"
                  style={{ color: active ? "#115e59" : "#1e293b" }}
                >
                  {opt.label}
                </span>
                <span className="mt-0.5 block text-[10px] leading-snug text-[#64748b]">
                  {opt.detail}
                </span>
                <span className="mt-0.5 inline-block rounded bg-[#ccfbf1] text-[#0f766e] px-1.5 py-px text-[9px] font-bold uppercase tracking-wide">
                  Fonctionnel · Voie 3
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {/* Refractory angina toggle (Voie 4) */}
      <div className="flex items-center justify-between gap-3 bg-white rounded-md border border-[#e2e8f0] px-3 py-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-[#1e293b] leading-snug">
            Angor réfractaire malgré TMO double optimisé
          </p>
          <p className="text-[10px] text-[#64748b] mt-0.5">
            Critère clinique direct — Voie 4 ESC 2024 (indépendant de la probabilité)
          </p>
        </div>
        <div className="flex rounded-md overflow-hidden border border-[#99f6e4] flex-shrink-0">
          {[false, true].map((bVal) => (
            <button
              key={String(bVal)}
              type="button"
              onClick={() => set("refractoryAngina", bVal)}
              className="px-3 py-1.5 text-[11px] font-semibold transition-colors"
              style={{
                backgroundColor: refractory === bVal ? (bVal ? "#dc2626" : "#16a34a") : "white",
                color: refractory === bVal ? "white" : "#475569",
              }}
            >
              {bVal ? "Oui" : "Non"}
            </button>
          ))}
        </div>
      </div>

      {anyHighRisk && (
        <div className="rounded-md border border-[#5eead4] bg-[#ccfbf1] px-3 py-2">
          <p className="text-[11px] font-bold text-[#0f766e]">
            → Écho de stress classée positive — critère fonctionnel haut risque retenu (Voie 3 active)
          </p>
        </div>
      )}
      {refractory && !anyHighRisk && (
        <div className="rounded-md border border-[#fde68a] bg-[#fefce8] px-3 py-2">
          <p className="text-[11px] font-bold text-[#854d0e]">
            → Voie 4 active (angor réfractaire) — coronarographie indépendante de la probabilité
          </p>
        </div>
      )}
    </div>
  )
}

// ── Probabilité post-test — module bayésien continu ──────────────────────────

function PostTestProbabilityModule({
  preTestProb,
  events,
  onEventsChange,
  bayesianResult,
  diagnosticGain,
  scenario,
  accentColor,
  icaDecision,
  symptomType,
  sexFeminin,
}: {
  preTestProb: number
  events: UITestEvent[]
  onEventsChange: (ev: UITestEvent[]) => void
  bayesianResult: SequentialStep[]
  diagnosticGain: number
  scenario: BayesianScenario
  accentColor: string
  icaDecision: ICADecisionResult
  symptomType: SymptomType
  sexFeminin: boolean
}) {
  const [expanded, setExpanded] = useState(true)
  const finalStep = bayesianResult[bayesianResult.length - 1]

  const addEvent = useCallback(() => {
    onEventsChange([
      ...events,
      {
        test: "ccta",
        // L'événement démarre "non concluant" : il devient automatiquement
        // "positif" dès qu'un critère anatomique haut risque est coché.
        outcome: "inconclusive",
        cctaParams: { ...DEFAULT_CCTA_PARAMS },
        spectParams: { ...DEFAULT_SPECT_PARAMS },
        stressEchoParams: { ...DEFAULT_STRESS_ECHO_PARAMS },
      },
    ])
  }, [events, onEventsChange])

  const removeEvent = useCallback(
    (i: number) => {
      onEventsChange(events.filter((_, idx) => idx !== i))
    },
    [events, onEventsChange],
  )

  const updateEvent = useCallback(
    (i: number, patch: Partial<UITestEvent>) => {
      onEventsChange(events.map((ev, idx) => (idx === i ? { ...ev, ...patch } : ev)))
    },
    [events, onEventsChange],
  )

  const gainAbs = Math.abs(diagnosticGain)
  const gainSign = diagnosticGain >= 0 ? "+" : ""

  // Aggregate ESC 2024 pathway flags (Voies 2 / 3 / 4) computed from every
  // event currently in the chain. These drive the red highlight in the
  // four-pathway panel below.
  const pathwayFlags = useMemo(() => computePathwayFlags(events), [events])

  // Best performant test for discordant scenario (highest LR+).
  // Only considers tests from TEST_KEYS (the clinically available list),
  // excluding any already marked unavailable or already used in the chain.
  const bestTest = useMemo(() => {
    const unavailableKeys = new Set(
      events.filter((e) => e.outcome === "unavailable").map((e) => e.test),
    )
    const usedKeys = new Set(
      events.filter((e) => e.outcome !== "unavailable").map((e) => e.test),
    )
    const pool = TEST_KEYS.filter((k) => !unavailableKeys.has(k) && !usedKeys.has(k))
    const candidates = pool.length > 0 ? pool : TEST_KEYS
    return candidates.reduce((best, k) =>
      TEST_PERFORMANCE[k].lrPositive > TEST_PERFORMANCE[best].lrPositive ? k : best,
    )
  }, [events])

  return (
    <div className="rounded-xl border-2 border-[#6366f1] bg-white overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-[#f5f3ff] transition-colors text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-[#6366f1] flex items-center justify-center flex-shrink-0">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#1e293b]">
              Probabilité post-test
              <span className="ml-2 text-[10px] font-semibold text-[#6366f1] bg-[#eef2ff] rounded-full px-2 py-0.5 uppercase tracking-wide">
                Modèle bayésien continu
              </span>
            </p>
            <p className="text-xs text-[#64748b] mt-0.5 leading-relaxed">
              Mise à jour itérative par tests séquentiels — Knuuti 2018 · ESC 2024
              {events.length > 0 ? ` — ${events.length} test${events.length > 1 ? "s" : ""} saisi${events.length > 1 ? "s" : ""}` : ""}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-[#94a3b8] flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[#94a3b8] flex-shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-[#e0e7ff] p-4 space-y-4">
          {/* Probabilité pré-test */}
          <div className="flex items-center justify-between bg-[#f8fafc] rounded-lg px-3 py-2.5 border border-[#e2e8f0]">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#64748b]">
                Probabilité pré-test (RF-CL ajusté)
              </p>
              <p className="text-xs text-[#475569] mt-0.5">Point de départ de la mise à jour bayésienne</p>
            </div>
            <span className="text-2xl font-black" style={{ color: accentColor }}>
              {preTestProb}%
            </span>
          </div>

          {/* Tests saisis — chaîne directionnelle */}
          {events.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#64748b]">
                Chaîne directionnelle des tests
              </p>
              {(() => {
                // Track separate index for bayesianResult (only active events advance it)
                let activeIndex = 0
                return events.map((ev, i) => {
                  const isUnavailable = ev.outcome === "unavailable"
                  const isPositive = ev.outcome === "positive"
                  const isNegative = ev.outcome === "negative"

                  // Advance bayesian index only for non-unavailable events
                  const step = isUnavailable ? null : bayesianResult[activeIndex + 1]
                  if (!isUnavailable) activeIndex++

                  // Card styling
                  const badgeBg = isUnavailable
                    ? "#f8fafc"
                    : isPositive ? "#fef2f2"
                    : isNegative ? "#f0fdf4"
                    : "#f8fafc"
                  const badgeBorder = isUnavailable
                    ? "#cbd5e1"
                    : isPositive ? "#fca5a5"
                    : isNegative ? "#86efac"
                    : "#e2e8f0"
                  const badgeTextColor = isUnavailable
                    ? "#94a3b8"
                    : isPositive ? "#b91c1c"
                    : isNegative ? "#15803d"
                    : "#64748b"
                  const badgeLabel = isUnavailable
                    ? "Indisponible — exclu de la chaîne bayésienne"
                    : isPositive
                    ? "Positif → probabilité augmente"
                    : isNegative
                    ? "Négatif → probabilité diminue"
                    : "Inconclusif → pas de mise à jour"

                  return (
                    <div
                      key={i}
                      className="rounded-lg p-3 space-y-2"
                      style={{
                        border: `1.5px solid ${badgeBorder}`,
                        backgroundColor: badgeBg,
                        opacity: isUnavailable ? 0.65 : 1,
                      }}
                    >
                      {/* Top row: index + test selector + outcome selector + delete */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: isUnavailable
                              ? "#94a3b8"
                              : isPositive ? "#dc2626"
                              : isNegative ? "#16a34a"
                              : "#94a3b8",
                          }}
                        >
                          {isUnavailable ? <Ban className="w-2.5 h-2.5" /> : i + 1}
                        </span>
                        {/* Test selector */}
                        <select
                          value={ev.test}
                          onChange={(e) => {
                            const newTest = e.target.value as TestKey
                            // Quand on bascule vers SPECT, on aligne automatiquement la conclusion
                            // sur l'étendue (sauf si "indisponible" a été choisi explicitement).
                            if (newTest === "spect" && ev.outcome !== "unavailable") {
                              const sp = ev.spectParams ?? DEFAULT_SPECT_PARAMS
                              updateEvent(i, {
                                test: newTest,
                                outcome: extentToOutcome(sp.extent),
                                spectParams: sp,
                              })
                            } else if (newTest === "ccta") {
                              updateEvent(i, {
                                test: newTest,
                                cctaParams: ev.cctaParams ?? { ...DEFAULT_CCTA_PARAMS },
                              })
                            } else if (newTest === "stress-echo") {
                              updateEvent(i, {
                                test: newTest,
                                stressEchoParams:
                                  ev.stressEchoParams ?? { ...DEFAULT_STRESS_ECHO_PARAMS },
                              })
                            } else {
                              updateEvent(i, { test: newTest })
                            }
                          }}
                          className="flex-1 min-w-0 text-xs rounded-md border bg-white px-2 py-1.5 font-medium focus:outline-none focus:ring-1 focus:ring-[#6366f1]"
                          style={{
                            borderColor: isUnavailable ? "#cbd5e1" : "#c7d2fe",
                            color: isUnavailable ? "#94a3b8" : "#1e293b",
                            textDecoration: isUnavailable ? "line-through" : "none",
                          }}
                        >
                          {TEST_KEYS.map((k) => (
                            <option key={k} value={k}>
                              {TEST_PERFORMANCE[k].label}
                            </option>
                          ))}
                        </select>
                        {/* Outcome selector */}
                        <div
                          className="flex rounded-md overflow-hidden border"
                          style={{ borderColor: isUnavailable ? "#cbd5e1" : "#c7d2fe" }}
                        >
                          {OUTCOME_OPTIONS.map((opt) => {
                            const isSelected = ev.outcome === opt.value
                            const selBg =
                              opt.value === "positive"
                                ? "#dc2626"
                                : opt.value === "negative"
                                ? "#16a34a"
                                : opt.value === "unavailable"
                                ? "#64748b"
                                : "#94a3b8"
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                  // Coroscanner passé à "négatif" → on efface les critères
                                  // anatomiques haut risque (Voie 2) : ils n'ont plus de sens
                                  // sur un examen négatif et ne doivent pas rester actifs en
                                  // arrière-plan dans le calcul des voies.
                                  if (ev.test === "ccta" && opt.value === "negative" && ev.cctaParams) {
                                    updateEvent(i, {
                                      outcome: opt.value,
                                      cctaParams: { ...ev.cctaParams, leftMain50: false, proxLad70: false, threeVessel: false },
                                    })
                                  } else {
                                    updateEvent(i, { outcome: opt.value })
                                  }
                                }}
                                className="px-2 py-1.5 text-[11px] font-semibold transition-colors"
                                style={{
                                  backgroundColor: isSelected ? selBg : "white",
                                  color: isSelected ? "white" : "#475569",
                                }}
                              >
                                {opt.label}
                              </button>
                            )
                          })}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeEvent(i)}
                          className="w-7 h-7 rounded-md border border-[#fca5a5] bg-[#fef2f2] flex items-center justify-center hover:bg-[#fee2e2] transition-colors flex-shrink-0"
                          aria-label="Supprimer ce test"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-[#dc2626]" />
                        </button>
                      </div>

                      {/* Directional / status badge */}
                      <div
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold"
                        style={{ backgroundColor: badgeBorder + "55", color: badgeTextColor }}
                      >
                        {isUnavailable ? (
                          <Ban className="w-3 h-3" />
                        ) : isPositive ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : isNegative ? (
                          <TrendingDown className="w-3 h-3" />
                        ) : (
                          <Minus className="w-3 h-3" />
                        )}
                        {badgeLabel}
                      </div>

                      {/* Step result — only for active, conclusive events */}
                      {step && !isUnavailable && ev.outcome !== "inconclusive" && (
                        <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: badgeBorder }}>
                          <span className="text-xs text-[#475569]">
                            Probabilité après ce test :{" "}
                            <strong className="text-[#1e293b]">{step.probability.toFixed(1)}%</strong>
                            {" "}
                            <span
                              className="text-[11px] font-semibold"
                              style={{ color: step.delta > 0 ? "#b91c1c" : step.delta < 0 ? "#15803d" : "#64748b" }}
                            >
                              ({step.delta > 0 ? "+" : ""}{step.delta.toFixed(1)} pts)
                            </span>
                            {" "}
                            <span className="text-[10px] text-[#94a3b8]">
                              IC95 [{step.ciLow.toFixed(0)}–{step.ciHigh.toFixed(0)}%]
                            </span>
                          </span>
                        </div>
                      )}

                      {/* SPECT-specific ESC 2024 criteria panel */}
                      {ev.test === "spect" && !isUnavailable && (
                        <SpectContextPanel
                          outcome={ev.outcome}
                          params={ev.spectParams ?? { ...DEFAULT_SPECT_PARAMS }}
                          postTestProb={step?.probability ?? preTestProb}
                          preTestProb={preTestProb}
                          onChange={(p) => {
                            // ANSM/SFC : l'étendue détermine automatiquement la conclusion.
                            // Si l'utilisateur a marqué "indisponible", on conserve ce choix.
                            const derivedOutcome = extentToOutcome(p.extent)
                            const nextOutcome: UIOutcome =
                              ev.outcome === "unavailable" ? "unavailable" : derivedOutcome
                            updateEvent(i, { spectParams: p, outcome: nextOutcome })
                          }}
                        />
                      )}

                      {/* CCTA-specific ESC 2024 anatomical criteria panel (Voie 2) — la grille des
                          critères anatomiques haut risque est masquée si le coroscanner est
                          négatif (elle n'a alors pas de sens), le reste du panneau reste visible. */}
                      {ev.test === "ccta" && !isUnavailable && (
                        <CctaContextPanel
                          outcome={ev.outcome}
                          params={ev.cctaParams ?? { ...DEFAULT_CCTA_PARAMS }}
                          onChange={(p) => {
                            // Au moins un critère anatomique haut risque coché → CCTA = positif.
                            const anyHighRisk = p.leftMain50 || p.proxLad70 || p.threeVessel
                            const nextOutcome: UIOutcome =
                              ev.outcome === "unavailable"
                                ? "unavailable"
                                : anyHighRisk
                                  ? "positive"
                                  : ev.outcome
                            updateEvent(i, { cctaParams: p, outcome: nextOutcome })
                          }}
                        />
                      )}

                      {/* Coroscanner négatif chez un patient aux symptômes atypiques : la
                          maladie épicardique obstructive est peu probable, mais les symptômes
                          restent à expliquer — piste de réflexion ANOCA (non validée). */}
                      {ev.test === "ccta" && isNegative && symptomType === "atypique" && (
                        <AnocaIndicativePanel
                          sexFeminin={sexFeminin}
                          subtitle="Coroscanner négatif, symptômes atypiques : envisager une origine microvasculaire/vasospastique (non validé, à titre pédagogique)"
                          contextNote="Ne remplace pas et ne contredit pas la décision ci-dessus : il s'agit ici d'une question diagnostique distincte (origine microvasculaire ou vasospastique), à discuter uniquement si les symptômes persistent malgré un coroscanner négatif."
                        />
                      )}

                      {/* Stress-echo (DSE) ESC 2024 functional criteria panel (Voie 3) */}
                      {ev.test === "stress-echo" && !isUnavailable && (
                        <StressEchoContextPanel
                          params={ev.stressEchoParams ?? { ...DEFAULT_STRESS_ECHO_PARAMS }}
                          onChange={(p) => {
                            const anyHighRisk = p.segmentsGt3 || p.lvDilatation || p.efDrop
                            const nextOutcome: UIOutcome =
                              ev.outcome === "unavailable"
                                ? "unavailable"
                                : anyHighRisk
                                  ? "positive"
                                  : ev.outcome
                            updateEvent(i, { stressEchoParams: p, outcome: nextOutcome })
                          }}
                        />
                      )}
                    </div>
                  )
                })
              })()}
            </div>
          )}

          {/* Ajouter un test */}
          <button
            type="button"
            onClick={addEvent}
            className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[#c7d2fe] py-2.5 text-xs font-semibold text-[#6366f1] hover:bg-[#eef2ff] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Ajouter un test séquentiel
          </button>

          {/* Résultat final — 3 scénarios mutuellement exclusifs */}
          {events.length > 0 && scenario !== "none" && (
            <div className="space-y-3">
              {/* Post-test probability summary */}
              <div
                className="rounded-lg p-3 flex items-center justify-between gap-3"
                style={{
                  backgroundColor:
                    scenario === "all-positive" || scenario === "mixed-positive"
                      ? "#fef2f2"
                      : scenario === "discordant"
                      ? "#fefce8"
                      : "#f0fdf4",
                  borderWidth: 2,
                  borderStyle: "solid",
                  borderColor:
                    scenario === "all-positive" || scenario === "mixed-positive"
                      ? "#fca5a5"
                      : scenario === "discordant"
                      ? "#fde047"
                      : "#86efac",
                }}
              >
                <div>
                  <p
                    className="text-[10px] font-bold uppercase tracking-wide"
                    style={{
                      color:
                        scenario === "all-positive" || scenario === "mixed-positive"
                          ? "#b91c1c"
                          : scenario === "discordant"
                          ? "#854d0e"
                          : "#166534",
                    }}
                  >
                    Probabilité post-test finale
                  </p>
                  <p className="text-[10px] text-[#64748b] mt-0.5">
                    IC95 [{finalStep.ciLow.toFixed(0)}–{finalStep.ciHigh.toFixed(0)}%]
                  </p>
                </div>
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-3xl font-black"
                    style={{
                      color:
                        scenario === "all-positive" || scenario === "mixed-positive"
                          ? "#b91c1c"
                          : scenario === "discordant"
                          ? "#854d0e"
                          : "#166534",
                    }}
                  >
                    {finalStep.probability.toFixed(1)}%
                  </span>
                  <span
                    className="text-sm font-bold"
                    style={{ color: diagnosticGain > 0 ? "#b91c1c" : diagnosticGain < 0 ? "#15803d" : "#64748b" }}
                  >
                    {gainSign}{diagnosticGain.toFixed(1)} pts
                  </span>
                </div>
              </div>

              {/* Décision finale — synthèse UNIQUE des 4 voies ESC 2024 (Voie 1 probabiliste
                  + Voies 2/3/4 déjà saisies sur les panneaux CCTA/SPECT/écho de stress).
                  C'est LE verdict que le praticien doit lire en premier : indiquée ou non,
                  pourquoi, et avec quel niveau de confiance (largeur de l'IC95). */}
              <div
                className="rounded-lg border-2 p-3"
                style={{ backgroundColor: `${icaDecision.color}12`, borderColor: icaDecision.color }}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: icaDecision.color }}>
                      Décision finale — coronarographie
                    </p>
                    <p className="text-base font-black mt-0.5" style={{ color: icaDecision.color }}>
                      {icaDecision.icaIndicated ? "INDIQUÉE" : "NON INDIQUÉE"}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[9px] font-semibold text-[#94a3b8] uppercase tracking-wide mb-1">Confiance</p>
                    <div className="flex gap-0.5 justify-end">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: i < icaDecision.confidence ? icaDecision.color : "#e2e8f0" }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-xs font-semibold mt-2 leading-relaxed" style={{ color: icaDecision.color }}>
                  {icaDecision.label}
                </p>
                <p className="text-[11px] text-[#475569] mt-1 leading-relaxed">{icaDecision.rationale}</p>
                {icaDecision.metDetails.length > 0 && (
                  <ul className="mt-2 space-y-1 border-t pt-2" style={{ borderColor: `${icaDecision.color}30` }}>
                    {icaDecision.metDetails.map((d) => (
                      <li key={d.pathway} className="text-[10px] text-[#64748b] leading-relaxed">
                        · {d.pathwayLabel}
                        {d.triggers.length > 0 ? ` — ${d.triggers.join(" · ")}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Scenario 1 — all-negative / mixed-negative: exclusion */}
              {(scenario === "all-negative" || scenario === "mixed-negative") && (
                <div className="rounded-lg border-2 border-[#86efac] bg-[#f0fdf4] p-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-[#16a34a] flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#166534]">
                        {scenario === "all-negative"
                          ? "Séquence négative — CAD obstructive peu probable"
                          : "Séquence majoritairement négative — tendance à l'exclusion"}
                      </p>
                      <p className="text-[11px] text-[#166534] mt-1 leading-relaxed">
                        L&apos;ensemble des tests orientent vers l&apos;exclusion d&apos;une coronaropathie obstructive.
                        La probabilité post-test ({finalStep.probability.toFixed(1)} %) est{" "}
                        {finalStep.probability < 5
                          ? "très faible — coronarographie non indiquée."
                          : finalStep.probability < 15
                          ? "faible — envisager un CACS de reclassification si doute persistant."
                          : "résiduelle — un test fonctionnel complémentaire peut être discuté."}
                        {" "}En l&apos;absence d&apos;une des quatre voies ESC 2024, la coronarographie n&apos;est pas indiquée.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Scenario 2 — all-positive / mixed-positive: ESC 2024 four-pathway check */}
              {(scenario === "all-positive" || scenario === "mixed-positive") && (
                <EscFourPathwayPanel
                  postTestProb={finalStep.probability}
                  flags={pathwayFlags}
                />
              )}

              {/* Scenario 3 — discordant: conflicting tests */}
              {scenario === "discordant" && (
                <div className="rounded-lg border-2 border-[#fde047] bg-[#fefce8] p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#ca8a04] flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#854d0e]">
                        Résultats discordants — dépendance entre tests probable
                      </p>
                      <p className="text-[11px] text-[#854d0e] mt-1 leading-relaxed">
                        Les tests produisent des résultats contradictoires, ce qui suggère une dépendance
                        conditionnelle ou une hétérogénéité du tableau clinique. La coronarographie n&apos;est
                        pas la conclusion directe de cette discordance.
                      </p>
                      <p className="text-[11px] text-[#854d0e] mt-1.5 font-semibold">
                        Test recommandé pour trancher :{" "}
                        <span className="text-[#1e293b]">
                          {TEST_PERFORMANCE[bestTest].label} (LR+ = {TEST_PERFORMANCE[bestTest].lrPositive})
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Variation informative (sans seuil décisionnel) */}
              {(scenario === "all-positive" || scenario === "mixed-positive") && (
                <div className="rounded-lg border border-[#e0e7ff] bg-[#fafbff] px-3 py-2 flex items-center justify-between">
                  <span className="text-[11px] text-[#475569]">
                    Variation post-test vs pré-test
                  </span>
                  <span className="text-[11px] font-bold text-[#4338ca]">
                    +{gainAbs.toFixed(1)} pts
                    <span className="ml-1 font-normal text-[#94a3b8]">(informative — sans seuil décisionnel)</span>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Footnote */}
          <p className="text-[10px] text-[#94a3b8] leading-relaxed">
            Rapports de vraisemblance issus de la méta-analyse Knuuti et al. Eur Heart J 2018;39:3322-3330.
            La chaîne bayésienne quantifie la probabilité résiduelle et oriente le choix du prochain test ;
            elle ne crée pas à elle seule une indication de coronarographie (cf. quatre voies ESC 2024).
          </p>
        </div>
      )}
    </div>
  )
}

// ── ESC 2024 — quatre voies de coronarographie ───────────────────────────────

/**
 * Vérification séquentielle des quatre voies ESC 2024 qui peuvent justifier
 * une coronarographie après calcul bayésien. La chaîne bayésienne ne crée
 * pas à elle seule d'indication : l'ICA n'est retenue que si au moins UNE
 * des quatre voies est remplie.
 *
 * Voie 1 : probabilité clinique ajustée totale > 85 % (auto-évaluable).
 * Voie 2 : critère anatomique haut risque sur CCTA (TC ≥ 50 %, IVA prox. ≥ 70 %,
 *          tritronculaire avec FFR ≤ 0.80) — à vérifier par le clinicien.
 * Voie 3 : critère fonctionnel haut risque sur imagerie de stress
 *          (SPECT/TEP ≥ 10 % VG, DSE ≥ 3/16 segments, IRM ≥ 2 segments) —
 *          à vérifier par le clinicien.
 * Voie 4 : angor réfractaire malgré traitement médical double optimisé —
 *          à vérifier par le clinicien.
 *
 * Réf. : Vrints C et al., ESC Guidelines for CCS 2024, Eur Heart J
 *        2024;45:3415-3537.
 */
function EscFourPathwayPanel({
  postTestProb,
  flags,
}: {
  postTestProb: number
  flags?: {
    voie2: boolean
    voie2Bits: string[]
    voie3: boolean
    voie3Bits: string[]
    voie4: boolean
    voie4Bits: string[]
  }
}) {
  const voie1Met = postTestProb > 85
  const voie2Met = !!flags?.voie2
  const voie3Met = !!flags?.voie3
  const voie4Met = !!flags?.voie4

  // Renders one pathway row with red highlight when met, slate otherwise.
  const renderPathway = (
    n: 1 | 2 | 3 | 4,
    met: boolean,
    title: string,
    descriptionMet: React.ReactNode,
    descriptionDefault: React.ReactNode,
  ) => (
    <li
      className="rounded-md border px-2.5 py-2 flex items-start gap-2"
      style={{
        borderColor: met ? "#fca5a5" : "#e2e8f0",
        backgroundColor: met ? "#fef2f2" : "white",
      }}
    >
      <span
        className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
        style={{ backgroundColor: met ? "#dc2626" : "#94a3b8" }}
      >
        {met ? "✓" : n}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className="text-[11px] font-semibold leading-snug"
          style={{ color: met ? "#b91c1c" : "#1e293b" }}
        >
          {title}
        </p>
        <p className="text-[10px] text-[#64748b] mt-0.5 leading-relaxed">
          {met ? descriptionMet : descriptionDefault}
        </p>
      </div>
    </li>
  )

  return (
    <div className="rounded-lg border-2 border-[#c7d2fe] bg-[#fafbff] p-3 space-y-2.5">
      <div className="flex items-start gap-2">
        <Stethoscope className="w-4 h-4 text-[#4338ca] flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-xs font-bold text-[#1e293b]">
            Décision coronarographie — quatre voies ESC 2024
          </p>
          <p className="text-[11px] text-[#475569] mt-1 leading-relaxed">
            La chaîne bayésienne quantifie la probabilité post-test (
            <strong className="text-[#1e293b]">{postTestProb.toFixed(1)} %</strong>) mais{" "}
            <strong>ne crée pas à elle seule une indication</strong> de coronarographie. Les voies
            actives sont automatiquement détectées à partir des critères cochés sur CCTA / SPECT /
            écho de stress :
          </p>
        </div>
      </div>

      <ol className="space-y-1.5">
        {/* Voie 1 — auto-évaluée à partir de la probabilité */}
        {renderPathway(
          1,
          voie1Met,
          "Probabilité clinique ajustée totale > 85 %",
          `Critère rempli : ${postTestProb.toFixed(1)} % — voie 1 ESC 2024 active.`,
          `Probabilité actuelle : ${postTestProb.toFixed(1)} % — sous le seuil de 85 %.`,
        )}

        {/* Voie 2 — anatomique (auto à partir des critères CCTA cochés) */}
        {renderPathway(
          2,
          voie2Met,
          "Critère anatomique haut risque (CCTA)",
          <>
            Critère{flags && flags.voie2Bits.length > 1 ? "s" : ""} retenu
            {flags && flags.voie2Bits.length > 1 ? "s" : ""} :{" "}
            <strong className="text-[#7f1d1d]">
              {flags?.voie2Bits.join(" · ")}
            </strong>{" "}
            — voie 2 ESC 2024 active.
          </>,
          <>
            TC ≥ 50 % · IVA proximale ≥ 70 % · tritronculaire (FFR-CT ≤ 0,80).
            <span className="ml-1 italic text-[#94a3b8]">
              Cocher sur le menu CCTA ci-dessus.
            </span>
          </>,
        )}

        {/* Voie 3 — fonctionnel (auto à partir des critères SPECT / DSE cochés) */}
        {renderPathway(
          3,
          voie3Met,
          "Critère fonctionnel haut risque (imagerie de stress)",
          <>
            Critère{flags && flags.voie3Bits.length > 1 ? "s" : ""} retenu
            {flags && flags.voie3Bits.length > 1 ? "s" : ""} :{" "}
            <strong className="text-[#7f1d1d]">
              {flags?.voie3Bits.join(" · ")}
            </strong>{" "}
            — voie 3 ESC 2024 active.
          </>,
          <>
            SPECT/TEP ≥ 10 % VG · DSE &gt; 3 segments / 16 · IRM stress ≥ 2 segments.
            <span className="ml-1 italic text-[#94a3b8]">
              Cocher sur le menu SPECT ou écho de stress ci-dessus.
            </span>
          </>,
        )}

        {/* Voie 4 — angor réfractaire (saisi sur n'importe quel modalité) */}
        {renderPathway(
          4,
          voie4Met,
          "Angor réfractaire malgré TMO double optimisé",
          <>
            Critère retenu :{" "}
            <strong className="text-[#7f1d1d]">{flags?.voie4Bits.join(" · ")}</strong>{" "}
            — voie 4 ESC 2024 active (indépendante de la probabilité).
          </>,
          <>
            Persistance des symptômes sous bi-thérapie antiangineuse à dose optimale.
            <span className="ml-1 italic text-[#94a3b8]">
              À cocher sur le menu du test correspondant.
            </span>
          </>,
        )}
      </ol>

      <div className="rounded-md bg-white border border-[#c7d2fe] px-2.5 py-2">
        <p className="text-[10px] text-[#475569] leading-relaxed">
          <strong className="text-[#1e293b]">Si aucune des quatre voies n&apos;est remplie :</strong>{" "}
          la coronarographie n&apos;est pas indiquée selon ESC 2024, quelle que soit la
          variation calculée par la chaîne bayésienne. Poursuivre l&apos;orientation par tests
          non invasifs ou réévaluation clinique.
        </p>
      </div>
    </div>
  )
}

// ── Modifiers Panel ──────────────────────────────────────────────────────────

function ModifiersPanel({
  mods,
  onChange,
  accentColor,
}: {
  mods: ClinicalModifiers
  onChange: (m: ClinicalModifiers) => void
  accentColor: string
}) {
  const [expanded, setExpanded] = useState(true)

  const update = <K extends keyof ClinicalModifiers>(k: K, v: ClinicalModifiers[K]) => {
    onChange({ ...mods, [k]: v })
  }

  // Compteur de modificateurs actifs (hors disponibilités par défaut)
  const activeCount =
    (mods.ccta !== "rapide" ? 1 : 0) +
    (mods.ica !== "differe" ? 1 : 0) +
    (mods.irc !== "non" ? 1 : 0) +
    (mods.fa ? 1 : 0) +
    (mods.obesite ? 1 : 0) +
    (mods.fragilite ? 1 : 0) +
    (mods.allergieIode ? 1 : 0) +
    (mods.calcifMassives ? 1 : 0)

  return (
    <div className="rounded-xl border-2 border-[#e2e8f0] bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-[#f8fafc] transition-colors text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${accentColor}18` }}
          >
            <Settings2 className="w-4 h-4" style={{ color: accentColor }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#1e293b]">
              Contexte clinique &amp; disponibilité des examens
            </p>
            <p className="text-xs text-[#64748b] mt-0.5 leading-relaxed">
              Personnalise la conduite à tenir selon comorbidités et logistique
              {activeCount > 0 ? ` — ${activeCount} modificateur${activeCount > 1 ? "s" : ""} actif${activeCount > 1 ? "s" : ""}` : ""}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-[#94a3b8] flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[#94a3b8] flex-shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-[#f1f5f9] p-4 space-y-5">
          {/* Disponibilité des examens */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#64748b] mb-2">
              Disponibilité des examens
            </p>
            <div className="space-y-3">
              <SegmentedField
                label="Coroscanner (CCTA)"
                value={mods.ccta}
                onChange={(v) => update("ccta", v)}
                options={[
                  { value: "rapide", label: "Rapide", sub: "< 7 j" },
                  { value: "differe", label: "Différé", sub: "> 7 j" },
                  { value: "non-dispo", label: "Non dispo." },
                ]}
                accentColor={accentColor}
              />
              <SegmentedField
                label="Coronarographie ambulatoire (coro)"
                value={mods.ica}
                onChange={(v) => update("ica", v)}
                options={[
                  { value: "rapide", label: "Rapide", sub: "< 7 j" },
                  { value: "differe", label: "Différé", sub: "> 7 j" },
                  { value: "non-dispo", label: "Non dispo." },
                ]}
                accentColor={accentColor}
              />
            </div>
          </div>

          {/* IRC */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#64748b] mb-2">
              Insuffisance rénale
            </p>
            <SegmentedField
              label="Niveau d'IRC"
              value={mods.irc}
              onChange={(v) => update("irc", v as IRCLevel)}
              options={[
                { value: "non", label: "Non", sub: "DFG ≥ 45" },
                { value: "moderee", label: "Modérée", sub: "DFG 30–45" },
                { value: "severe", label: "Sévère", sub: "DFG < 30" },
              ]}
              accentColor={accentColor}
            />
          </div>

          {/* Comorbidités */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#64748b] mb-2">
              Comorbidités &amp; particularités
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <ToggleChip
                label="Fibrillation atriale / arythmie"
                value={mods.fa}
                onChange={(v) => update("fa", v)}
                accentColor={accentColor}
              />
              <ToggleChip
                label="Obésité morbide (IMC > 40)"
                value={mods.obesite}
                onChange={(v) => update("obesite", v)}
                accentColor={accentColor}
              />
              <ToggleChip
                label="Fragilité / âge > 80 ans"
                value={mods.fragilite}
                onChange={(v) => update("fragilite", v)}
                accentColor={accentColor}
              />
              <ToggleChip
                label="Allergie iode / asthme sévère"
                value={mods.allergieIode}
                onChange={(v) => update("allergieIode", v)}
                accentColor={accentColor}
              />
              <ToggleChip
                label="Calcifications massives (CACS ≥ 400)"
                value={mods.calcifMassives}
                onChange={(v) => update("calcifMassives", v)}
                accentColor={accentColor}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SegmentedField<T extends string>({
  label,
  value,
  onChange,
  options,
  accentColor,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; sub?: string }[]
  accentColor: string
}) {
  return (
    <div>
      <p className="text-xs font-medium text-[#475569] mb-1.5">{label}</p>
      <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-[#f1f5f9]">
        {options.map((opt) => {
          const active = opt.value === value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className="rounded-md py-2 px-1 text-xs font-semibold transition-all"
              style={{
                backgroundColor: active ? "white" : "transparent",
                color: active ? accentColor : "#64748b",
                boxShadow: active ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
              }}
            >
              <div>{opt.label}</div>
              {opt.sub && (
                <div
                  className="text-[10px] font-normal mt-0.5"
                  style={{ color: active ? accentColor : "#94a3b8" }}
                >
                  {opt.sub}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ToggleChip({
  label,
  value,
  onChange,
  accentColor,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
  accentColor: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors"
      style={{
        borderColor: value ? accentColor : "#e2e8f0",
        backgroundColor: value ? `${accentColor}10` : "white",
      }}
      aria-pressed={value}
    >
      <span
        className="w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors"
        style={{
          borderColor: value ? accentColor : "#cbd5e1",
          backgroundColor: value ? accentColor : "white",
        }}
      >
        {value && (
          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
      <span
        className="text-xs font-medium leading-tight"
        style={{ color: value ? accentColor : "#475569" }}
      >
        {label}
      </span>
    </button>
  )
}

// ── Pathway Block ────────────────────────────────────────────────────────────

const EXAM_ICON: Record<PathwayStep["exam"], typeof Activity> = {
  ccta: Activity,
  cacs: Sparkles,
  "irm-stress": Activity,
  scinti: Activity,
  "echo-stress": Activity,
  ica: Stethoscope,
  rassurance: CheckCircle,
}

const CLASSE_BADGE: Record<NonNullable<PathwayStep["classe"]>, { label: string; bg: string; color: string }> = {
  I: { label: "Classe I", bg: "#dcfce7", color: "#15803d" },
  IIa: { label: "Classe IIa", bg: "#fef3c7", color: "#b45309" },
  IIb: { label: "Classe IIb", bg: "#e0e7ff", color: "#4338ca" },
}

function PathwayBlock({
  recommendation,
  accentColor,
  accentBg,
}: {
  recommendation: PathwayRecommendation
  accentColor: string
  accentBg: string
}) {
  if (recommendation.steps.length === 0) return null

  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white overflow-hidden">
      <div
        className="px-4 py-3 flex items-center gap-2 border-b border-[#f1f5f9]"
        style={{ backgroundColor: accentBg }}
      >
        <Stethoscope className="w-4 h-4" style={{ color: accentColor }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: accentColor }}>
            Premier examen recommandé
          </p>
          <p className="text-[10px] text-[#94a3b8]">
            Orientation initiale à partir du RF-CL pré-test — la décision finale après résultats est plus bas
          </p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Résumé */}
        <p className="text-xs leading-relaxed text-[#475569] bg-[#f8fafc] rounded-lg px-3 py-2 border border-[#e2e8f0]">
          {recommendation.rationaleSummary}
        </p>

        {/* Flags / alertes */}
        {recommendation.flags.length > 0 && (
          <div className="space-y-2">
            {recommendation.flags.map((flag, i) => (
              <FlagBanner key={i} flag={flag} />
            ))}
          </div>
        )}

        {/* Steps */}
        <div className="space-y-2.5">
          {recommendation.steps.map((step) => (
            <StepCard key={`${step.rank}-${step.exam}`} step={step} accentColor={accentColor} />
          ))}
        </div>

        {/* Contre-indications / précautions */}
        {recommendation.contraindications.length > 0 && (
          <div className="rounded-lg border border-[#fcd34d] bg-[#fffbeb] p-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-[#b45309]" />
              <p className="text-xs font-bold text-[#b45309]">Précautions liées au contexte</p>
            </div>
            <ul className="space-y-1.5">
              {recommendation.contraindications.map((ci, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-[#78350f] leading-relaxed">
                  <span className="w-1 h-1 rounded-full bg-[#b45309] flex-shrink-0 mt-1.5" />
                  <span>{ci}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

function StepCard({ step, accentColor }: { step: PathwayStep; accentColor: string }) {
  const Icon = EXAM_ICON[step.exam]
  const classe = step.classe ? CLASSE_BADGE[step.classe] : null

  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-white p-3">
      <div className="flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
          style={{ backgroundColor: accentColor }}
        >
          {step.rank}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: accentColor }} />
              <p className="text-sm font-semibold text-[#1e293b] leading-snug">{step.label}</p>
            </div>
            {classe && (
              <span
                className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: classe.bg, color: classe.color }}
              >
                {classe.label}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs">
            <Clock className="w-3 h-3 text-[#94a3b8] flex-shrink-0" />
            <span className="font-medium text-[#475569]">{step.delai}</span>
          </div>
          <p className="text-xs text-[#64748b] mt-2 leading-relaxed">{step.rationale}</p>
        </div>
      </div>
    </div>
  )
}

function FlagBanner({ flag }: { flag: PathwayRecommendation["flags"][number] }) {
  const styles = {
    info: { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" },
    warning: { bg: "#fffbeb", border: "#fcd34d", color: "#b45309" },
    danger: { bg: "#fef2f2", border: "#fca5a5", color: "#b91c1c" },
  }[flag.type]

  return (
    <div
      className="rounded-lg border p-2.5 flex items-start gap-2"
      style={{ backgroundColor: styles.bg, borderColor: styles.border }}
    >
      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: styles.color }} />
      <div className="min-w-0">
        <p className="text-xs font-bold" style={{ color: styles.color }}>
          {flag.title}
        </p>
        <p className="text-xs text-[#475569] mt-0.5 leading-relaxed">{flag.message}</p>
      </div>
    </div>
  )
}

// ── Category 1: Très faible ───────────────────────────────────────────────────
function CategoryTresFaible() {
  return (
    <div className="space-y-4">
      <Panel color="#15803d" title="Diagnostic ESC 2024" icon={<CheckCircle className="w-4 h-4" />}>
        <p className="text-sm text-[#1e293b]">Maladie coronarienne obstructive <strong>très peu probable</strong></p>
      </Panel>

      <Panel color="#15803d" title="Conduite à tenir (Classe IIa, ESC 2024)" icon={<FileText className="w-4 h-4" />}>
        <ul className="space-y-2 text-sm text-[#1e293b]">
          <BulletItem>Pas d'exploration coronarienne complémentaire recommandée en première intention</BulletItem>
          <BulletItem>Rechercher un diagnostic alternatif (musculo-squelettique, digestif, anxiété, pleuro-pulmonaire)</BulletItem>
          <BulletItem>ECG 12 dérivations si non réalisé</BulletItem>
          <BulletItem>Bilan biologique de base (troponine hs si doute, NFS, CRP)</BulletItem>
        </ul>
      </Panel>

      <Panel color="#15803d" title="Score calcique à considérer si" icon={<CheckCircle className="w-4 h-4" />}>
        <ul className="space-y-1.5 text-sm text-[#1e293b]">
          <BulletItem>Doute diagnostique persistant malgré clinique rassurante</BulletItem>
          <BulletItem>Patient très anxieux nécessitant reclassification formelle</BulletItem>
        </ul>
        <div className="mt-3 space-y-1.5">
          <div className="flex items-start gap-2 bg-[#f0fdf4] border border-[#86efac] rounded-lg p-2.5 text-xs">
            <span className="font-bold text-[#15803d] flex-shrink-0">CACS = 0</span>
            <span className="text-[#166534]">Rassurance, fermeture du bilan coronarien</span>
          </div>
          <div className="flex items-start gap-2 bg-[#fffbeb] border border-[#fcd34d] rounded-lg p-2.5 text-xs">
            <span className="font-bold text-[#d97706] flex-shrink-0">CACS {">"} 0</span>
            <span className="text-[#78350f]">Réévaluation clinique et cardiologique</span>
          </div>
        </div>
      </Panel>

      <Panel color="#15803d" title="Organisation du suivi" icon={<Clock className="w-4 h-4" />}>
        <div className="space-y-2 text-sm">
          <InfoRow label="Consultation cardiologique" value="Non urgente — programmée si symptômes persistants > 4 semaines" />
          <InfoRow label="Suivi médecin traitant" value="À 4–8 semaines ou si aggravation" />
        </div>
      </Panel>
    </div>
  )
}

// ── Category 2: Faible ────────────────────────────────────────────────────────
function CategoryFaible() {
  return (
    <div className="space-y-4">
      <Panel color="#16a34a" title="Diagnostic ESC 2024" icon={<CheckCircle className="w-4 h-4" />}>
        <p className="text-sm text-[#1e293b]">Maladie coronarienne obstructive <strong>peu probable mais non exclue</strong></p>
      </Panel>

      <Panel color="#16a34a" title="Stratégie de reclassification (Classe I — ESC 2024)" icon={<FileText className="w-4 h-4" />}>
        <p className="text-sm font-semibold text-[#15803d] mb-3">Score calcique coronarien (CACS) en première intention</p>
        <div className="space-y-2">
          {[
            { cacs: "CACS = 0", action: "Reclasser RF-CL ≤ 5% → pas d'exploration complémentaire", color: "#15803d", bg: "#f0fdf4", border: "#86efac" },
            { cacs: "CACS 1–99", action: "Coroscanner (CCTA) à envisager (Classe IIa)", color: "#d97706", bg: "#fffbeb", border: "#fcd34d" },
            { cacs: "CACS ≥ 100", action: "CCTA recommandé (Classe I) OU test d'ischémie", color: "#d97706", bg: "#fffbeb", border: "#fcd34d" },
            { cacs: "CACS ≥ 400", action: "IRM de stress ou scintigraphie myocardique (CCTA limité par calcifications)", color: "#dc2626", bg: "#fef2f2", border: "#fca5a5" },
          ].map((row) => (
            <div
              key={row.cacs}
              className="flex items-start gap-3 rounded-lg border p-2.5"
              style={{ borderColor: row.border, backgroundColor: row.bg }}
            >
              <span className="text-xs font-bold flex-shrink-0 mt-0.5" style={{ color: row.color }}>{row.cacs}</span>
              <span className="text-xs text-[#1e293b]">{row.action}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel color="#16a34a" title="Consultation cardiologique" icon={<Clock className="w-4 h-4" />}>
        <div className="space-y-2 text-sm">
          <AlertRow type="urgent">Dans les 7 jours si douleur récurrente / aggravation / CACS {">"} 0</AlertRow>
          <InfoRow label="Sinon" value="Consultation programmée dans les 4 semaines" />
          <InfoRow label="Ordonnance à rédiger" value="CACS (scanner thoracique non injecté faible dose)" />
        </div>
      </Panel>
    </div>
  )
}

// ── Category 3: Intermédiaire — extras (alertes urgences + médicaments) ──────
function CategoryIntermediaireExtras() {
  return (
    <div className="space-y-4">
      <Panel color="#d97706" title="Mesures médicamenteuses en attente du bilan" icon={<Pill className="w-4 h-4" />}>
        <ul className="space-y-1.5 text-sm text-[#1e293b]">
          <BulletItem>Trinitrine spray 0.3 mg SL en réserve (si non contre-indiqué)</BulletItem>
          <BulletItem>Aspirine 75–100 mg/j si forte suspicion et pas de CI (à discuter avec cardiologue)</BulletItem>
          <BulletItem>Bêtabloquant ou inhibiteur calcique si angor fréquent (après avis cardiologue)</BulletItem>
        </ul>
      </Panel>
    </div>
  )
}

// ── Category 4: Élevée — extras (alerte cardiologue + symptômes aigus) ───────
function CategoryEleveeExtras() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border-2 border-[#dc2626] bg-[#fef2f2] p-4 flex items-start gap-3">
        <Phone className="w-5 h-5 text-[#dc2626] flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-[#dc2626]">APPEL DU CARDIOLOGUE DE GARDE</p>
          <p className="text-xs text-[#7f1d1d] mt-1">Consultation d'urgence dans les 24–48h</p>
        </div>
      </div>

      <Panel color="#dc2626" title="Si douleur active ou récente (< 24h)" icon={<AlertTriangle className="w-4 h-4" />}>
        <ul className="space-y-2 text-sm">
          <BulletItem>ECG urgent + troponine hs (H0)</BulletItem>
          <BulletItem urgent>Si troponine élevée ou ECG modifié → APPEL DU 15 — orientation SAU/USIC</BulletItem>
          <BulletItem>Si troponine normale et ECG normal → consultation cardiologique dans les 24h</BulletItem>
        </ul>
      </Panel>

      <Panel color="#dc2626" title="Mesures immédiates" icon={<Pill className="w-4 h-4" />}>
        <ul className="space-y-1.5 text-sm text-[#1e293b]">
          <BulletItem>Aspirine 250–500 mg PO (si pas de CI, allergie, anticoagulant)</BulletItem>
          <BulletItem>Trinitrine SL 0.3 mg si PA {">"} 100 mmHg</BulletItem>
          <BulletItem urgent>Ne pas laisser partir le patient seul</BulletItem>
        </ul>
        <div className="mt-3 p-2.5 rounded-lg bg-[#fef2f2] border border-[#fca5a5] text-xs">
          <p className="font-bold text-[#dc2626] mb-1">Hospitalisation si :</p>
          <p className="text-[#7f1d1d]">Douleur au repos persistante, instabilité hémodynamique, modifications ECG</p>
        </div>
      </Panel>
    </div>
  )
}

// ── Category 5: Très élevée ───────────────────────────────────────────────────
function CategoryTresElevee() {
  const measures = [
    "ECG 12 dérivations (+ V7-V8-V9 si IDM postérieur suspecté, + V3R-V4R si IDM VD)",
    "Voie veineuse périphérique si possible",
    "Aspirine 250–500 mg PO (sauf allergie / anticoagulant actif)",
    "Trinitrine SL 0.3 mg si TAS > 100 mmHg et pas de sténose aortique sévère connue",
    "O₂ UNIQUEMENT si SpO₂ < 90% — ne pas administrer si SpO₂ normale (ESC 2023)",
    "Position demi-assise, repos strict, scope si disponible",
  ]
  const contraindications = [
    "NE PAS administrer Ticagrélor ou Clopidogrel sans accord cardiologique (risque saignement, CI si chirurgie urgente)",
    "NE PAS administrer Morphine (diminue absorption aspirine, mauvais pronostic — ESC 2023)",
    "JAMAIS laisser partir seul. NE PAS faire conduire par un proche.",
  ]

  return (
    <div className="space-y-4">
      {/* Big alert */}
      <div className="rounded-xl border-4 border-[#991b1b] bg-[#fef2f2] p-5">
        <div className="flex flex-col items-center gap-3 text-center mb-5">
          <div className="w-14 h-14 rounded-full bg-[#991b1b] flex items-center justify-center">
            <Phone className="w-7 h-7 text-white" />
          </div>
          <div>
            <p className="text-xl font-black text-[#991b1b] uppercase">APPEL IMMÉDIAT DU 15 — SAMU</p>
            <p className="text-sm text-[#7f1d1d] mt-1">Orientation USIC / SAU — Ne pas laisser le patient seul</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-white rounded-lg border border-[#fca5a5] p-4">
            <p className="text-xs font-bold text-[#991b1b] uppercase tracking-wide mb-3">Mesures en attente du SMUR</p>
            <ul className="space-y-2">
              {measures.map((m, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[#1e293b]">
                  <span className="w-5 h-5 rounded-full bg-[#fef2f2] border border-[#fca5a5] flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-[#991b1b] mt-0.5">{i + 1}</span>
                  {m}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-[#7f1d1d] rounded-lg p-4">
            <p className="text-xs font-bold text-[#fca5a5] uppercase tracking-wide mb-3">Contre-indications formelles</p>
            <ul className="space-y-2">
              {contraindications.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-white font-semibold">
                  <AlertTriangle className="w-4 h-4 text-[#fca5a5] flex-shrink-0 mt-0.5" />
                  {c}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-lg border border-[#fca5a5] p-4">
            <p className="text-xs font-bold text-[#991b1b] uppercase tracking-wide mb-3">Destination selon ECG</p>
            <div className="space-y-2 text-sm text-[#1e293b]">
              <div className="flex items-start gap-2">
                <span className="w-2 h-2 rounded-full bg-[#dc2626] flex-shrink-0 mt-2" />
                <span><strong>Sus-décalage ST</strong> → Centre d'ICP primaire (délai symptômes-ballon {"<"} 120 min)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-2 h-2 rounded-full bg-[#991b1b] flex-shrink-0 mt-2" />
                <span><strong>Pas de sus-décalage</strong> → USIC avec plateau de cardiologie interventionnelle</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Helper sub-components ─────────────────────────────────────────────────────
function Panel({
  color,
  title,
  icon,
  children,
}: {
  color: string
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-2 border-b border-[#f1f5f9]" style={{ backgroundColor: `${color}12` }}>
        <span style={{ color }}>{icon}</span>
        <p className="text-sm font-semibold" style={{ color }}>{title}</p>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function BulletItem({ children, urgent = false }: { children: React.ReactNode; urgent?: boolean }) {
  return (
    <li className="flex items-start gap-2">
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-2"
        style={{ backgroundColor: urgent ? "#dc2626" : "#94a3b8" }}
      />
      <span className={urgent ? "font-semibold text-[#dc2626]" : ""}>{children}</span>
    </li>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1">
      <span className="text-xs font-semibold text-[#64748b] sm:w-40 flex-shrink-0">{label} :</span>
      <span className="text-sm text-[#1e293b]">{value}</span>
    </div>
  )
}

function AlertRow({ type, children }: { type: "urgent" | "info"; children: React.ReactNode }) {
  return (
    <div
      className={`flex items-start gap-2 rounded-lg p-2.5 ${
        type === "urgent" ? "bg-[#fef2f2] border border-[#fca5a5]" : "bg-[#f0f9ff] border border-[#bae6fd]"
      }`}
    >
      <AlertTriangle
        className={`w-4 h-4 flex-shrink-0 mt-0.5 ${type === "urgent" ? "text-[#dc2626]" : "text-[#0369a1]"}`}
      />
      <span className={`text-xs font-medium ${type === "urgent" ? "text-[#7f1d1d]" : "text-[#0c4a6e]"}`}>{children}</span>
    </div>
  )
}


