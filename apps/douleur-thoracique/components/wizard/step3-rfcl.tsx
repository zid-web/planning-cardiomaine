"use client"

import { useState, useMemo } from "react"
import type { SymptomType, Step2Data } from "./step2-symptoms"
import { computeCACSCLFromBin, type CACSBin } from "@/lib/cacs-cl"
import { AnocaIndicativePanel } from "./anoca-panel"

export type AgeRange = "30-39" | "40-49" | "50-59" | "60-69" | "70+"
export type RFCategory = "0-1" | "2-3" | "4-5"
export type Sex = "homme" | "femme"
/** Classes CACS d'Agatston du modèle Winther 2020 (+ "unknown" si non réalisé). */
export type CACSValue = "unknown" | "zero" | "1-9" | "10-99" | "100-399" | "400-999" | "1000+"

export interface Step3Data {
  sex: Sex
  ageRange: AgeRange
  rfCount: number
  rfChecked: Record<string, boolean>
  rfCategory: RFCategory
  baseRFCL: number
  modifiers: {
    atcdCoronaire: boolean
    ecgIschemique: boolean
    dvgFEVG: boolean
    cacs: CACSValue
  }
  adjustedRFCL: number
  finalCategory: "tres-faible" | "faible" | "intermediaire" | "elevee" | "tres-elevee"
}

// ── RF-CL Table ──────────────────────────────────────────────────────────────
// Source : Winther S, Schmidt SE, Mayrhofer T, et al. "Incorporating Coronary
// Calcification Into Pre-Test Assessment of the Likelihood of Coronary Artery
// Disease." J Am Coll Cardiol. 2020;76(21):2421-2432 — Central Illustration,
// Panel A ("Risk Factor-Weighted Clinical Likelihood"). Values are the model
// estimates for patients aged 35, 45, 55, 65, and 75 years (age-band
// midpoints). "Atypical Angina or Dyspnea" is a single pooled column in the
// source (validated as having similar predictive values) and is reused here
// for both "atypique" and "non-coronarien".
const RFCL_TABLE: Record<Sex, Record<AgeRange, Record<RFCategory, Record<SymptomType & string, number>>>> = {
  homme: {
    "30-39": { "0-1": { typique: 9, atypique: 2, "non-angineux": 1, "non-coronarien": 1 }, "2-3": { typique: 14, atypique: 4, "non-angineux": 2, "non-coronarien": 2 }, "4-5": { typique: 22, atypique: 8, "non-angineux": 5, "non-coronarien": 5 } },
    "40-49": { "0-1": { typique: 14, atypique: 3, "non-angineux": 2, "non-coronarien": 2 }, "2-3": { typique: 20, atypique: 6, "non-angineux": 4, "non-coronarien": 4 }, "4-5": { typique: 27, atypique: 12, "non-angineux": 8, "non-coronarien": 8 } },
    "50-59": { "0-1": { typique: 21, atypique: 6, "non-angineux": 4, "non-coronarien": 4 }, "2-3": { typique: 27, atypique: 11, "non-angineux": 7, "non-coronarien": 7 }, "4-5": { typique: 33, atypique: 17, "non-angineux": 12, "non-coronarien": 12 } },
    "60-69": { "0-1": { typique: 32, atypique: 12, "non-angineux": 8, "non-coronarien": 8 }, "2-3": { typique: 35, atypique: 17, "non-angineux": 12, "non-coronarien": 12 }, "4-5": { typique: 39, atypique: 25, "non-angineux": 17, "non-coronarien": 17 } },
    "70+":   { "0-1": { typique: 44, atypique: 22, "non-angineux": 15, "non-coronarien": 15 }, "2-3": { typique: 44, atypique: 27, "non-angineux": 19, "non-coronarien": 19 }, "4-5": { typique: 45, atypique: 34, "non-angineux": 24, "non-coronarien": 24 } },
  },
  femme: {
    "30-39": { "0-1": { typique: 2, atypique: 0, "non-angineux": 0, "non-coronarien": 0 }, "2-3": { typique: 5, atypique: 1, "non-angineux": 1, "non-coronarien": 1 }, "4-5": { typique: 10, atypique: 3, "non-angineux": 2, "non-coronarien": 2 } },
    "40-49": { "0-1": { typique: 4, atypique: 1, "non-angineux": 1, "non-coronarien": 1 }, "2-3": { typique: 7, atypique: 2, "non-angineux": 1, "non-coronarien": 1 }, "4-5": { typique: 12, atypique: 5, "non-angineux": 3, "non-coronarien": 3 } },
    "50-59": { "0-1": { typique: 6, atypique: 2, "non-angineux": 1, "non-coronarien": 1 }, "2-3": { typique: 10, atypique: 3, "non-angineux": 2, "non-coronarien": 2 }, "4-5": { typique: 15, atypique: 7, "non-angineux": 5, "non-coronarien": 5 } },
    "60-69": { "0-1": { typique: 10, atypique: 3, "non-angineux": 2, "non-coronarien": 2 }, "2-3": { typique: 14, atypique: 6, "non-angineux": 4, "non-coronarien": 4 }, "4-5": { typique: 19, atypique: 11, "non-angineux": 7, "non-coronarien": 7 } },
    "70+":   { "0-1": { typique: 16, atypique: 6, "non-angineux": 4, "non-coronarien": 4 }, "2-3": { typique: 19, atypique: 10, "non-angineux": 7, "non-coronarien": 7 }, "4-5": { typique: 23, atypique: 16, "non-angineux": 11, "non-coronarien": 11 } },
  },
}

