import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft, ShieldCheck, BookOpen, Calculator, WifiOff } from "lucide-react"

export const metadata: Metadata = {
  title: "Références & mentions — Douleur Thoracique au Cabinet",
  description:
    "Sources bibliographiques des modèles RF-CL, CACS-CL et de la chaîne bayésienne, mentions d'usage et politique de confidentialité de l'application.",
}

const REFERENCES = [
  {
    id: "winther-2020",
    citation:
      "Winther S, Schmidt SE, Mayrhofer T, et al. Incorporating Coronary Calcification Into Pre-Test Assessment of the Likelihood of Coronary Artery Disease. J Am Coll Cardiol. 2020;76(21):2421-2432.",
    usage:
      "Table RF-CL (sexe × âge × symptômes × nombre de facteurs de risque) et formule de régression CACS-CL, appliquées telles que publiées.",
  },
  {
    id: "knuuti-2018",
    citation:
      "Knuuti J, Ballo H, Juarez-Orozco LE, et al. The performance of non-invasive tests to rule-in and rule-out significant coronary artery disease. Eur Heart J. 2018;39(35):3322-3330.",
    usage:
      "Rapports de vraisemblance (LR+ / LR−) de chaque test non invasif, utilisés pour la mise à jour bayésienne séquentielle de la probabilité.",
  },
  {
    id: "esc-2024",
    citation:
      "Vrints C, Andreotti F, Koskinas KC, et al. 2024 ESC Guidelines for the management of chronic coronary syndromes. Eur Heart J. 2024;45(36):3415-3537.",
    usage:
      "Classification symptomatique, seuils de probabilité clinique, algorithmes de sélection des examens (Fig. 7 et 8) et conduite à tenir par catégorie de risque.",
  },
  {
    id: "esc-2023",
    citation:
      "Byrne RA, Rossello X, Coughlan JJ, et al. 2023 ESC Guidelines for the management of acute coronary syndromes. Eur Heart J. 2023;44(38):3720-3826.",
    usage: "Critères d'alerte immédiate de l'étape de triage et orientation en urgence.",
  },
]

export default function ReferencesPage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans">
      <div className="sticky top-0 z-20 border-b border-[#e2e8f0] bg-white print:hidden">
        <div className="mx-auto max-w-2xl px-4 pb-3 pt-2">
          <Link
            href="/"
            className="mb-2 inline-flex items-center gap-1 text-xs text-[#64748b] transition-colors hover:text-[#1e293b]"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Retour au parcours
          </Link>
          <h1 className="text-sm font-bold text-[#1e293b]">Références & mentions</h1>
          <p className="text-xs text-[#64748b]">Sources des calculs, usage et confidentialité</p>
        </div>
      </div>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6 pb-16">
        <Section icon={<Calculator className="h-4 w-4" />} title="Ce que l'application calcule">
          <p>
            Le parcours enchaîne cinq étapes : triage des situations nécessitant une prise en charge immédiate,
            classification symptomatique, probabilité clinique <strong>RF-CL</strong>, pondération par le score
            calcique <strong>CACS-CL</strong> et modificateurs cliniques, puis mise à jour bayésienne séquentielle
            selon les tests non invasifs réalisés.
          </p>
          <p>
            Les moteurs de calcul sont repris à l&apos;identique de l&apos;application CoroPath : mêmes tables,
            mêmes coefficients, mêmes seuils de décision. Cette application n&apos;en est qu&apos;une extraction
            autonome, centrée sur la consultation au cabinet.
          </p>
        </Section>

        <Section icon={<BookOpen className="h-4 w-4" />} title="Bibliographie">
          <ul className="space-y-3">
            {REFERENCES.map((reference) => (
              <li key={reference.id} className="rounded-lg border border-[#e2e8f0] bg-white p-3">
                <p className="text-[11px] leading-relaxed text-[#1e293b]">{reference.citation}</p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-[#64748b]">{reference.usage}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section icon={<ShieldCheck className="h-4 w-4" />} title="Confidentialité">
          <p>
            Tous les calculs sont exécutés sur l&apos;appareil. Aucune donnée saisie — âge, sexe, symptômes,
            facteurs de risque, résultats d&apos;examens — n&apos;est transmise à un serveur, ni enregistrée en
            dehors de la session en cours. La fiche de consultation est générée localement au moment de
            l&apos;impression ou de l&apos;export.
          </p>
        </Section>

        <Section icon={<WifiOff className="h-4 w-4" />} title="Hors ligne et installation">
          <p>
            L&apos;application est une Progressive Web App : une fois ouverte une première fois, elle reste
            utilisable sans connexion. Elle s&apos;installe depuis le navigateur sur Android, iOS (Safari →
            Partager → Sur l&apos;écran d&apos;accueil), Windows, macOS et Linux.
          </p>
        </Section>

        <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] p-3">
          <p className="text-[11px] font-semibold text-[#991b1b]">Usage strictement médical</p>
          <p className="mt-1 text-[11px] leading-relaxed text-[#7f1d1d]">
            Outil d&apos;aide à la décision destiné aux professionnels de santé. Il ne remplace ni l&apos;examen
            clinique, ni le jugement du praticien, ni les recommandations en vigueur. La responsabilité de la
            décision diagnostique et thérapeutique reste entière au prescripteur.
          </p>
        </div>
      </main>
    </div>
  )
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-[#e2e8f0] bg-white p-4">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-[#1e293b]">
        <span className="text-[#64748b]">{icon}</span>
        {title}
      </h2>
      <div className="space-y-2 text-xs leading-relaxed text-[#475569]">{children}</div>
    </section>
  )
}
