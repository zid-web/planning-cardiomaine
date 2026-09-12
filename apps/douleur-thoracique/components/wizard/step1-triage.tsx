"use client"

import { useState } from "react"
import { AlertTriangle, Phone, ChevronDown, ChevronUp } from "lucide-react"

interface RedFlag {
  id: string
  label: string
  suspicion: string
}

const RED_FLAGS: RedFlag[] = [
  {
    id: "aorte",
    label: "Douleur thoracique à caractère déchirant ou migratoire dorsal ± asymétrie tensionnelle (> 20 mmHg)",
    suspicion: "Dissection aortique",
  },
  {
    id: "choc",
    label: "Hypotension (TAS < 90 mmHg), pouls filant, altération de conscience",
    suspicion: "Choc cardiogénique / état de choc",
  },
  {
    id: "detresse",
    label: "Détresse respiratoire sévère (SpO₂ < 90%, cyanose, tirage)",
    suspicion: "Détresse respiratoire aiguë",
  },
  {
    id: "stemi",
    label: "Sus-décalage ST à l'ECG (ou BBG présumé nouveau)",
    suspicion: "STEMI — Infarctus du myocarde",
  },
  {
    id: "tamponnade",
    label: "Turgescence jugulaire + hypotension + bruits cardiaques assourdis",
    suspicion: "Tamponnade cardiaque",
  },
  {
    id: "pe",
    label: "Signes d'embolie pulmonaire massive (syncope, hypotension, désaturation, TVP)",
    suspicion: "Embolie pulmonaire massive",
  },
]

const SMUR_MEASURES: Record<string, string[]> = {
  aorte: [
    "NE PAS administrer anticoagulants ni antiplaquettaires",
    "Position allongée, repos strict",
    "Antalgiques IV si disponibles (paracétamol IV — éviter morphine)",
    "Contrôle tensionnel si PA très élevée (objectif TAS 100–120 mmHg)",
    "Préparer dossier médical complet pour le SMUR",
  ],
  choc: [
    "ECG 12 dérivations immédiat",
    "Voie veineuse périphérique",
    "Position allongée, jambes surélevées si toléré",
    "O₂ si SpO₂ < 90%",
    "Scope cardio-tensionnel si disponible",
    "Ne pas laisser le patient seul",
  ],
  detresse: [
    "O₂ à haut débit (masque à haute concentration)",
    "Position demi-assise",
    "Scope si disponible",
    "Ne pas mobiliser inutilement",
  ],
  stemi: [
    "ECG 12 dérivations (+ V7–V9 si IDM postérieur suspecté, + V3R–V4R si IDM VD)",
    "Voie veineuse périphérique",
    "Aspirine 250–500 mg PO (sauf allergie / anticoagulant actif)",
    "Trinitrine SL 0.3 mg si TAS > 100 mmHg et pas de sténose aortique sévère connue",
    "O₂ UNIQUEMENT si SpO₂ < 90% — ne pas administrer si SpO₂ normale (ESC 2023)",
    "Position demi-assise, repos strict, scope si disponible",
    "NE PAS administrer Morphine (diminue absorption aspirine — ESC 2023)",
    "NE PAS administrer Ticagrélor/Clopidogrel sans accord cardiologique",
  ],
  tamponnade: [
    "O₂ si SpO₂ < 90%",
    "Position semi-assise selon tolérance",
    "NE PAS mobiliser le patient",
    "Scope si disponible",
    "Voie veineuse périphérique (pas de remplissage agressif)",
    "Préparer dossier pour le SMUR",
  ],
  pe: [
    "O₂ à haut débit",
    "Position demi-assise",
    "Voie veineuse périphérique",
    "ECG 12 dérivations",
    "Scope cardio-tensionnel si disponible",
    "NE PAS mobiliser inutilement — risque d'aggravation hémodynamique",
  ],
}

interface Step1Props {
  onNext: (data: { redFlagTriggered: false } | { redFlagTriggered: true; flags: string[] }) => void
}

