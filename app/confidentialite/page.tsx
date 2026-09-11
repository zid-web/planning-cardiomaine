import type { Metadata } from "next"
import Link from "next/link"
import { CardiomaineLockup } from "@/components/brand/cardiomaine-mark"

/**
 * Politique de confidentialité — page **publique**, sans authentification.
 *
 * Google Play exige une URL de politique de confidentialité accessible sans
 * connexion et refuse la fiche sans elle. La route est donc déclarée dans
 * `publicRoutes` du middleware (`proxy.ts`) : derrière l'authentification, elle
 * renverrait une redirection vers /auth/login et ne remplirait pas son office.
 *
 * Le contenu décrit le traitement réel, relevé dans le code : tables Supabase,
 * reconnaissance vocale du navigateur, analyse d'audience Vercel, solveur de
 * gardes hébergé sur Render. Trois éléments ne peuvent venir que de
 * l'exploitant et sont marqués À COMPLÉTER.
 */
export const metadata: Metadata = {
  title: "Politique de confidentialité — Planning Cardiomaine",
  description:
    "Données personnelles traitées par l'application de planning du service de cardiologie : nature, finalité, hébergement, durée de conservation et droits des personnes.",
}

const DERNIERE_MISE_A_JOUR = "11 septembre 2026"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold tracking-tight text-[#0F2A47]">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-slate-700">{children}</div>
    </section>
  )
}

function ACompleter({ children }: { children: React.ReactNode }) {
  return (
    <mark className="bg-[#FDECEE] px-1 font-medium text-[#8E2C39]">[À COMPLÉTER — {children}]</mark>
  )
}