const AGE_RANGES: AgeRange[] = ["30-39", "40-49", "50-59", "60-69", "70+"]
const RF_CATS: RFCategory[] = ["0-1", "2-3", "4-5"]
const SYMPTOM_COLS: { key: SymptomType; label: string }[] = [
  { key: "typique", label: "Angor typique" },
  { key: "atypique", label: "Angor atypique" },
  { key: "non-angineux", label: "Non-angineux" },
]

const RISK_FACTORS = [
  { id: "tabac", label: "Tabagisme actif ou sevré < 3 ans" },
  { id: "diabete", label: "Diabète" },
  { id: "dyslipidemie", label: "Dyslipidémie (LDL élevé ou traitement en cours)" },
  { id: "hta", label: "HTA (ou traitement antihypertenseur)" },
  { id: "antecedent", label: "Antécédent familial de coronaropathie précoce (< 55 ans H / < 65 ans F)" },
]

function getRFCategory(count: number): RFCategory {
  if (count <= 1) return "0-1"
  if (count <= 3) return "2-3"
  return "4-5"
}

function getFinalCategory(pct: number): Step3Data["finalCategory"] {
  if (pct <= 5) return "tres-faible"
  if (pct <= 15) return "faible"
  if (pct <= 50) return "intermediaire"
  if (pct <= 85) return "elevee"
  return "tres-elevee"
}

/** Map CACSValue (UI) → CACSBin (modèle Winther 2020). */
function cacsValueToBin(v: CACSValue): CACSBin | null {
  switch (v) {
    case "zero":
      return "0"
    case "1-9":
      return "1-9"
    case "10-99":
      return "10-99"
    case "100-399":
      return "100-399"
    case "400-999":
      return "400-999"
    case "1000+":
      return ">=1000"
    default:
      return null
  }
}

/**
 * Application des modificateurs sur la probabilité RF-CL :
 *   1. Si CACS connu → on remplace RF-CL par CACS-CL (formule de régression
 *      linéaire publiée par Winther et al., JACC 2020 — coefficients bruts
 *      issus de la Table S3).
 *   2. On ajoute ensuite les modificateurs cliniques ESC 2024 (ATCD coro,
 *      ECG ischémique, dysfonction VG) qui ne sont pas dans le modèle
 *      original mais sont des reclassifieurs cliniques recommandés.
 */