export function Step1Triage({ onNext }: Step1Props) {
  const [checked, setChecked] = useState<string[]>([])
  const [isOpen, setIsOpen] = useState(false)

  const anyTriggered = checked.length > 0

  function toggle(id: string) {
    setChecked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const triggeredFlags = RED_FLAGS.filter((f) => checked.includes(f.id))
  const allSmurMeasures = [
    ...new Set(triggeredFlags.flatMap((f) => SMUR_MEASURES[f.id] ?? [])),
  ]

  // Alert panel — shown when at least one flag is checked
  if (anyTriggered) {
    return (
      <div className="space-y-5">
        {/* Red alert block */}
        <div className="rounded-xl border-4 border-[#dc2626] bg-[#fef2f2] p-5">
          <div className="flex flex-col items-center gap-3 text-center mb-5">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[#dc2626]">
              <Phone className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#dc2626] uppercase tracking-wide">
                APPEL IMMÉDIAT DU 15 — SAMU
              </h2>
              <p className="text-sm text-[#dc2626] mt-1 font-medium">
                Composez le 15 maintenant. Ne laissez pas le patient seul.
              </p>
            </div>
          </div>

          {/* Triggered diagnoses */}
          <div className="space-y-2 mb-5">
            <p className="text-[10px] font-bold text-[#991b1b] uppercase tracking-wider mb-2">
              Critère{checked.length > 1 ? "s" : ""} d'alerte coché{checked.length > 1 ? "s" : ""}
            </p>
            {triggeredFlags.map((f) => (
              <div key={f.id} className="flex items-start gap-3 bg-white rounded-lg p-3 border border-[#fca5a5]">
                <AlertTriangle className="w-4 h-4 text-[#dc2626] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-[#991b1b]">{f.suspicion}</p>
                  <p className="text-xs text-[#7f1d1d] mt-0.5">{f.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Visual call button */}
          <div className="flex justify-center mb-5">
            <div
              className="flex items-center gap-3 bg-[#dc2626] text-white px-8 py-3.5 rounded-full text-lg font-bold shadow-lg cursor-default select-none"
              role="img"
              aria-label="Composez le 15 — SAMU"
            >
              <Phone className="w-5 h-5" />
              <span>15 — SAMU</span>
            </div>
          </div>

          {/* SMUR measures */}
          {allSmurMeasures.length > 0 && (
            <div className="bg-white rounded-lg border border-[#fca5a5] p-4">
              <h3 className="font-semibold text-[#991b1b] mb-3 text-sm uppercase tracking-wide">
                Mesures en attente du SMUR
              </h3>
              <ul className="space-y-2">
                {allSmurMeasures.map((measure, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[#1e293b]">
                    <span className="w-5 h-5 flex-shrink-0 mt-0.5 rounded-full bg-[#fef2f2] border border-[#fca5a5] flex items-center justify-center text-[10px] font-bold text-[#dc2626]">
                      {i + 1}
                    </span>
                    <span className={measure.startsWith("NE PAS") ? "font-semibold text-[#dc2626]" : ""}>
                      {measure}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Uncheck button */}
        <button
          onClick={() => setChecked([])}
          className="w-full py-3 rounded-lg border-2 border-[#e2e8f0] text-[#64748b] text-sm font-medium hover:bg-[#f8fafc] transition-colors"
        >
          Corriger la sélection
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Collapsible criteria panel */}
      <div className="border-2 border-[#e2e8f0] rounded-xl overflow-hidden">
        <button
          onClick={() => setIsOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3.5 bg-[#fef2f2] hover:bg-[#fee2e2] transition-colors text-left"
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-[#dc2626] flex-shrink-0" />
            <span className="text-sm font-bold text-[#991b1b]">
              Critères d'alerte — urgence vitale immédiate
            </span>
          </div>
          <div className="flex items-center gap-2">
            {checked.length > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#dc2626] text-white text-[10px] font-bold">
                {checked.length}
              </span>
            )}
            {isOpen
              ? <ChevronUp className="w-4 h-4 text-[#dc2626] flex-shrink-0" />
              : <ChevronDown className="w-4 h-4 text-[#dc2626] flex-shrink-0" />
            }
          </div>
        </button>

        {isOpen && (
          <div className="divide-y divide-[#fee2e2]">
            {RED_FLAGS.map((flag) => {
              const isChecked = checked.includes(flag.id)
              return (
                <button
                  key={flag.id}
                  onClick={() => toggle(flag.id)}
                  className={`w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors ${
                    isChecked ? "bg-[#fef2f2]" : "bg-white hover:bg-[#fff5f5]"
                  }`}
                >
                  {/* Custom checkbox */}
                  <span className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                    isChecked ? "bg-[#dc2626] border-[#dc2626]" : "border-[#fca5a5] bg-white"
                  }`}>
                    {isChecked && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className={`text-xs font-bold mb-0.5 ${isChecked ? "text-[#dc2626]" : "text-[#991b1b]"}`}>
                      {flag.suspicion}
                    </p>
                    <p className="text-xs text-[#475569] leading-relaxed">{flag.label}</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {!isOpen && (
          <p className="px-4 py-2.5 text-xs text-[#64748b] bg-white border-t border-[#e2e8f0]">
            Ouvrir pour vérifier les critères — dépliez si un signe d'alerte est présent
          </p>
        )}
      </div>

      {/* Proceed button — always accessible */}
      <button
        onClick={() => onNext({ redFlagTriggered: false })}
        className="w-full py-3 rounded-xl bg-[#1e293b] text-white font-semibold text-sm hover:bg-[#334155] transition-colors"
      >
        Poursuivre — Caractérisation des symptômes
      </button>

      <p className="text-center text-xs text-[#94a3b8]">
        Vous pouvez passer cette étape si aucun critère d'alerte n'est présent
      </p>
    </div>
  )
}
