"use client"

import { Printer, RotateCcw, ExternalLink, FileText, Send, TrendingUp, TrendingDown, Minus } from "lucide-react"
import type { Step2Data } from "./step2-symptoms"
import type { CACSValue, Step3Data } from "./step3-rfcl"
import type { BayesianWizardData } from "./step4-decision"

const CACS_LABELS: Record<Exclude<CACSValue, "unknown">, string> = {
  zero: "CACS = 0",
  "1-9": "CACS 1–9",
  "10-99": "CACS 10–99",
  "100-399": "CACS 100–399",
  "400-999": "CACS 400–999",
  "1000+": "CACS ≥ 1000",
}

const CATEGORY_LABELS: Record<Step3Data["finalCategory"], string> = {
  "tres-faible": "TRÈS FAIBLE PROBABILITÉ (≤ 5%)",
  faible: "FAIBLE PROBABILITÉ (5–15%)",
  intermediaire: "PROBABILITÉ INTERMÉDIAIRE (15–50%)",
  elevee: "PROBABILITÉ ÉLEVÉE (50–85%)",
  "tres-elevee": "TRÈS ÉLEVÉE / SCA PROBABLE (> 85%)",
}

const CATEGORY_COLORS: Record<Step3Data["finalCategory"], string> = {
  "tres-faible": "#15803d",
  faible: "#16a34a",
  intermediaire: "#d97706",
  elevee: "#dc2626",
  "tres-elevee": "#991b1b",
}

const SYMPTOM_LABELS: Record<NonNullable<Step2Data["symptomType"]>, string> = {
  typique: "Angor typique (3/3 critères ESC 2024)",
  atypique: "Angor atypique (2/3 critères ESC 2024)",
  "non-angineux": "Douleur non-angineuse (1/3 critère ESC 2024)",
  "non-coronarien": "Douleur non-coronarienne probable (0/3 critère ESC 2024)",
}

const DURATION_LABELS: Record<NonNullable<Step2Data["duration"]>, string> = {
  moins5: "< 5 min",
  "5a20": "5–20 min",
  "20a30": "20–30 min",
  plus30: "> 30 min",
  persistante: "Persistante actuellement",
}

const DEBUT_LABELS: Record<NonNullable<Step2Data["debut"]>, string> = {
  premiere: "Première fois",
  recidivant: "Récidivant",
  aggravation: "Aggravation d'une douleur connue",
}

const RF_LABELS: Record<string, string> = {
  tabac: "Tabagisme actif ou sevré < 3 ans",
  diabete: "Diabète",
  dyslipidemie: "Dyslipidémie",
  hta: "HTA / traitement antihypertenseur",
  antecedent: "ATCD familial coronaropathie précoce",
}

const DECISION_TEXTS: Record<
  Step3Data["finalCategory"],
  { decision: string; examens: string; suivi: string }
> = {
  "tres-faible": {
    decision: "Pas d'exploration coronarienne complémentaire en première intention. Rechercher diagnostic alternatif.",
    examens: "ECG 12 dérivations si non réalisé. Bilan biologique de base (troponine hs si doute).",
    suivi: "Suivi médecin traitant à 4–8 semaines. Cardiologie si symptômes persistants > 4 semaines.",
  },
  faible: {
    decision: "Score calcique coronarien (CACS) en première intention pour reclassification.",
    examens: "Ordonnance CACS (scanner thoracique non injecté faible dose). CCTA selon résultat CACS.",
    suivi: "Consultation cardiologique dans les 7 jours si symptômes récurrents ou CACS > 0.",
  },
  intermediaire: {
    decision: "Bilan coronarien non-invasif recommandé. CCTA en premier choix si CACS < 400.",
    examens: "CCTA (Classe I — ESC 2024). Test d'ischémie fonctionnel si CACS ≥ 400.",
    suivi: "Cardiologie URGENTE dans les 72h si douleur récente/aggravée. Sinon dans les 7 jours.",
  },
  elevee: {
    decision: "Maladie coronarienne obstructive probable — appel cardiologue de garde, bilan urgent.",
    examens: "Test d'ischémie fonctionnel (IRM de stress / scintigraphie). ECG + troponine si douleur < 24h.",
    suivi: "Consultation cardiologique dans les 24–48h. Hospitalisation si instabilité.",
  },
  "tres-elevee": {
    decision: "APPEL IMMÉDIAT DU 15 — SAMU. Orientation USIC/SAU.",
    examens: "ECG 12 dérivations, VVP, Aspirine 250–500 mg, Trinitrine SL si PA > 100 mmHg.",
    suivi: "Transport médicalisé SMUR. Ne pas laisser partir seul.",
  },
}

