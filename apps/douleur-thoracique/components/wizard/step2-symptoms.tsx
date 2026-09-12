"use client"

import { useState } from "react"

export type SymptomType = "typique" | "atypique" | "non-angineux" | "non-coronarien" | null
export type Duration = "moins5" | "5a20" | "20a30" | "plus30" | "persistante" | null
export type Debut = "premiere" | "recidivant" | "aggravation" | null

export interface Step2Data {
  componentA: boolean
  componentB: boolean
  componentC: boolean
  dyspnee: boolean
  asymptomatique: boolean
  duration: Duration
  debut: Debut
  symptomType: SymptomType
}

interface Step2Props {
  onNext: (data: Step2Data) => void
  onPrev: () => void
}

function getSymptomType(a: boolean, b: boolean, c: boolean): NonNullable<SymptomType> {
  const count = [a, b, c].filter(Boolean).length
  if (count === 3) return "typique"
  if (count === 2) return "atypique"
  if (count === 1) return "non-angineux"
  return "non-coronarien"
}

const SYMPTOM_TYPE_CONFIG: Record<
  NonNullable<SymptomType>,
  { label: string; color: string; bg: string; border: string; desc: string }
> = {
  typique: {
    label: "Angor TYPIQUE",
    color: "#1d4ed8",
    bg: "#eff6ff",
    border: "#93c5fd",
    desc: "3/3 critères — Probabilité coronarienne élevée",
  },
  atypique: {
    label: "Angor ATYPIQUE",
    color: "#d97706",
    bg: "#fffbeb",
    border: "#fcd34d",
    desc: "2/3 critères — Probabilité coronarienne intermédiaire",
  },
  "non-angineux": {
    label: "Douleur NON-ANGINEUSE",
    color: "#475569",
    bg: "#f8fafc",
    border: "#cbd5e1",
    desc: "1/3 critère — Probabilité coronarienne faible",
  },
  "non-coronarien": {
    label: "Douleur non-coronarienne probable",
    color: "#15803d",
    bg: "#f0fdf4",
    border: "#86efac",
    desc: "0/3 critère — Chercher une cause alternative",
  },
}

const DURATIONS: { value: Duration; label: string }[] = [
  { value: "moins5", label: "< 5 min" },
  { value: "5a20", label: "5–20 min" },
  { value: "20a30", label: "20–30 min" },
  { value: "plus30", label: "> 30 min" },
  { value: "persistante", label: "Persistante actuellement" },
]

const DEBUTS: { value: Debut; label: string }[] = [
  { value: "premiere", label: "Première fois" },
  { value: "recidivant", label: "Récidivant" },
  { value: "aggravation", label: "Aggravation d'une douleur connue" },
]