export default function ConfidentialitePage() {
  return (
    <main
      className="min-h-screen bg-white px-5 py-12"
      style={{ fontFamily: "'Geist', system-ui, -apple-system, 'Helvetica Neue', sans-serif" }}
    >
      <div className="mx-auto max-w-[68ch]">
        <Link href="/auth/login" className="inline-block">
          <CardiomaineLockup />
        </Link>

        <h1 className="mt-10 text-3xl font-semibold tracking-tight text-[#0F2A47]">
          Politique de confidentialité
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          Dernière mise à jour : {DERNIERE_MISE_A_JOUR}
        </p>

        <p className="mt-8 text-[15px] leading-relaxed text-slate-700">
          Planning Cardiomaine est un outil interne de gestion du planning d&apos;un service de
          cardiologie : gardes, astreintes, vacations, coronarographies et congés. L&apos;accès est
          réservé aux praticiens et au personnel administratif du service, sur compte nominatif.
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-700">
          <strong className="font-semibold text-[#0F2A47]">
            L&apos;application ne traite aucune donnée de patient.
          </strong>{" "}
          Elle ne contient ni dossier médical, ni identité de patient, ni résultat d&apos;examen. Les
          données personnelles qu&apos;elle manipule sont celles des membres de l&apos;équipe, dans
          le cadre de l&apos;organisation du service.
        </p>

        <Section title="Responsable du traitement">
          <p>
            <ACompleter>raison sociale exacte, adresse du siège</ACompleter>
          </p>
          <p>
            Pour toute question ou demande relative à vos données :{" "}
            <ACompleter>adresse e-mail de contact</ACompleter>
          </p>
        </Section>

        <Section title="Données traitées">
          <p>Trois catégories, et rien d&apos;autre :</p>
          <p>
            <strong className="font-semibold text-[#0F2A47]">Identification et compte.</strong>{" "}
            Adresse e-mail, nom, prénom, photo de profil si vous en ajoutez une, mot de passe sous
            forme chiffrée, dates de création et de dernière modification du compte, et rôle
            (praticien ou administrateur).
          </p>
          <p>
            <strong className="font-semibold text-[#0F2A47]">
              Organisation du service.
            </strong>{" "}
            Affectations de planning, choix et échanges de gardes, demandes de modification,
            demandes et périodes de congés, participations à des congrès, indicateurs
            d&apos;équité de répartition, consignes de planning, notes privées, messages internes
            entre membres de l&apos;équipe, et retours envoyés sur l&apos;application.
          </p>
          <p>
            <strong className="font-semibold text-[#0F2A47]">Usage technique.</strong> Mesure
            d&apos;audience anonyme (pages consultées, performance d&apos;affichage), sans cookie
            publicitaire, sans profilage et sans identifiant permettant de vous reconnaître.
          </p>
        </Section>

        <Section title="Dictée vocale">
          <p>
            Certaines saisies peuvent être faites à la voix. Cette fonction utilise la
            reconnaissance vocale intégrée à votre navigateur&nbsp;: lorsque vous l&apos;activez,{" "}
            <strong className="font-semibold text-[#0F2A47]">
              l&apos;enregistrement audio est transmis par le navigateur aux serveurs de son
              éditeur
            </strong>{" "}
            (Google, pour Chrome) afin d&apos;être transcrit en texte. Ce traitement est celui de
            l&apos;éditeur du navigateur et relève de sa propre politique de confidentialité.
          </p>
          <p>
            L&apos;application ne conserve ni l&apos;audio ni aucun enregistrement&nbsp;: seul le
            texte transcrit est utilisé, et uniquement pour remplir le champ concerné. Le microphone
            n&apos;est jamais activé sans votre action explicite, et votre navigateur vous demande
            l&apos;autorisation au préalable. La fonction est facultative&nbsp;: la saisie au clavier
            reste possible partout.
          </p>
        </Section>

        <Section title="Finalités">
          <p>
            Les données servent exclusivement à faire fonctionner le planning du service&nbsp;:
            constituer et publier la grille, répartir équitablement les gardes et les astreintes,
            traiter les demandes de congés et de modification, permettre aux membres de
            l&apos;équipe de se coordonner, et corriger les anomalies de l&apos;application.
          </p>
          <p>
            Elles ne sont jamais utilisées à des fins commerciales, ne sont ni vendues ni louées, et
            ne servent à aucune publicité ni à aucun profilage.
          </p>
        </Section>

        <Section title="Base légale">
          <p>
            Le traitement repose sur l&apos;intérêt légitime du responsable à organiser la continuité
            des soins et la permanence des soins du service, ainsi que sur l&apos;exécution de la
            relation de travail ou d&apos;exercice qui lie les praticiens au service.
          </p>
        </Section>

        <Section title="Hébergement et sous-traitants">
          <p>
            L&apos;application s&apos;appuie sur trois prestataires techniques, chacun agissant comme
            sous-traitant&nbsp;:
          </p>
          <ul className="ml-5 list-disc space-y-2">
            <li>
              <strong className="font-semibold text-[#0F2A47]">Supabase</strong> — base de données
              et gestion des comptes. Héberge l&apos;ensemble des données décrites ci-dessus.
            </li>
            <li>
              <strong className="font-semibold text-[#0F2A47]">Vercel</strong> — hébergement du site
              et mesure d&apos;audience anonyme.
            </li>
            <li>
              <strong className="font-semibold text-[#0F2A47]">Render</strong> — service de calcul
              qui propose une répartition des gardes. Il reçoit les données de planning
              nécessaires au calcul, ainsi que les fichiers de planning importés.
            </li>
          </ul>
          <p>
            Régions d&apos;hébergement&nbsp;: <ACompleter>régions des trois services</ACompleter>.
            Lorsque des données sont traitées hors de l&apos;Union européenne, le transfert est
            encadré par les clauses contractuelles types de la Commission européenne prévues au
            contrat de chaque prestataire.
          </p>
        </Section>

        <Section title="Qui peut voir quoi">
          <p>
            Les membres du service voient la grille de planning, ce qui est la finalité même de
            l&apos;outil. Les administrateurs du planning accèdent en plus aux demandes de congés et
            de modification, ainsi qu&apos;aux indicateurs d&apos;équité, pour pouvoir les traiter.
            Les notes privées ne sont visibles que de leur auteur.
          </p>
          <p>
            Aucune donnée n&apos;est communiquée à un tiers en dehors des sous-traitants techniques
            listés ci-dessus, sauf obligation légale.
          </p>
        </Section>

        <Section title="Durée de conservation">
          <p>
            Les plannings et leur historique sont conservés{" "}
            <ACompleter>durée retenue, par exemple 3 ans</ACompleter> pour permettre le suivi de
            l&apos;équité de répartition dans le temps.
          </p>
          <p>
            Les données de compte sont conservées le temps de l&apos;exercice au sein du service.
            À votre départ, le compte est désactivé puis supprimé. Les affectations passées peuvent
            être conservées sous une forme qui ne permet plus de vous identifier, aux seules fins
            de statistiques d&apos;organisation.
          </p>
        </Section>

        <Section title="Sécurité">
          <p>
            L&apos;accès est protégé par mot de passe, et l&apos;ensemble des échanges entre votre
            appareil et les serveurs est chiffré. Les mots de passe ne sont jamais stockés en clair.
            Les droits d&apos;accès sont appliqués au niveau de la base de données, et non seulement
            dans l&apos;interface&nbsp;: un compte ne peut pas lire ce que son rôle ne lui permet pas
            de lire.
          </p>
        </Section>

        <Section title="Vos droits">
          <p>
            Vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, de
            limitation et d&apos;opposition sur vos données, ainsi que du droit à leur portabilité.
            Vous pouvez les exercer en écrivant à l&apos;adresse de contact indiquée plus haut.
            Une réponse vous sera apportée dans le délai d&apos;un mois.
          </p>
          <p>
            Si la réponse ne vous satisfait pas, vous pouvez saisir la Commission nationale de
            l&apos;informatique et des libertés (CNIL), 3 place de Fontenoy, 75334 Paris Cedex 07,
            ou sur <span className="whitespace-nowrap">www.cnil.fr</span>.
          </p>
        </Section>

        <Section title="Suppression de votre compte">
          <p>
            Pour demander la suppression de votre compte et des données qui s&apos;y rattachent,
            écrivez à l&apos;adresse de contact indiquée plus haut. La suppression est effectuée
            sous 30 jours, sous réserve des durées de conservation légales et des données de
            planning déjà anonymisées.
          </p>
        </Section>

        <Section title="Modifications">
          <p>
            Cette politique peut évoluer avec l&apos;application. La date de dernière mise à jour
            figure en haut de la page, et toute modification substantielle est signalée aux membres
            du service.
          </p>
        </Section>

        <footer className="mt-14 border-t border-slate-200 pt-6 text-sm text-slate-500">
          <Link href="/auth/login" className="text-[#B23A48] hover:underline">
            Retour à la connexion
          </Link>
        </footer>
      </div>
    </main>
  )
}