interface Step5Props {
  symptomData: Step2Data
  rfclData: Step3Data
  bayesianData?: BayesianWizardData | null
  onReset: () => void
}

// ── PDF print via new window ─────────────────────────────────────────────────
function buildPrintHTML(symptomData: Step2Data, rfclData: Step3Data, bayesianData?: BayesianWizardData | null): string {
  const now = new Date()
  const dateStr = now.toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
  const timeStr = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  const cat = rfclData.finalCategory
  const catColor = CATEGORY_COLORS[cat]
  const decision = DECISION_TEXTS[cat]
  const rfList = Object.entries(rfclData.rfChecked).filter(([, v]) => v).map(([k]) => RF_LABELS[k] ?? k)

  const modList = [
    rfclData.modifiers.atcdCoronaire ? "Antécédent de coronaropathie documentée" : null,
    rfclData.modifiers.ecgIschemique ? "ECG ischémique de repos" : null,
    rfclData.modifiers.dvgFEVG ? "Dysfonction VG (FEVG < 50%)" : null,
    rfclData.modifiers.cacs !== "unknown" ? CACS_LABELS[rfclData.modifiers.cacs] : null,
  ].filter(Boolean)

  const isUrgent = cat === "elevee" || cat === "tres-elevee"

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>Fiche Consultation — Douleur Thoracique</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1e293b; background: #fff; }
  @page { size: A4; margin: 14mm 13mm; }

  /* Header */
  .header { background: #1e293b; color: white; padding: 14px 16px; display: flex; justify-content: space-between; align-items: flex-start; border-radius: 8px 8px 0 0; }
  .header-title { font-size: 13px; font-weight: 700; }
  .header-sub { font-size: 10px; color: #94a3b8; margin-top: 3px; }
  .header-date { text-align: right; font-size: 10px; color: #cbd5e1; }

  /* Risk banner */
  .risk-banner { padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid ${catColor}; background: ${catColor}18; }
  .risk-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: ${catColor}; }
  .risk-category { font-size: 14px; font-weight: 900; color: ${catColor}; margin-top: 3px; }
  .risk-score { background: ${catColor}; color: white; font-size: 28px; font-weight: 900; padding: 8px 16px; border-radius: 8px; line-height: 1; }

  ${isUrgent ? `.urgent-banner { background: ${catColor}; color: white; padding: 8px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; text-align: center; }` : ""}

  /* Body */
  .body { padding: 16px; }

  /* Section */
  .section { margin-bottom: 16px; page-break-inside: avoid; }
  .section-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; margin-bottom: 8px; }

  /* Rows */
  .row { display: flex; margin-bottom: 5px; gap: 12px; align-items: baseline; }
  .row-label { font-size: 10px; color: #64748b; min-width: 160px; flex-shrink: 0; }
  .row-value { font-size: 11px; color: #1e293b; font-weight: 500; }
  .row-value.highlight { font-weight: 700; color: ${catColor}; }
  .row-value.blue { font-weight: 700; color: #1d4ed8; }

  /* Decision box */
  .decision-box { border: 1.5px solid ${catColor}; border-radius: 8px; padding: 12px; background: ${catColor}0d; }
  .decision-row { display: flex; gap: 10px; margin-bottom: 8px; align-items: flex-start; }
  .decision-row:last-child { margin-bottom: 0; }
  .decision-icon { width: 20px; height: 20px; border-radius: 50%; background: ${catColor}; color: white; font-size: 9px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
  .decision-label { font-size: 10px; font-weight: 700; color: #64748b; }
  .decision-text { font-size: 11px; color: #1e293b; margin-top: 2px; line-height: 1.5; }

  /* Notes */
  .note-line { border-bottom: 1px dashed #cbd5e1; height: 28px; margin-bottom: 6px; width: 100%; }

  /* Signature */
  .signature-zone { display: flex; justify-content: space-between; align-items: flex-end; padding-top: 14px; border-top: 1px solid #e2e8f0; margin-top: 8px; }
  .sig-block { }
  .sig-label { font-size: 9px; color: #64748b; margin-bottom: 6px; }
  .sig-line { width: 180px; border-bottom: 1.5px solid #1e293b; height: 36px; }
  .cachet { width: 90px; height: 50px; border: 1.5px dashed #cbd5e1; border-radius: 4px; }

  /* Tags */
  .tag { display: inline-block; background: #1d4ed8; color: white; font-size: 9px; font-weight: 700; padding: 2px 8px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.05em; margin-left: 6px; }
  .tag-green { background: #15803d; }
  .tag-amber { background: #d97706; }

  /* Footer */
  .footer { background: #f8fafc; border-top: 1px solid #f1f5f9; padding: 8px 16px; margin-top: 0; border-radius: 0 0 8px 8px; }
  .footer p { font-size: 9px; color: #94a3b8; line-height: 1.6; }
  .footer strong { color: #64748b; }

  /* OmniDoc — masqué sur le PDF */
  .omnidoc { display: none; }

  /* Page wrapper */
  .page { max-width: 780px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
</style>
</head>
<body>
<div class="page">
  <!-- Header -->
  <div class="header">
    <div>
      <div class="header-title">Fiche de consultation — Douleur thoracique</div>
      <div class="header-sub">Évaluation coronarienne · Modèle RF-CL · ESC 2024</div>
    </div>
    <div class="header-date">
      <div style="font-weight:600;text-transform:capitalize">${dateStr}</div>
      <div style="color:#94a3b8">${timeStr}</div>
    </div>
  </div>

  <!-- Risk banner -->
  <div class="risk-banner">
    <div>
      <div class="risk-label">Résultat RF-CL</div>
      <div class="risk-category">${CATEGORY_LABELS[cat]}</div>
    </div>
    <div class="risk-score">${rfclData.adjustedRFCL}%</div>
  </div>

  ${isUrgent ? `<div class="urgent-banner">Situation urgente — Contacter le cardiologue / SAMU selon indication</div>` : ""}

  <div class="body">

    <!-- Profil patient -->
    <div class="section">
      <div class="section-title">Profil patient</div>
      <div class="row">
        <span class="row-label">Sexe</span>
        <span class="row-value">${rfclData.sex === "homme" ? "Homme" : "Femme"}</span>
      </div>
      <div class="row">
        <span class="row-label">Tranche d'âge</span>
        <span class="row-value">${rfclData.ageRange === "70+" ? "≥ 70 ans" : `${rfclData.ageRange} ans`}</span>
      </div>
    </div>

    <!-- Caractérisation des symptômes -->
    <div class="section">
      <div class="section-title">Caractérisation des symptômes (ESC 2024)</div>
      <div class="row">
        <span class="row-label">Classification clinique</span>
        <span class="row-value">${symptomData.symptomType ? SYMPTOM_LABELS[symptomData.symptomType] : "—"}</span>
      </div>
      <div class="row">
        <span class="row-label">Composante A — Caractère</span>
        <span class="row-value">${symptomData.componentA ? "Présente" : "Absente"}</span>
      </div>
      <div class="row">
        <span class="row-label">Composante B — Localisation</span>
        <span class="row-value">${symptomData.componentB ? "Présente" : "Absente"}</span>
      </div>
      <div class="row">
        <span class="row-label">Composante C — Déclenchant</span>
        <span class="row-value">${symptomData.componentC ? "Présente" : "Absente"}</span>
      </div>
      <div class="row">
        <span class="row-label">Dyspnée d'effort associée</span>
        <span class="row-value${symptomData.dyspnee ? " blue" : ""}">${symptomData.dyspnee ? "Oui — équivalent angineux" : "Non"}</span>
      </div>
      <div class="row">
        <span class="row-label">Durée des épisodes</span>
        <span class="row-value">${symptomData.duration ? DURATION_LABELS[symptomData.duration] : "—"}</span>
      </div>
      <div class="row">
        <span class="row-label">Type d'apparition</span>
        <span class="row-value">${symptomData.debut ? DEBUT_LABELS[symptomData.debut] : "—"}</span>
      </div>
    </div>

    <!-- Calcul RF-CL -->
    <div class="section">
      <div class="section-title">Calcul RF-CL (Winther / ESC 2024)</div>
      <div class="row">
        <span class="row-label">Facteurs de risque</span>
        <span class="row-value">${rfList.length > 0 ? rfList.join(", ") : "Aucun facteur sélectionné"}</span>
      </div>
      <div class="row">
        <span class="row-label">Nombre de RF / Catégorie</span>
        <span class="row-value">${rfclData.rfCount} facteur(s) — catégorie ${rfclData.rfCategory}</span>
      </div>
      <div class="row">
        <span class="row-label">RF-CL brut (table Winther)</span>
        <span class="row-value">${rfclData.baseRFCL}%</span>
      </div>
      <div class="row">
        <span class="row-label">Modificateurs appliqués</span>
        <span class="row-value">${modList.length > 0 ? modList.join(" · ") : "Aucun"}</span>
      </div>
      <div class="row">
        <span class="row-label">RF-CL ajusté final</span>
        <span class="row-value highlight">${rfclData.adjustedRFCL}%</span>
      </div>
    </div>

    <!-- Stratification et conduite à tenir -->
    <div class="section">
      <div class="section-title">Stratification et conduite à tenir</div>
      <div class="decision-box">
        <div class="decision-row">
          <div class="decision-icon">D</div>
          <div>
            <div class="decision-label">Décision</div>
            <div class="decision-text">${decision.decision}</div>
          </div>
        </div>
        <div class="decision-row">
          <div class="decision-icon">E</div>
          <div>
            <div class="decision-label">Examens</div>
            <div class="decision-text">${decision.examens}</div>
          </div>
        </div>
        <div class="decision-row">
          <div class="decision-icon">S</div>
          <div>
            <div class="decision-label">Suivi</div>
            <div class="decision-text">${decision.suivi}</div>
          </div>
        </div>
      </div>
    </div>

    ${bayesianData ? (() => {
      const confDots = Array.from({ length: 5 }, (_, i) => (i < bayesianData.icaConfidence ? "&#9679;" : "&#9675;")).join(" ")
      return `
    <!-- Analyse bayésienne -->
    <div class="section">
      <div class="section-title">Analyse bayésienne — Probabilité post-test</div>
      <div style="border:1.5px solid #6366f1;border-radius:6px;padding:10px;background:#eef2ff;">
        <div class="row">
          <span class="row-label">Probabilité pré-test (RF-CL ajusté)</span>
          <span class="row-value">${bayesianData.preTestProbability}%</span>
        </div>
        <div class="row">
          <span class="row-label">Probabilité post-test bayésienne</span>
          <span class="row-value" style="color:#4338ca;font-weight:700;">${bayesianData.postTestProbability.toFixed(1)}% — IC95 [${bayesianData.postTestCiLow.toFixed(0)}–${bayesianData.postTestCiHigh.toFixed(0)}%]</span>
        </div>
        <div class="row">
          <span class="row-label">Variation post-test vs pré-test</span>
          <span class="row-value" style="color:#475569;">${bayesianData.diagnosticGain >= 0 ? "+" : ""}${bayesianData.diagnosticGain.toFixed(1)} pts (informative — sans seuil decisionnel)</span>
        </div>
        ${bayesianData.steps.slice(1).map((s, i) => `
        <div class="row">
          <span class="row-label">Test ${i + 1} : ${s.label}</span>
          <span class="row-value">${s.probability.toFixed(1)}% (${s.delta >= 0 ? "+" : ""}${s.delta.toFixed(1)} pts)</span>
        </div>`).join("")}
        <div style="margin-top:8px;padding:8px;background:${bayesianData.icaColor}12;border:1.5px solid ${bayesianData.icaColor};border-radius:4px;">
          <strong style="color:${bayesianData.icaColor};font-size:11px;">DECISION FINALE — CORONAROGRAPHIE ${bayesianData.icaIndicated ? "INDIQUEE" : "NON INDIQUEE"}</strong>
          <span style="float:right;color:${bayesianData.icaColor};font-size:10px;">Confiance : ${confDots}</span>
          <p style="color:#1e293b;font-size:10px;margin-top:4px;line-height:1.5;font-weight:600;clear:both;">${bayesianData.icaLabel}</p>
          <p style="color:#475569;font-size:10px;margin-top:2px;line-height:1.5;">${bayesianData.icaRationale}</p>
          <p style="color:#94a3b8;font-size:9px;margin-top:4px;line-height:1.4;">Synthese des quatre voies ESC 2024 (probabilite post-test, anatomie CCTA, imagerie fonctionnelle, angor refractaire) — une seule voie suffit.</p>
        </div>
      </div>
    </div>`
    })() : ""}

    <!-- Notes -->
    <div class="section">
      <div class="section-title">Notes / Prochains contacts</div>
      <div class="note-line"></div>
      <div class="note-line"></div>
      <div class="note-line"></div>
    </div>

    <!-- Signature -->
    <div class="signature-zone">
      <div class="sig-block">
        <div class="sig-label">Signature du praticien</div>
        <div class="sig-line"></div>
      </div>
      <div class="sig-block" style="text-align:right">
        <div class="sig-label">Cachet médical</div>
        <div class="cachet"></div>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <p><strong>Réf. :</strong> Winther et al. JACC 2020;76:2421–2432 · ESC Guidelines CCS 2024 (Vrints et al., Eur Heart J 2024;45:3415–3537) · ESC Guidelines ACS 2023 (Byrne et al., Eur Heart J 2023;44:3720–3826)</p>
    <p style="margin-top:3px">Document généré par <strong>Douleur Thoracique au Cabinet</strong> — Outil d'aide à la décision clinique · Usage strictement médical</p>
  </div>
</div>
</body>
</html>`
}

export function Step5Summary({ symptomData, rfclData, bayesianData, onReset }: Step5Props) {
  const cat = rfclData.finalCategory
  const catColor = CATEGORY_COLORS[cat]
  const decision = DECISION_TEXTS[cat]
  const rfList = Object.entries(rfclData.rfChecked).filter(([, v]) => v).map(([k]) => RF_LABELS[k] ?? k)
  const isUrgent = cat === "elevee" || cat === "tres-elevee"

  const now = new Date()
  const dateStr = now.toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
  const timeStr = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })

  const modList = [
    rfclData.modifiers.atcdCoronaire ? "Antécédent coronaropathie" : null,
    rfclData.modifiers.ecgIschemique ? "ECG ischémique" : null,
    rfclData.modifiers.dvgFEVG ? "Dysfonction VG" : null,
    rfclData.modifiers.cacs !== "unknown" ? CACS_LABELS[rfclData.modifiers.cacs] : null,
  ].filter(Boolean)

  function handlePrint() {
    const html = buildPrintHTML(symptomData, rfclData, bayesianData)
    const win = window.open("", "_blank", "width=900,height=700")
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print() }, 400)
  }

  async function handleExportToOmniDoc() {
    try {
      // Generate HTML
      const html = buildPrintHTML(symptomData, rfclData)
      
      // Create a blob from the HTML
      const blob = new Blob([html], { type: "text/html" })
      
      // Create a File object with a meaningful name
      const now = new Date()
      const dateStr = now.toISOString().split('T')[0]
      const fileName = `DouleurThoracique-${dateStr}.html`
      const file = new File([blob], fileName, { type: "text/html" })
      
      // Create FormData for upload
      const formData = new FormData()
      formData.append("file", file)
      
      // Open OmniDoc in a new window/tab
      // The user will need to manually upload the file to OmniDoc
      // We'll provide them with a download link and instructions
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = fileName
      link.click()
      URL.revokeObjectURL(url)
      
      // Open OmniDoc after a short delay
      setTimeout(() => {
        window.open("https://omnidoc.fr", "_blank")
      }, 500)
      
      // Optional: Show a toast notification (if you have a toast system)
      alert("Le fichier a été téléchargé. Vous pouvez maintenant l'importer dans OmniDoc qui s'ouvre dans un nouvel onglet.")
    } catch (error) {
      console.error("Erreur lors de l'export vers OmniDoc:", error)
      alert("Une erreur est survenue lors de l'export. Veuillez réessayer.")
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Fiche de résumé ── */}
      <div className="rounded-xl overflow-hidden border border-[#e2e8f0] bg-white">

        {/* Header */}
        <div className="bg-[#1e293b] px-5 py-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">Fiche de consultation — Douleur thoracique</p>
              <p className="text-[#94a3b8] text-xs mt-0.5">Évaluation coronarienne · RF-CL · ESC 2024</p>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-white text-xs font-semibold capitalize">{dateStr}</p>
            <p className="text-[#94a3b8] text-xs">{timeStr}</p>
          </div>
        </div>

        {/* Risk banner */}
        <div
          className="px-5 py-3 flex items-center justify-between gap-3"
          style={{ backgroundColor: `${catColor}18`, borderBottom: `3px solid ${catColor}` }}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: catColor }}>Résultat RF-CL</p>
            <p className="text-sm font-bold mt-0.5" style={{ color: catColor }}>{CATEGORY_LABELS[cat]}</p>
          </div>
          <div
            className="text-3xl font-black leading-none px-4 py-2 rounded-lg text-white"
            style={{ backgroundColor: catColor }}
          >
            {rfclData.adjustedRFCL}%
          </div>
        </div>

        {isUrgent && (
          <div className="px-5 py-2.5 text-white text-xs font-bold uppercase tracking-wide text-center" style={{ backgroundColor: catColor }}>
            Situation urgente — Contacter le cardiologue / appeler le 15
          </div>
        )}

        <div className="p-5 space-y-5">
          {/* Profil */}
          <Section title="Profil patient">
            <Row label="Sexe" value={rfclData.sex === "homme" ? "Homme" : "Femme"} />
            <Row label="Tranche d'âge" value={rfclData.ageRange === "70+" ? "≥ 70 ans" : `${rfclData.ageRange} ans`} />
          </Section>

          {/* Symptômes */}
          <Section title="Caractérisation des symptômes (ESC 2024)">
            <Row
              label="Classification clinique"
              value={symptomData.symptomType ? SYMPTOM_LABELS[symptomData.symptomType] : "—"}
            />
            <Row label="Composante A — Caractère" value={symptomData.componentA ? "Présente" : "Absente"} />
            <Row label="Composante B — Localisation" value={symptomData.componentB ? "Présente" : "Absente"} />
            <Row label="Composante C — Déclenchant" value={symptomData.componentC ? "Présente" : "Absente"} />
            <Row
              label="Dyspnée d'effort associée"
              value={symptomData.dyspnee ? "Oui — équivalent angineux" : "Non"}
              highlight={symptomData.dyspnee}
              highlightColor="#1d4ed8"
            />
            <Row label="Durée des épisodes" value={symptomData.duration ? DURATION_LABELS[symptomData.duration] : "—"} />
            <Row label="Type d'apparition" value={symptomData.debut ? DEBUT_LABELS[symptomData.debut] : "—"} />
          </Section>

          {/* RF-CL */}
          <Section title="Calcul RF-CL (Winther / ESC 2024)">
            <Row
              label="Facteurs de risque"
              value={rfList.length > 0 ? rfList.join(", ") : "Aucun facteur sélectionné"}
            />
            <Row label="Nombre de RF / Catégorie" value={`${rfclData.rfCount} — catégorie ${rfclData.rfCategory}`} />
            <Row label="RF-CL brut (table Winther)" value={`${rfclData.baseRFCL}%`} />
            <Row
              label="Modificateurs appliqués"
              value={modList.length > 0 ? modList.join(" · ") : "Aucun"}
            />
            <Row
              label="RF-CL ajusté final"
              value={`${rfclData.adjustedRFCL}%`}
              highlight
              highlightColor={catColor}
            />
          </Section>

          {/* Analyse bayésienne — probabilité post-test */}
          {bayesianData && (
            <BayesianSummarySection data={bayesianData} catColor={catColor} />
          )}

          {/* Décision */}
          <Section title="Stratification et conduite à tenir">
            <div
              className="mt-1 rounded-lg border p-4 space-y-3"
              style={{ borderColor: catColor, backgroundColor: `${catColor}0d` }}
            >
              <DecisionRow icon="D" label="Décision" text={decision.decision} color={catColor} />
              <DecisionRow icon="E" label="Examens" text={decision.examens} color={catColor} />
              <DecisionRow icon="S" label="Suivi" text={decision.suivi} color={catColor} />
            </div>
          </Section>

          {/* Notes */}
          <Section title="Notes / Prochains contacts">
            <div className="mt-1 space-y-2">
              <div className="h-8 border-b border-dashed border-[#cbd5e1] w-full" />
              <div className="h-8 border-b border-dashed border-[#cbd5e1] w-full" />
              <div className="h-8 border-b border-dashed border-[#cbd5e1] w-full" />
            </div>
          </Section>

          {/* OmniDoc */}
          <OmniDocButton />
        </div>

        {/* Footer */}
        <div className="border-t border-[#f1f5f9] bg-[#f8fafc] px-5 py-3">
          <p className="text-[10px] text-[#94a3b8] leading-relaxed">
            <strong>Réf. :</strong> Winther et al. JACC 2020;76:2421–2432 · ESC Guidelines CCS 2024 · ACS 2023
          </p>
          <p className="text-[10px] text-[#94a3b8] mt-0.5">Document généré par Douleur Thoracique au Cabinet — Usage strictement médical</p>
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div className="flex flex-col gap-3">
        {/* Primary actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1e293b] text-white font-semibold text-sm hover:bg-[#334155] transition-colors"
          >
            <Printer className="w-4 h-4" />
            Imprimer / Exporter en PDF
          </button>
          <button
            onClick={handleExportToOmniDoc}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#2563eb] text-white font-semibold text-sm hover:bg-[#1d4ed8] transition-colors"
          >
            <Send className="w-4 h-4" />
            Exporter vers OmniDoc
          </button>
        </div>
        
        {/* Secondary action */}
        <button
          onClick={onReset}
          className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-[#e2e8f0] text-[#475569] font-semibold text-sm hover:bg-[#f8fafc] transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Nouvelle consultation
        </button>
      </div>
    </div>
  )
}

// ── OmniDoc button ────────────────────────────────────────────────────────────
function OmniDocButton() {
  return (
    <a
      href="https://omnidoc.fr"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 w-full rounded-xl border-2 border-[#2563eb] bg-[#eff6ff] px-4 py-3 hover:bg-[#dbeafe] transition-colors group"
      aria-label="Contacter un cardiologue via OmniDoc"
    >
      <div className="w-9 h-9 rounded-lg bg-[#2563eb] flex items-center justify-center flex-shrink-0">
        <ExternalLink className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[#1d4ed8]">Contacter un cardiologue via OmniDoc</p>
        <p className="text-xs text-[#3b82f6] mt-0.5">Téléconsultation · Messagerie sécurisée · Avis spécialisé</p>
      </div>
      <ExternalLink className="w-4 h-4 text-[#2563eb] flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
    </a>
  )
}

// ── Bayesian summary section ──────────────────────────────────────────────────
function BayesianSummarySection({
  data,
  catColor,
}: {
  data: BayesianWizardData
  catColor: string
}) {
  const gainAbs = Math.abs(data.diagnosticGain)
  const gainSign = data.diagnosticGain >= 0 ? "+" : ""
  const scenario = data.scenario ?? "none"

  // Main accent color driven by scenario direction, not just gain distance
  const mainColor =
    scenario === "all-positive" || scenario === "mixed-positive"
      ? "#b91c1c"
      : scenario === "discordant"
      ? "#854d0e"
      : "#166534"

  const borderColor =
    scenario === "all-positive" || scenario === "mixed-positive"
      ? "#fca5a5"
      : scenario === "discordant"
      ? "#fde047"
      : "#86efac"

  const bgColor =
    scenario === "all-positive" || scenario === "mixed-positive"
      ? "#fef2f2"
      : scenario === "discordant"
      ? "#fefce8"
      : "#f0fdf4"

  return (
    <div>
      <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest mb-2 pb-1 border-b border-[#f1f5f9]">
        Analyse bayésienne — Probabilité post-test
      </p>
      <div
        className="rounded-lg border-2 p-3 space-y-2.5"
        style={{ borderColor, backgroundColor: bgColor }}
      >
        {/* Scenario badge */}
        {scenario !== "none" && (
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold"
            style={{ backgroundColor: borderColor + "66", color: mainColor }}
          >
            {(scenario === "all-positive" || scenario === "mixed-positive") && <TrendingUp className="w-3 h-3" />}
            {(scenario === "all-negative" || scenario === "mixed-negative") && <TrendingDown className="w-3 h-3" />}
            {scenario === "discordant" && <Minus className="w-3 h-3" />}
            {scenario === "all-negative" && "Séquence négative — exclusion probable"}
            {scenario === "mixed-negative" && "Tendance négative — exclusion majoritaire"}
            {scenario === "all-positive" && "Séquence positive — escalade vers coronarographie"}
            {scenario === "mixed-positive" && "Tendance positive — escalade probable"}
            {scenario === "discordant" && "Résultats discordants — tester le plus performant"}
          </div>
        )}

        {/* Pre / post comparison */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-center">
            <p className="text-[10px] text-[#64748b]">Pré-test</p>
            <p className="text-xl font-black" style={{ color: catColor }}>{data.preTestProbability}%</p>
          </div>
          <div className="flex-1 flex items-center gap-1">
            {data.steps.slice(1).map((_, i) => (
              <div key={i} className="flex-1 h-0.5 rounded-full" style={{ backgroundColor: borderColor }} />
            ))}
            {data.steps.length > 1 && (
              <div
                className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white"
                style={{ backgroundColor: mainColor }}
              >
                {data.events.length} test{data.events.length > 1 ? "s" : ""}
              </div>
            )}
            <div className="flex-1 h-0.5 rounded-full" style={{ backgroundColor: borderColor }} />
          </div>
          <div className="text-center">
            <p className="text-[10px]" style={{ color: mainColor }}>Post-test</p>
            <p className="text-xl font-black" style={{ color: mainColor }}>{data.postTestProbability.toFixed(1)}%</p>
          </div>
          <div
            className="flex items-center gap-1 text-sm font-bold"
            style={{ color: mainColor }}
          >
            {(scenario === "all-positive" || scenario === "mixed-positive") && <TrendingUp className="w-4 h-4" />}
            {(scenario === "all-negative" || scenario === "mixed-negative") && <TrendingDown className="w-4 h-4" />}
            {scenario === "discordant" && <Minus className="w-4 h-4" />}
            {gainSign}{data.diagnosticGain.toFixed(1)} pts
          </div>
        </div>

        {/* Steps list with directional badges */}
        <div className="space-y-1.5">
          {data.steps.slice(1).map((s, i) => {
            const ev = data.events[i]
            const isPos = ev?.outcome === "positive"
            const isNeg = ev?.outcome === "negative"
            const dotColor = isPos ? "#dc2626" : isNeg ? "#16a34a" : "#94a3b8"
            return (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span
                  className="w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: dotColor }}
                >
                  {i + 1}
                </span>
                <span className="text-[#475569] flex-1 min-w-0 truncate">{s.label}</span>
                {/* Directional badge */}
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: isPos ? "#fef2f2" : isNeg ? "#f0fdf4" : "#f8fafc",
                    color: isPos ? "#b91c1c" : isNeg ? "#166534" : "#64748b",
                  }}
                >
                  {isPos ? "↑" : isNeg ? "↓" : "—"}
                </span>
                <span className="font-semibold text-[#1e293b] flex-shrink-0">
                  {s.probability.toFixed(1)}%
                </span>
                <span
                  className="text-[11px] font-bold flex-shrink-0"
                  style={{ color: s.delta > 0 ? "#b91c1c" : s.delta < 0 ? "#15803d" : "#64748b" }}
                >
                  {s.delta >= 0 ? "+" : ""}{s.delta.toFixed(1)} pts
                </span>
              </div>
            )
          })}
        </div>

        {/* IC95 */}
        <p className="text-[10px] text-[#64748b]">
          IC95 post-test : [{data.postTestCiLow.toFixed(0)}–{data.postTestCiHigh.toFixed(0)}%]
          &nbsp;·&nbsp; Variation : {gainSign}{gainAbs.toFixed(1)} pts (informative)
        </p>

        {/* Décision finale — synthèse UNIQUE des 4 voies ESC 2024 (même moteur qu'à l'étape 4,
            garantit que l'écran et la fiche imprimable ne se contredisent jamais). */}
        <div
          className="rounded-lg border-2 p-2.5"
          style={{ borderColor: data.icaColor, backgroundColor: `${data.icaColor}12` }}
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs font-black" style={{ color: data.icaColor }}>
              Coronarographie {data.icaIndicated ? "INDIQUÉE" : "NON INDIQUÉE"}
            </p>
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-semibold text-[#94a3b8] uppercase tracking-wide">Confiance</span>
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: i < data.icaConfidence ? data.icaColor : "#e2e8f0" }}
                  />
                ))}
              </div>
            </div>
          </div>
          <p className="text-[11px] font-semibold mt-1" style={{ color: data.icaColor }}>{data.icaLabel}</p>
          <p className="text-[11px] text-[#475569] mt-1 leading-relaxed">{data.icaRationale}</p>
        </div>
      </div>
    </div>
  )
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest mb-2 pb-1 border-b border-[#f1f5f9]">
        {title}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function Row({
  label,
  value,
  highlight = false,
  highlightColor,
}: {
  label: string
  value: string
  highlight?: boolean
  highlightColor?: string
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-3">
      <span className="text-xs text-[#64748b] sm:w-52 flex-shrink-0">{label}</span>
      <span
        className="text-sm font-medium"
        style={highlight && highlightColor ? { color: highlightColor, fontWeight: 700 } : undefined}
      >
        {value}
      </span>
    </div>
  )
}

function DecisionRow({ icon, label, text, color }: { icon: string; label: string; text: string; color: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white mt-0.5"
        style={{ backgroundColor: color }}
      >
        {icon}
      </span>
      <div>
        <span className="text-xs font-semibold text-[#64748b]">{label} : </span>
        <span className="text-sm text-[#1e293b]">{text}</span>
      </div>
    </div>
  )
}