export function Step2Symptoms({ onNext, onPrev }: Step2Props) {
  const [componentA, setComponentA] = useState(false)
  const [componentB, setComponentB] = useState(false)
  const [componentC, setComponentC] = useState(false)
  const [dyspnee, setDyspnee] = useState(false)
  const [asymptomatique, setAsymptomatique] = useState(false)
  const [duration, setDuration] = useState<Duration>(null)
  const [debut, setDebut] = useState<Debut>(null)

  const symptomType = asymptomatique ? "non-coronarien" : getSymptomType(componentA, componentB, componentC)
  const config = SYMPTOM_TYPE_CONFIG[symptomType]
  const canProceed = asymptomatique || (duration !== null && debut !== null)

  const handleNext = () => {
    onNext({
      componentA: asymptomatique ? false : componentA,
      componentB: asymptomatique ? false : componentB,
      componentC: asymptomatique ? false : componentC,
      dyspnee: asymptomatique ? false : dyspnee,
      asymptomatique,
      duration: asymptomatique ? null : duration,
      debut: asymptomatique ? null : debut,
      symptomType,
    })
  }

  return (
    <div className="space-y-6">
      {/* ESC classification info */}
      <div className="bg-[#f0f9ff] border border-[#bae6fd] rounded-xl p-4">
        <p className="text-xs text-[#0369a1] font-medium leading-relaxed">
          Classification ESC 2024 — Remplace la terminologie "typique/atypique" par une description en 3 composantes
        </p>
      </div>

      {/* 3 components */}
      <div className={asymptomatique ? "opacity-40 pointer-events-none select-none" : ""}>
        <p className="text-sm font-semibold text-[#1e293b] mb-3">La douleur thoracique est-elle :</p>
        <div className="space-y-3">
          {/* Component A */}
          <ComponentCheckbox
            id="comp-a"
            label="Composante A — Caractère de la douleur"
            description="Oppressive, en pression, en étau, pesanteur, serrement"
            checked={componentA}
            onChange={setComponentA}
          />
          {/* Component B */}
          <ComponentCheckbox
            id="comp-b"
            label="Composante B — Localisation / irradiation"
            description="Rétrosternale OU irradiation vers le bras gauche / les deux bras / la mâchoire / l'épaule gauche / le dos"
            checked={componentB}
            onChange={setComponentB}
          />
          {/* Component C */}
          <ComponentCheckbox
            id="comp-c"
            label="Composante C — Facteurs déclenchants / soulageants"
            description="Déclenchée par l'effort ou le stress émotionnel ET soulagée par le repos ou la trinitrine (< 5 min)"
            checked={componentC}
            onChange={setComponentC}
          />
        </div>
      </div>

      {/* Live classification badge — hidden when asymptomatique */}
      {!asymptomatique && (
        <div
          className="rounded-xl border-2 p-4 transition-all"
          style={{ borderColor: config.border, backgroundColor: config.bg }}
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span
              className="text-sm font-bold px-3 py-1 rounded-full"
              style={{ backgroundColor: config.color, color: "white" }}
            >
              {config.label}
            </span>
            <span className="text-xs font-medium" style={{ color: config.color }}>
              {config.desc}
            </span>
          </div>
        </div>
      )}

      {/* Dyspnée */}
      <div
        className={`rounded-xl border-2 p-4 cursor-pointer transition-all ${
          asymptomatique ? "opacity-40 pointer-events-none" :
          dyspnee ? "border-[#1d4ed8] bg-[#eff6ff]" : "border-[#e2e8f0] bg-white"
        }`}
        onClick={() => !asymptomatique && setDyspnee(!dyspnee)}
        role="checkbox"
        aria-checked={dyspnee}
        tabIndex={0}
        onKeyDown={(e) => { if (!asymptomatique && (e.key === " " || e.key === "Enter")) { e.preventDefault(); setDyspnee(!dyspnee) } }}
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center mt-0.5 transition-all ${
              dyspnee && !asymptomatique ? "bg-[#1d4ed8] border-[#1d4ed8]" : "border-[#cbd5e1] bg-white"
            }`}
          >
            {dyspnee && !asymptomatique && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`text-sm font-semibold ${dyspnee && !asymptomatique ? "text-[#1d4ed8]" : "text-[#1e293b]"}`}>
                Présence de dyspnée d'effort associée
              </p>
              {dyspnee && !asymptomatique && (
                <span className="text-[10px] font-bold bg-[#1d4ed8] text-white px-2 py-0.5 rounded-full uppercase tracking-wide">
                  Équivalent angineux — activé
                </span>
              )}
            </div>
            <p className="text-xs text-[#64748b] mt-0.5">
              Essoufflement apparu à l'effort, remplaçant ou s'ajoutant à la douleur thoracique
            </p>
          </div>
        </div>
      </div>

      {/* Asymptomatique */}
      <div
        className={`rounded-xl border-2 p-4 cursor-pointer transition-all ${
          asymptomatique ? "border-[#7c3aed] bg-[#f5f3ff]" : "border-[#e2e8f0] bg-white hover:border-[#c4b5fd]"
        }`}
        onClick={() => {
          const next = !asymptomatique
          setAsymptomatique(next)
          if (next) { setComponentA(false); setComponentB(false); setComponentC(false); setDyspnee(false) }
        }}
        role="checkbox"
        aria-checked={asymptomatique}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault()
            const next = !asymptomatique
            setAsymptomatique(next)
            if (next) { setComponentA(false); setComponentB(false); setComponentC(false); setDyspnee(false) }
          }
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center mt-0.5 transition-all ${
              asymptomatique ? "bg-[#7c3aed] border-[#7c3aed]" : "border-[#cbd5e1] bg-white"
            }`}
          >
            {asymptomatique && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`text-sm font-semibold ${asymptomatique ? "text-[#7c3aed]" : "text-[#1e293b]"}`}>
                Patient asymptomatique
              </p>
              {asymptomatique && (
                <span className="text-[10px] font-bold bg-[#7c3aed] text-white px-2 py-0.5 rounded-full uppercase tracking-wide">
                  Risque pré-test non applicable
                </span>
              )}
            </div>
            <p className="text-xs text-[#64748b] mt-0.5">
              Aucune douleur thoracique ni équivalent angineux — bilan cardiovasculaire de dépistage
            </p>
          </div>
        </div>
      </div>

      {/* Duration */}
      <div>
        <p className="text-sm font-semibold text-[#1e293b] mb-3">
          Durée des épisodes douloureux <span className="text-[#dc2626]">*</span>
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {DURATIONS.map((d) => (
            <button
              key={d.value}
              onClick={() => setDuration(d.value)}
              className={`py-2.5 px-3 rounded-lg text-sm font-medium border-2 transition-all touch-target ${
                duration === d.value
                  ? "bg-[#1e293b] border-[#1e293b] text-white"
                  : "bg-white border-[#e2e8f0] text-[#475569] hover:border-[#94a3b8]"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Debut */}
      <div>
        <p className="text-sm font-semibold text-[#1e293b] mb-3">
          Type d'apparition <span className="text-[#dc2626]">*</span>
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {DEBUTS.map((d) => (
            <button
              key={d.value}
              onClick={() => setDebut(d.value)}
              className={`py-2.5 px-3 rounded-lg text-sm font-medium border-2 transition-all touch-target ${
                debut === d.value
                  ? "bg-[#1e293b] border-[#1e293b] text-white"
                  : "bg-white border-[#e2e8f0] text-[#475569] hover:border-[#94a3b8]"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Nav buttons */}
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
          Suivant — Calcul RF-CL
        </button>
      </div>
    </div>
  )
}

function ComponentCheckbox({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div
      className={`rounded-xl border-2 p-4 transition-all cursor-pointer ${
        checked ? "border-[#1d4ed8] bg-[#eff6ff]" : "border-[#e2e8f0] bg-white"
      }`}
      onClick={() => onChange(!checked)}
    >
      <label className="flex items-start gap-3 cursor-pointer">
        <div
          className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
            checked ? "bg-[#1d4ed8] border-[#1d4ed8]" : "border-[#cbd5e1] bg-white"
          }`}
        >
          {checked && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold text-[#64748b] uppercase tracking-wide">{label}</p>
          <p className="text-sm text-[#1e293b] mt-0.5 leading-relaxed">{description}</p>
        </div>
      </label>
    </div>
  )
}