function applyModifiers(
  base: number,
  mods: Step3Data["modifiers"]
): number {
  // Étape 1 : CACS-CL via la formule du papier original
  const bin = cacsValueToBin(mods.cacs)
  let p = bin !== null ? computeCACSCLFromBin(base, bin) : base

  // Étape 2 : modificateurs cliniques additionnels (ESC 2024)
  if (mods.atcdCoronaire) p = Math.min(95, p + 15)
  if (mods.ecgIschemique) p = Math.min(95, p + 10)
  if (mods.dvgFEVG) p = Math.min(95, p + 10)

  return Math.max(0, Math.min(95, Math.round(p)))
}

const CACS_OPTIONS: { value: CACSValue; label: string; desc: string }[] = [
  { value: "unknown", label: "Non réalisé / inconnu", desc: "" },
  { value: "zero", label: "CACS = 0", desc: "Reclassification forte vers le bas (Winther 2020)" },
  { value: "1-9", label: "CACS 1–9", desc: "Reclassification modérée vers le bas" },
  { value: "10-99", label: "CACS 10–99", desc: "Légère reclassification" },
  { value: "100-399", label: "CACS 100–399", desc: "Reclassification vers le haut" },
  { value: "400-999", label: "CACS 400–999", desc: "Reclassification forte vers le haut" },
  { value: "1000+", label: "CACS ≥ 1000", desc: "Reclassification très forte vers le haut" },
]

interface Step3Props {
  symptomData?: Step2Data
  onNext?: (data: Step3Data) => void
  onPrev?: () => void
  /** Mode autonome : permet de choisir le type de douleur dans le composant. */
  standalone?: boolean
}

