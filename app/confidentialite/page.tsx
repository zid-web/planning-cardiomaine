import type { Metadata } from "next"
import Link from "next/link"
import { CardiomaineLockup } from "@/components/brand/cardiomaine-mark"

/**
 * Politique de confidentialité — page publique, hors authentification.
 *
 * Elle est exigée par Google Play : la fiche est refusée sans une URL de
 * politique de confidentialité atteignable **sans connexion**. La route est
 * donc déclarée dans `publicRoutes` de `proxy.ts` ; si elle en sortait, la
 * validation Play échouerait sans autre signe qu'une redirection vers
 * /auth/login.
 *
 * Le formulaire « Sécurité des données » de la Play Console doit décrire
 * exactement les mêmes traitements que cette page : une divergence entre les
 * deux est un motif de rejet courant. En particulier, l'import de PDF et les
 * commandes vocales transitent par le solveur Render puis par l'API Anthropic
 * — c'est déclaré ici, ça doit l'être aussi dans le formulaire.
 */

/**
 * Mentions légales de la structure. Ces quatre valeurs ne sont pas
 * déductibles du code : elles engagent juridiquement la structure et doivent
 * être renseignées par elle avant toute publication.
 */
const EDITEUR = {
  raisonSociale: "Pôle Santé Sud",
  adresse: "28 rue de Guetteloup, 72000 Le Mans",
  contact: "sources@cardiomaine.fr",
  /**
   * Région du projet Supabase. `eu-west-2` est la région AWS de Londres :
   * l'hébergement est donc au Royaume-Uni, hors Union européenne depuis le
   * retrait britannique. Le nom trompe — ne pas le lire comme « Europe de
   * l'Ouest, donc UE » et supprimer la mention de transfert de la section 5.
   */
  regionSupabase: "Royaume-Uni, région AWS eu-west-2 (Londres)",
}

const MAJ = "12 septembre 2026"

export const metadata: Metadata = {
  title: "Politique de confidentialité — Planning Cardiomaine",
  description:
    "Données personnelles traitées par l'application Planning Cardiomaine : nature, finalités, destinataires, durées de conservation et droits des personnes.",
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold tracking-tight text-[#0F2A47]">{titre}</h2>
      <div className="mt-3 space-y-3 text-[0.9375rem] leading-relaxed text-slate-700">{children}</div>
    </section>
  )
}

