"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { BookOpen } from "lucide-react"
import { Step1Triage } from "./step1-triage"
import { Step2Symptoms, type Step2Data } from "./step2-symptoms"
import { Step3RFCL, type Step3Data } from "./step3-rfcl"
import { Step4Decision, type BayesianWizardData } from "./step4-decision"
import { Step5Summary } from "./step5-summary"

const STEPS = [
  { id: 1, title: "Triage immédiat", short: "Triage" },
  { id: 2, title: "Caractérisation", short: "Symptômes" },
  { id: 3, title: "Calcul RF-CL", short: "RF-CL" },
  { id: 4, title: "Stratification", short: "Décision" },
  { id: 5, title: "Résumé", short: "Résumé" },
]

type WizardState = {
  step: number
  symptomData: Step2Data | null
  rfclData: Step3Data | null
  bayesianData: BayesianWizardData | null
}

export function WizardShell() {
  const [state, setState] = useState<WizardState>({
    step: 1,
    symptomData: null,
    rfclData: null,
    bayesianData: null,
  })

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  const goTo = (step: number) => {
    setState((s) => ({ ...s, step }))
    scrollToTop()
  }

  const reset = () => {
    setState({ step: 1, symptomData: null, rfclData: null, bayesianData: null })
    scrollToTop()
  }

  const stepTitles: Record<number, string> = {
    1: "Évaluation initiale — Critères d'alerte immédiate",
    2: "Classification symptomatique de la douleur",
    3: "Calcul de la probabilité pré-test — Modèle RF-CL (Winther / ESC 2024)",
    4: "Stratification et prise en charge",
    5: "Fiche de consultation — Résumé clinique",
  }

  const stepSubtitles: Record<number, string> = {
    1: "Répondez par OUI ou NON à chacune des situations suivantes",
    2: "Selon la classification ESC 2024 — remplace la terminologie 'typique/atypique'",
    3: "Score calculé à partir du sexe, de l'âge, des symptômes et des facteurs de risque",
    4: "Décision clinique basée sur le RF-CL ajusté final",
    5: "Fiche récapitulative imprimable",
  }

  const currentStep = state.step

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans">
      {/* Top bar */}
      <div className="bg-white border-b border-[#e2e8f0] sticky top-0 z-20 print:hidden">
        <div className="max-w-2xl mx-auto px-4 pt-2 pb-3">
          {/* Références et mentions légales */}
          <Link
            href="/references/"
            className="inline-flex items-center gap-1 text-xs text-[#64748b] hover:text-[#1e293b] mb-2 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
            Références & mentions
          </Link>
          {/* Title */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-sm font-bold text-[#1e293b]">Douleur Thoracique au Cabinet</h1>
              <p className="text-xs text-[#64748b]">Aide à la décision — ESC 2023/2024</p>
            </div>
            <span className="text-xs text-[#94a3b8] font-medium">
              Étape {currentStep} / {STEPS.length}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-[#e2e8f0] rounded-full h-1.5 mb-3">
            <div
              className="h-1.5 rounded-full bg-[#1e293b] transition-all duration-500"
              style={{ width: `${(currentStep / STEPS.length) * 100}%` }}
            />
          </div>

          {/* Step dots */}
          <div className="flex items-center justify-between">
            {STEPS.map((s) => (
              <div
                key={s.id}
                className="flex flex-col items-center gap-1"
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                    s.id < currentStep
                      ? "bg-[#1e293b] text-white"
                      : s.id === currentStep
                      ? "bg-[#1e293b] text-white ring-4 ring-[#1e293b]/20"
                      : "bg-[#e2e8f0] text-[#94a3b8]"
                  }`}
                >
                  {s.id < currentStep ? (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    s.id
                  )}
                </div>
                <span
                  className={`text-[9px] font-medium hidden sm:block ${
                    s.id === currentStep ? "text-[#1e293b]" : "text-[#94a3b8]"
                  }`}
                >
                  {s.short}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky score badge after step 3 */}
      {state.rfclData && currentStep >= 4 && (
        <div className="print:hidden sticky top-[148px] sm:top-[152px] z-10 pointer-events-none">
          <div className="max-w-2xl mx-auto px-4">
            <div
              className="ml-auto w-fit rounded-full px-3 py-1 text-xs font-bold text-white shadow-lg"
              style={{ backgroundColor: getCategoryColor(state.rfclData.finalCategory) }}
            >
              RF-CL : {state.rfclData.adjustedRFCL}% — {getCategoryShortLabel(state.rfclData.finalCategory)}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-6 pb-16">
        {/* Step heading */}
        <div className="mb-6 print:hidden">
          <h2 className="text-lg font-bold text-[#1e293b] text-balance leading-snug">
            {stepTitles[currentStep]}
          </h2>
          <p className="text-sm text-[#64748b] mt-1 leading-relaxed">
            {stepSubtitles[currentStep]}
          </p>
        </div>

        {/* Step content */}
        {currentStep === 1 && (
          <Step1Triage
            onNext={(data) => {
              if (!data.redFlagTriggered) goTo(2)
            }}
          />
        )}

        {currentStep === 2 && (
          <Step2Symptoms
            onPrev={() => goTo(1)}
            onNext={(data) => {
              setState((s) => ({ ...s, symptomData: data, step: 3 }))
              scrollToTop()
            }}
          />
        )}

        {currentStep === 3 && state.symptomData && (
          <Step3RFCL
            symptomData={state.symptomData}
            onPrev={() => goTo(2)}
            onNext={(data) => {
              setState((s) => ({ ...s, rfclData: data, step: 4 }))
              scrollToTop()
            }}
          />
        )}

        {currentStep === 4 && state.rfclData && state.symptomData && (
          <Step4Decision
            rfclData={state.rfclData}
            symptomType={state.symptomData.symptomType}
            onPrev={() => goTo(3)}
            onNext={() => goTo(5)}
            onBayesianChange={(data) =>
              setState((s) => ({ ...s, bayesianData: data }))
            }
          />
        )}

        {currentStep === 5 && state.symptomData && state.rfclData && (
          <Step5Summary
            symptomData={state.symptomData}
            rfclData={state.rfclData}
            bayesianData={state.bayesianData}
            onReset={reset}
          />
        )}
      </main>
    </div>
  )
}

function getCategoryColor(cat: Step3Data["finalCategory"]): string {
  const map = {
    "tres-faible": "#15803d",
    faible: "#16a34a",
    intermediaire: "#d97706",
    elevee: "#dc2626",
    "tres-elevee": "#991b1b",
  }
  return map[cat]
}

function getCategoryShortLabel(cat: Step3Data["finalCategory"]): string {
  const map = {
    "tres-faible": "Très faible",
    faible: "Faible",
    intermediaire: "Intermédiaire",
    elevee: "Élevée",
    "tres-elevee": "Très élevée",
  }
  return map[cat]
}