export function Step3RFCL({ symptomData, onNext, onPrev, standalone = false }: Step3Props) {
  const [sex, setSex] = useState<Sex>("homme")
  const [ageRange, setAgeRange] = useState<AgeRange | null>(null)
  const [rfChecked, setRfChecked] = useState<Record<string, boolean>>({})
  const [localSymptom, setLocalSymptom] = useState<SymptomType>("typique")
  const [modifiers, setModifiers] = useState<Step3Data["modifiers"]>({
    atcdCoronaire: false,
    ecgIschemique: false,
    dvgFEVG: false,
    cacs: "unknown",
  })

  const symptomType: SymptomType = symptomData
    ? (symptomData.symptomType === "non-coronarien" ? "non-coronarien" : symptomData.symptomType)
    : localSymptom

  const rfCount = Object.values(rfChecked).filter(Boolean).length
  const rfCategory = getRFCategory(rfCount)

  const baseRFCL = useMemo(() => {
    if (!ageRange) return null
    const st = symptomType ?? "non-coronarien"
    return RFCL_TABLE[sex][ageRange][rfCategory][st as keyof (typeof RFCL_TABLE)["homme"]["30-39"]["0-1"]]
  }, [sex, ageRange, rfCategory, symptomType])

  const adjustedRFCL = useMemo(() => {
    if (baseRFCL === null) return null
    return applyModifiers(baseRFCL, modifiers)
  }, [baseRFCL, modifiers])

  const finalCategory = adjustedRFCL !== null ? getFinalCategory(adjustedRFCL) : null
  const cacsBin = useMemo(() => cacsValueToBin(modifiers.cacs), [modifiers.cacs])

  const canProceed = ageRange !== null && adjustedRFCL !== null

  const handleNext = () => {
    if (!ageRange || adjustedRFCL === null || baseRFCL === null || !finalCategory || !onNext) return
    onNext({
      sex,
      ageRange,
      rfCount,
      rfChecked,
      rfCategory,
      baseRFCL,
      modifiers,
      adjustedRFCL,
      finalCategory,
    })
  }

  const symptomLabel =
    symptomType === "typique"
      ? "Angor typique"
      : symptomType === "atypique"
      ? "Angor atypique"
      : symptomType === "non-angineux"
      ? "Non-angineux"
      : "Non-coronarien"

  const SYMPTOM_OPTIONS: { value: NonNullable<SymptomType>; label: string }[] = [
    { value: "typique", label: "Angor typique" },
    { value: "atypique", label: "Angor atypique" },
    { value: "non-angineux", label: "Non-angineux" },
    { value: "non-coronarien", label: "Non-coronarien" },
  ]

  return (
    <div className="space-y-6">
      {/* Symptom selector — standalone mode */}
      {standalone ? (
        <div>
          <p className="text-sm font-semibold text-[#1e293b] mb-2">
            Type de douleur thoracique <span className="text-[#dc2626]">*</span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SYMPTOM_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setLocalSymptom(o.value)}
                className={`py-2.5 px-3 rounded-lg text-xs font-semibold border-2 transition-all touch-target ${
                  localSymptom === o.value
                    ? "bg-[#1d4ed8] border-[#1d4ed8] text-white"
                    : "bg-white border-[#e2e8f0] text-[#475569] hover:border-[#94a3b8]"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-[#64748b] mt-2 leading-relaxed">
            Classification ESC 2024 — Typique : 3/3 critères · Atypique : 2/3 · Non-angineux : 1/3 · Non-coronarien : 0/3
          </p>
        </div>
      ) : (
        <div className="bg-[#eff6ff] border border-[#93c5fd] rounded-xl p-3 flex items-center gap-3">
          <span className="text-xs font-medium text-[#1d4ed8]">Type de douleur importé de l&apos;étape 2 :</span>
          <span className="text-xs font-bold text-[#1e40af] bg-[#dbeafe] px-2 py-0.5 rounded-full">{symptomLabel}</span>
        </div>
      )}

      {/* Sex selector */}
      <div>
        <p className="text-sm font-semibold text-[#1e293b] mb-2">Sexe</p>
        <div className="grid grid-cols-2 gap-3">
          {(["homme", "femme"] as Sex[]).map((s) => (
            <button
              key={s}
              onClick={() => setSex(s)}
              className={`py-3 rounded-xl text-sm font-semibold border-2 transition-all touch-target capitalize ${
                sex === s
                  ? "bg-[#1e293b] border-[#1e293b] text-white"
                  : "bg-white border-[#e2e8f0] text-[#475569] hover:border-[#94a3b8]"
              }`}
            >
              {s === "homme" ? "Homme" : "Femme"}
            </button>
          ))}
        </div>
      </div>

      {/* Age range */}
      <div>
        <p className="text-sm font-semibold text-[#1e293b] mb-2">
          Tranche d'âge <span className="text-[#dc2626]">*</span>
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {AGE_RANGES.map((a) => (
            <button
              key={a}
              onClick={() => setAgeRange(a)}
              className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-all touch-target ${
                ageRange === a
                  ? "bg-[#1e293b] border-[#1e293b] text-white"
                  : "bg-white border-[#e2e8f0] text-[#475569] hover:border-[#94a3b8]"
              }`}
            >
              {a === "70+" ? "≥70" : a}
            </button>
          ))}
        </div>
      </div>

      {/* Risk factors */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-[#1e293b]">Facteurs de risque cardiovasculaire</p>
          <span className="text-xs font-bold text-white bg-[#1e293b] rounded-full px-2.5 py-0.5">
            {rfCount} / 5 — catégorie {rfCategory}
          </span>
        </div>
        <div className="space-y-2">
          {RISK_FACTORS.map((rf) => (
            <label
              key={rf.id}
              className={`flex items-center gap-3 rounded-xl border-2 p-3 cursor-pointer transition-all ${
                rfChecked[rf.id] ? "border-[#1e293b] bg-[#f8fafc]" : "border-[#e2e8f0] bg-white"
              }`}
            >
              <div
                className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                  rfChecked[rf.id] ? "bg-[#1e293b] border-[#1e293b]" : "border-[#cbd5e1] bg-white"
                }`}
                onClick={() => setRfChecked((prev) => ({ ...prev, [rf.id]: !prev[rf.id] }))}
              >
                {rfChecked[rf.id] && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span
                className="text-sm text-[#1e293b] leading-relaxed"
                onClick={() => setRfChecked((prev) => ({ ...prev, [rf.id]: !prev[rf.id] }))}
              >
                {rf.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* RF-CL Interactive Table */}
      {ageRange && (
        <div>
          <p className="text-sm font-semibold text-[#1e293b] mb-3">
            Table RF-CL — {sex === "homme" ? "Homme" : "Femme"}, {ageRange === "70+" ? "≥70" : ageRange} ans
          </p>
          <div className="overflow-x-auto rounded-xl border border-[#e2e8f0]">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#f8fafc]">
                  <th className="text-left p-3 font-semibold text-[#475569] border-b border-[#e2e8f0]">RF</th>
                  {SYMPTOM_COLS.map((col) => (
                    <th
                      key={col.key}
                      className={`p-3 font-semibold border-b border-[#e2e8f0] text-center ${
                        symptomType === col.key
                          ? "text-[#1d4ed8] bg-[#eff6ff]"
                          : "text-[#475569]"
                      }`}
                    >
                      {col.label}
                      {symptomType === col.key && (
                        <span className="block text-[9px] font-normal text-[#1d4ed8] mt-0.5">← votre patient</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RF_CATS.map((cat) => (
                  <tr key={cat} className={rfCategory === cat ? "bg-[#fffbeb]" : "bg-white"}>
                    <td className={`p-3 font-semibold border-b border-[#f1f5f9] text-[#1e293b] ${rfCategory === cat ? "text-[#d97706]" : ""}`}>
                      {cat} RF
                      {rfCategory === cat && <span className="text-[9px] block text-[#d97706]">← sélectionné</span>}
                    </td>
                    {SYMPTOM_COLS.map((col) => {
                      const val = RFCL_TABLE[sex][ageRange][cat][col.key as keyof (typeof RFCL_TABLE)["homme"]["30-39"]["0-1"]]
                      const isActive = rfCategory === cat && (symptomType === col.key || (symptomType === "non-coronarien" && col.key === "non-angineux"))
                      return (
                        <td
                          key={col.key}
                          className={`p-3 text-center font-bold border-b border-[#f1f5f9] text-sm ${
                            isActive
                              ? "bg-[#1d4ed8] text-white rounded"
                              : "text-[#1e293b]"
                          }`}
                        >
                          {val}%
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {baseRFCL !== null && (
            <div className="mt-2 flex items-center justify-center gap-2">
              <span className="text-xs text-[#64748b]">RF-CL de base :</span>
              <span className="text-base font-bold text-[#1d4ed8]">{baseRFCL}%</span>
            </div>
          )}
        </div>
      )}

      {/* Modifiers */}
      <div>
        <p className="text-sm font-semibold text-[#1e293b] mb-3">Facteurs modificateurs</p>

        <div className="space-y-2 mb-4">
          {[
            { key: "atcdCoronaire" as const, label: "ATCD de coronaropathie documentée (stent, pontage, IDM antérieur)", direction: "up" },
            { key: "ecgIschemique" as const, label: "ECG de repos : modifications ischémiques (sous-décalage ST ≥ 0.5mm, ondes T négatives symétriques)", direction: "up" },
            { key: "dvgFEVG" as const, label: "Dysfonction VG connue (FEVG < 50%)", direction: "up" },
          ].map((mod) => (
            <label
              key={mod.key}
              className={`flex items-start gap-3 rounded-xl border-2 p-3 cursor-pointer transition-all ${
                modifiers[mod.key] ? "border-[#d97706] bg-[#fffbeb]" : "border-[#e2e8f0] bg-white"
              }`}
            >
              <div
                className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center mt-0.5 transition-all ${
                  modifiers[mod.key] ? "bg-[#d97706] border-[#d97706]" : "border-[#cbd5e1] bg-white"
                }`}
                onClick={() => setModifiers((prev) => ({ ...prev, [mod.key]: !prev[mod.key] }))}
              >
                {modifiers[mod.key] && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div onClick={() => setModifiers((prev) => ({ ...prev, [mod.key]: !prev[mod.key] }))}>
                <span className="text-xs font-bold text-[#d97706] mr-1">Reclassification vers le haut</span>
                <span className="text-sm text-[#1e293b] leading-relaxed">{mod.label}</span>
              </div>
            </label>
          ))}
        </div>

        {/* CACS */}
        <div>
          <p className="text-xs font-semibold text-[#475569] mb-2 uppercase tracking-wide">Score calcique coronarien (CACS) si connu</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {CACS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setModifiers((prev) => ({ ...prev, cacs: opt.value }))}
                className={`text-left p-3 rounded-xl border-2 transition-all touch-target ${
                  modifiers.cacs === opt.value
                    ? opt.value === "zero" || opt.value === "1-9" || opt.value === "10-99"
                      ? "border-[#16a34a] bg-[#f0fdf4]"
                      : opt.value === "400-999" || opt.value === "1000+"
                      ? "border-[#dc2626] bg-[#fef2f2]"
                      : "border-[#1e293b] bg-[#f8fafc]"
                    : "border-[#e2e8f0] bg-white hover:border-[#94a3b8]"
                }`}
              >
                <span className="text-sm font-semibold text-[#1e293b] block">{opt.label}</span>
                {opt.desc && <span className="text-xs text-[#64748b]">{opt.desc}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Adjusted RF-CL result */}
      {adjustedRFCL !== null && finalCategory && (
        <RFCLResult pct={adjustedRFCL} base={baseRFCL!} category={finalCategory} modified={adjustedRFCL !== baseRFCL} />
      )}

      {/* ANOCA indicative panel — uniquement si CACS-CL connu et très faible */}
      {cacsBin !== null && finalCategory === "tres-faible" && <AnocaIndicativePanel sexFeminin={sex === "femme"} />}

      {/* Nav — masquée en mode autonome */}
      {!standalone && (
        <div className="flex gap-3 pt-2">
          <button
            onClick={onPrev}
            className="flex-1 py-3 rounded-xl border-2 border-[#e2e8f0] text-[#475569] text-sm font-semibold hover:bg-[#f8fafc] transition-colors"
          >
            Précédent
          </button>
          <button
            disabled={!canProceed}
            onClick={handleNext}
            className="flex-[2] py-3 rounded-xl bg-[#1e293b] text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#334155] transition-colors"
          >
            Suivant — Stratification
          </button>
        </div>
      )}
    </div>
  )
}

function RFCLResult({
  pct,
  base,
  category,
  modified,
}: {
  pct: number
  base: number
  category: Step3Data["finalCategory"]
  modified: boolean
}) {
  const CONFIG = {
    "tres-faible": { label: "TRES FAIBLE", color: "#15803d", bg: "#f0fdf4", border: "#86efac", dots: 1 },
    faible: { label: "FAIBLE", color: "#16a34a", bg: "#f0fdf4", border: "#4ade80", dots: 2 },
    intermediaire: { label: "INTERMÉDIAIRE", color: "#d97706", bg: "#fffbeb", border: "#fcd34d", dots: 3 },
    elevee: { label: "ÉLEVÉE", color: "#dc2626", bg: "#fef2f2", border: "#fca5a5", dots: 4 },
    "tres-elevee": { label: "TRÈS ÉLEVÉE", color: "#991b1b", bg: "#fef2f2", border: "#dc2626", dots: 5 },
  }
  const c = CONFIG[category]

  return (
    <div
      className="rounded-xl border-2 p-5 transition-all"
      style={{ borderColor: c.border, backgroundColor: c.bg }}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold text-[#64748b] uppercase tracking-wide mb-1">RF-CL Ajusté</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold" style={{ color: c.color }}>{pct}%</span>
            {modified && (
              <span className="text-xs text-[#64748b]">(base : {base}%)</span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="flex gap-1 justify-end mb-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: i < c.dots ? c.color : "#e2e8f0" }}
              />
            ))}
          </div>
          <span
            className="text-sm font-bold px-3 py-1 rounded-full text-white"
            style={{ backgroundColor: c.color }}
          >
            {c.label}
          </span>
        </div>
      </div>
      {modified && (
        <p className="text-xs text-[#64748b] mt-2 border-t border-[#f1f5f9] pt-2">
          Probabilité ajustée après application des modificateurs (base : {base}%)
        </p>
      )}
    </div>
  )
}