export default function ConfidentialitePage() {
  return (
    <div className="h-full overflow-y-auto bg-white">
      <header className="border-b border-slate-200 px-6 py-5">
        <Link href="/auth/login" className="inline-block">
          <CardiomaineLockup subtitle="Planning médical" />
        </Link>
      </header>

      <main className="mx-auto max-w-2xl px-6 pb-24 pt-10">
        <h1 className="text-2xl font-semibold tracking-tight text-[#0F2A47]">
          Politique de confidentialité
        </h1>
        <p className="mt-2 text-sm text-slate-500">Dernière mise à jour : {MAJ}</p>

        <p className="mt-6 text-[0.9375rem] leading-relaxed text-slate-700">
          Planning Cardiomaine est un outil interne de gestion du planning de gardes d&apos;un
          service de cardiologie. Son accès est réservé aux praticiens et personnels autorisés
          de la structure : il n&apos;est pas ouvert au public et ne comporte aucune inscription
          libre. Cette page décrit les données personnelles traitées, pourquoi, par qui, et
          comment exercer vos droits.
        </p>

        <Section titre="1. Responsable du traitement">
          <p>
            {EDITEUR.raisonSociale}, {EDITEUR.adresse}.
          </p>
          <p>
            Pour toute question relative à vos données ou pour exercer vos droits :{" "}
            <span className="font-medium text-[#0F2A47]">{EDITEUR.contact}</span>.
          </p>
        </Section>

        <Section titre="2. Données traitées et finalités">
          <p>L&apos;application traite les catégories de données suivantes :</p>
          <ul className="ml-5 list-disc space-y-2">
            <li>
              <span className="font-medium text-[#0F2A47]">Identification et compte</span> —
              adresse e-mail, nom, prénom, rôle (administrateur ou praticien), photo de profil
              si vous en renseignez une. Ces données servent à vous authentifier et à vous
              identifier dans le planning.
            </li>
            <li>
              <span className="font-medium text-[#0F2A47]">Données professionnelles</span> —
              affectations de gardes et de vacations, absences et congés (y compris le motif
              lorsque vous le saisissez), consignes de planning, demandes de changement et
              commentaires associés, indicateurs d&apos;équité de répartition des gardes,
              participations à des congrès. Elles servent à établir, ajuster et consulter le
              planning du service.
            </li>
            <li>
              <span className="font-medium text-[#0F2A47]">Traçabilité des modifications</span> —
              chaque enregistrement du planning conserve l&apos;auteur, la date et la version
              précédente. Cet historique permet de comprendre et, si besoin, de revenir sur une
              modification.
            </li>
            <li>
              <span className="font-medium text-[#0F2A47]">Retours d&apos;expérience</span> — les
              messages que vous envoyez via le bouton de retour, rattachés à votre compte.
            </li>
            <li>
              <span className="font-medium text-[#0F2A47]">Mesure d&apos;audience technique</span>{" "}
              — statistiques de fréquentation et de performance des pages, collectées sous forme
              agrégée par Vercel Analytics et Vercel Speed Insights, sans cookie publicitaire ni
              profilage individuel.
            </li>
          </ul>
          <p>
            Aucune donnée de santé de patients n&apos;est traitée par l&apos;application. Les
            données concernent l&apos;organisation du travail des praticiens.
          </p>
        </Section>

        <Section titre="3. Base légale">
          <p>
            Le traitement repose sur l&apos;intérêt légitime de la structure à organiser la
            continuité des soins et la permanence des gardes de son service, et sur
            l&apos;exécution de la relation de travail ou de collaboration qui vous lie à elle.
          </p>
        </Section>

        <Section titre="4. Import de documents et commandes vocales">
          <p>
            Deux fonctions facultatives envoient des données à des services tiers pour être
            interprétées :
          </p>
          <ul className="ml-5 list-disc space-y-2">
            <li>
              <span className="font-medium text-[#0F2A47]">Import d&apos;un planning en PDF</span>{" "}
              — le fichier est transmis au service de génération de gardes, hébergé chez Render,
              qui en extrait le tableau au moyen de l&apos;API d&apos;Anthropic.
            </li>
            <li>
              <span className="font-medium text-[#0F2A47]">Commande vocale</span> — le texte issu
              de la dictée suit le même chemin pour être converti en modification de planning.
            </li>
          </ul>
          <p>
            Dans les deux cas, les données transmises se limitent au contenu du document ou de
            la commande et aux noms des praticiens nécessaires à l&apos;interprétation. Ces
            contenus ne sont pas utilisés pour entraîner des modèles. Si vous ne souhaitez pas y
            recourir, ces deux fonctions sont facultatives : la saisie manuelle du planning est
            toujours disponible.
          </p>
        </Section>

        <Section titre="5. Hébergement et destinataires">
          <p>
            Les données ne sont ni vendues, ni louées, ni transmises à des tiers à des fins
            commerciales. Elles sont accessibles aux personnes autorisées de la structure selon
            leur rôle : un praticien accède au planning et à ses propres demandes, un
            administrateur accède à l&apos;ensemble du planning et à la gestion des comptes.
          </p>
          <p>Les prestataires techniques suivants interviennent comme sous-traitants :</p>
          <ul className="ml-5 list-disc space-y-2">
            <li>
              <span className="font-medium text-[#0F2A47]">Supabase</span> — base de données et
              gestion des comptes ({EDITEUR.regionSupabase}).
            </li>
            <li>
              <span className="font-medium text-[#0F2A47]">Vercel</span> — hébergement de
              l&apos;application et mesure d&apos;audience technique.
            </li>
            <li>
              <span className="font-medium text-[#0F2A47]">Render</span> — service de génération
              automatique des gardes.
            </li>
            <li>
              <span className="font-medium text-[#0F2A47]">Anthropic</span> — interprétation des
              PDF importés et des commandes vocales, lorsque ces fonctions sont utilisées.
            </li>
          </ul>
          <p>
            Une partie de ces traitements a lieu hors de l&apos;Union européenne. La base de
            données est hébergée au Royaume-Uni, pays qui bénéficie d&apos;une décision
            d&apos;adéquation de la Commission européenne : les données y sont reconnues comme
            bénéficiant d&apos;un niveau de protection équivalent à celui du RGPD. Les autres
            prestataires sont des sociétés établies aux États-Unis ; les transferts vers ces
            dernières sont encadrés par les clauses contractuelles types de la Commission
            européenne, complétées le cas échéant par leur adhésion au cadre de protection des
            données UE—États-Unis.
          </p>
        </Section>

        <Section titre="6. Durées de conservation">
          <ul className="ml-5 list-disc space-y-2">
            <li>
              Compte et données de profil : conservés tant que vous exercez au sein du service,
              puis supprimés dans les trois mois suivant votre départ.
            </li>
            <li>
              Plannings, congés et historique des modifications : conservés trois ans, durée
              nécessaire au suivi de l&apos;organisation du service et au traitement
              d&apos;éventuelles réclamations.
            </li>
            <li>Retours d&apos;expérience : conservés un an.</li>
            <li>Statistiques d&apos;audience : agrégées, conservées treize mois au plus.</li>
          </ul>
        </Section>

        <Section titre="7. Sécurité">
          <p>
            L&apos;accès à l&apos;application requiert une authentification par mot de passe. Les
            mots de passe ne sont jamais stockés en clair : ils sont conservés sous forme
            d&apos;empreinte chiffrée par le service d&apos;authentification. Les échanges entre
            votre appareil et l&apos;application sont chiffrés en HTTPS. L&apos;accès aux données
            en base est restreint par des règles de sécurité au niveau de chaque table, selon le
            rôle de l&apos;utilisateur.
          </p>
        </Section>

        <Section titre="8. Suppression de votre compte et de vos données">
          <p>
            Vous pouvez demander la suppression de votre compte et des données associées en
            écrivant à <span className="font-medium text-[#0F2A47]">{EDITEUR.contact}</span>
            {" "}depuis l&apos;adresse e-mail rattachée à votre compte. La demande est traitée
            sous trente jours.
          </p>
          <p>
            Sont alors supprimés : votre compte, votre profil, vos demandes de changement et vos
            retours d&apos;expérience. Les affectations de gardes passées sont conservées de
            manière dissociée de votre identité lorsque leur suppression compromettrait
            l&apos;intégrité de l&apos;historique du planning du service — obligation
            d&apos;organisation à laquelle la structure reste tenue.
          </p>
        </Section>

        <Section titre="9. Vos droits">
          <p>
            Conformément au Règlement général sur la protection des données, vous disposez d&apos;un
            droit d&apos;accès, de rectification, d&apos;effacement, de limitation, d&apos;opposition
            et de portabilité sur vos données. Vous pouvez les exercer en écrivant à{" "}
            <span className="font-medium text-[#0F2A47]">{EDITEUR.contact}</span>.
          </p>
          <p>
            Si vous estimez, après nous avoir contactés, que vos droits ne sont pas respectés,
            vous pouvez adresser une réclamation à la Commission nationale de l&apos;informatique
            et des libertés (CNIL), 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07 —{" "}
            <a
              href="https://www.cnil.fr"
              className="font-medium text-[#0F2A47] underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              cnil.fr
            </a>
            .
          </p>
        </Section>

        <Section titre="10. Modifications">
          <p>
            Cette politique peut être mise à jour pour refléter une évolution de
            l&apos;application ou de la réglementation. La date de dernière mise à jour figure en
            haut de cette page.
          </p>
        </Section>

        <div className="mt-12 border-t border-slate-200 pt-6">
          <Link
            href="/auth/login"
            className="text-sm font-medium text-[#0F2A47] underline underline-offset-2"
          >
            Retour à la connexion
          </Link>
        </div>
      </main>
    </div>
  )
}
