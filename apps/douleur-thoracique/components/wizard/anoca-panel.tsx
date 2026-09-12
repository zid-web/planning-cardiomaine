"use client"

import { useState } from "react"
import { ANOCA_ITEMS, ANOCA_SEX_FEMININ_POINTS, computeAnocaScore, getAnocaCategory, getAnocaDecision } from "@/lib/anoca-score"

/**
 * Outil INDICATIF (non validé) : piste de réflexion vers une origine
 * microvasculaire/vasospastique (ANOCA), sur le même schéma méthodologique
 * que le RF-CL/CACS-CL (score → probabilité → décision). Le testing non
 * invasif intermédiaire (TTDE-CFR, PET, IRM de perfusion) n'étant pas
 * disponible localement, la décision est dérivée directement du score. Voir
 * lib/anoca-score.ts pour l'avertissement complet.
 *
 * Réutilisé à deux endroits du parcours :
 *  - Étape 3 (RF-CL) quand le CACS-CL revient très faible ;
 *  - Étape 4 (Décision), sur un coroscanner négatif chez un patient aux
 *    symptômes atypiques.
 */
export function AnocaIndicativePanel({
  sexFeminin,
  subtitle = "CACS-CL très faible : envisager une origine microvasculaire/vasospastique (non validé, à titre pédagogique)",
  contextNote = "Ne remplace pas et ne contredit pas la conduite à tenir ci-dessus, issue du RF-CL/CACS-CL : il s'agit ici d'une question diagnostique distincte (origine microvasculaire ou vasospastique, à discuter uniquement si les symptômes persistent malgré un CACS-CL très faible).",
}: {
  sexFeminin: boolean
  subtitle?: string
  contextNote?: string
}) {
  const [open, setOpen] = useState(false)
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  const score = computeAnocaScore(sexFeminin, checked)
  const category = getAnocaCategory(score)
  const decision = getAnocaDecision(category.priorPercent)

  return (
    <div className="rounded-xl border-2 border-[#a855f7] bg-[#faf5ff] overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between p-4 text-left">
        <div>
          <p className="text-sm font-bold text-[#7e22ce]">Outil indicatif — risque d&apos;ANOCA</p>
          <p className="text-[11px] text-[#7e22ce]/80 mt-0.5">{subtitle}</p>
        </div>
        <span className="text-[#7e22ce] text-lg flex-shrink-0">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-[#e9d5ff] pt-4">
          <div className="bg-white border border-[#e9d5ff] rounded-lg p-3">
            <p className="text-[11px] text-[#7e22ce] leading-relaxed">
              <strong>⚠️ Score non validé.</strong> Construction pédagogique assemblant, sur le même schéma
              méthodologique que le RF-CL/CACS-CL, des seuils rapportés dans la littérature (WISE, COVADIS). Le
              testing non invasif intermédiaire (TTDE-CFR, PET, IRM de perfusion) n'est pas disponible localement.
              Ne remplace pas le jugement clinique ni une cohorte de dérivation dédiée — à utiliser uniquement en
              aide à la réflexion.
            </p>
          </div>

          {/* Score ANOCA-Rescue */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-[#581c87]">Score clinique ANOCA-Rescue</p>
              <span className="text-xs font-bold text-white bg-[#7e22ce] rounded-full px-2.5 py-0.5">{score} / 14</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-3 rounded-lg border border-[#e9d5ff] bg-white p-2.5 opacity-70">
                <div
                  className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${
                    sexFeminin ? "bg-[#7e22ce] border-[#7e22ce]" : "border-[#cbd5e1] bg-white"
                  }`}
                >
                  {sexFeminin && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-xs text-[#475569] flex-1">
                  Sexe féminin (reporté depuis les informations ci-dessus) — +{ANOCA_SEX_FEMININ_POINTS} pts
                </span>
              </div>
              {ANOCA_ITEMS.map((item) => (
                <label
                  key={item.key}
                  className={`flex items-center gap-3 rounded-lg border p-2.5 cursor-pointer transition-all ${
                    checked[item.key] ? "border-[#7e22ce] bg-[#f3e8ff]" : "border-[#e9d5ff] bg-white"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${
                      checked[item.key] ? "bg-[#7e22ce] border-[#7e22ce]" : "border-[#cbd5e1] bg-white"
                    }`}
                    onClick={() => setChecked((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
                  >
                    {checked[item.key] && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span
                    className="text-xs text-[#475569] flex-1"
                    onClick={() => setChecked((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
                  >
                    {item.label} — +{item.points} pts
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Prior probability */}
          <div className="rounded-lg p-3 text-center" style={{ backgroundColor: `${category.color}15`, border: `1.5px solid ${category.color}` }}>
            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: category.color }}>
              Probabilité prétest d&apos;ANOCA (indicative)
            </p>
            <p className="text-2xl font-bold mt-1" style={{ color: category.color }}>
              {category.label} <span className="text-sm font-semibold">({category.range})</span>
            </p>
          </div>

          {/* Piste de réflexion — volontairement non stylée comme une décision clinique
              (couleur neutre, pas de vert/orange/rouge) pour ne jamais donner l'impression
              de contredire la conduite à tenir déjà affichée : ce sont deux questions
              diagnostiques différentes (athérome épicardique vs microvasculaire/vasospastique). */}
          <div className="rounded-lg border-2 border-[#a855f7] bg-white p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#7e22ce]">
              Piste de réflexion — coro + étude de la microcirculation
            </p>
            <p className="text-sm font-black mt-0.5 text-[#581c87]">{decision.label}</p>
            <p className="text-[11px] text-[#475569] mt-1 leading-relaxed">{decision.rationale}</p>
            <p className="text-[10px] text-[#7e22ce]/80 mt-2 border-t border-[#e9d5ff] pt-2 leading-relaxed">
              {contextNote}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
