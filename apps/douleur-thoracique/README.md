# Douleur Thoracique au Cabinet

Application autonome d'aide à la décision pour la **douleur thoracique en consultation**.
C'est une extraction du module « Douleur thoracique au cabinet » de CoroPath : la logique
de calcul de la probabilité clinique (**RF-CL**, **CACS-CL**) et la chaîne bayésienne y
sont reprises **à l'identique**, sans aucune modification des coefficients ni des seuils.

L'application CoroPath n'est pas modifiée : ce dossier ne contient qu'une copie du module,
empaquetée comme application indépendante.

## Ce que contient l'application

Un parcours en cinq étapes, entièrement côté client :

1. **Triage** — critères d'alerte imposant une prise en charge immédiate (ESC 2023).
2. **Caractérisation** — classification symptomatique en trois composantes (ESC 2024).
3. **RF-CL** — probabilité pré-test selon la table Winther 2020, puis pondération par les
   modificateurs cliniques et par le score calcique via la formule **CACS-CL**.
4. **Stratification** — conduite à tenir, sélection des examens et mise à jour bayésienne
   séquentielle de la probabilité en fonction des tests réalisés (rapports de vraisemblance
   Knuuti 2018).
5. **Résumé** — fiche de consultation imprimable ou exportable.

Les moteurs de calcul vivent dans `lib/` : `bayesian-cad.ts` (RF-CL continu, enrichissement,
mise à jour bayésienne), `cacs-cl.ts` (formule Winther 2020), `pathway.ts` (algorithmes de
prise en charge) et `anoca-score.ts`. Ces quatre fichiers sont repris tels quels de CoroPath.

## PWA installable

- **Manifeste** : `app/manifest.ts` → servi en `/manifest.webmanifest`.
- **Icônes** : `public/icons/`, régénérables par `npm run icons`
  (`scripts/make-icons.mjs`, aucune dépendance externe).
- **Service worker** : `scripts/sw-template.js`, assemblé en `out/sw.js` par
  `scripts/build-sw.mjs` à la fin de `npm run build`. La totalité des fichiers produits est
  pré-téléchargée dès la première visite, si bien que l'application fonctionne **hors ligne**
  même sur un écran jamais ouvert. La version du cache est un hachage du contenu : une
  nouvelle version invalide automatiquement l'ancienne.

Installation côté utilisateur :

| Plateforme | Chemin |
|---|---|
| Android (Chrome, Edge, Samsung Internet) | bouton « Installer l'application », ou menu ⋮ → « Installer l'application » |
| iOS / iPadOS (Safari) | Partager → « Sur l'écran d'accueil » |
| Windows / macOS / Linux (Chrome, Edge) | icône d'installation dans la barre d'adresse |

## Développement

```bash
npm install
npm run dev        # http://localhost:3000 — service worker désactivé
npm run typecheck  # tsc --noEmit
npm run build      # export statique dans out/ + génération de out/sw.js
npm start          # sert out/ localement pour vérifier le mode hors ligne
```

Le service worker n'est enregistré qu'en production : en développement, toute instance
héritée est désinscrite pour ne pas servir une version périmée.

## Déploiement

`npm run build` produit un site **statique** dans `out/` : il se déploie tel quel sur
n'importe quel hébergeur (Vercel, Netlify, Cloudflare Pages, GitHub Pages, un simple
serveur de fichiers). Aucun backend, aucune base de données, aucune variable
d'environnement.

Sur Vercel, créer un projet distinct dont le **répertoire racine** est
`apps/douleur-thoracique` — ne pas le rattacher au projet du planning, qui vit à la racine
du dépôt.

Deux exigences pour que l'installation soit proposée : servir en **HTTPS** et servir
`/sw.js` sans cache long (`Cache-Control: no-cache`), afin que les mises à jour soient
détectées.

### Application Android / iOS téléchargeable

L'export statique est directement empaquetable :

- **Android, Play Store** : TWA via [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap)
  à partir de l'URL de production ; le fichier `/.well-known/assetlinks.json` doit être servi
  par le domaine pour la vérification.
- **Android et iOS, un seul code** : [Capacitor](https://capacitorjs.com), avec `out/`
  comme `webDir`.

## Confidentialité

Aucune donnée saisie ne quitte l'appareil : tous les calculs sont exécutés dans le
navigateur, rien n'est envoyé à un serveur ni conservé au-delà de la session. La fiche de
consultation est générée localement.

## Références

- Winther S, et al. *J Am Coll Cardiol.* 2020;76(21):2421-2432 — RF-CL et CACS-CL.
- Knuuti J, et al. *Eur Heart J.* 2018;39(35):3322-3330 — rapports de vraisemblance.
- Vrints C, et al. *Eur Heart J.* 2024;45(36):3415-3537 — ESC 2024, syndromes coronariens chroniques.
- Byrne RA, et al. *Eur Heart J.* 2023;44(38):3720-3826 — ESC 2023, syndromes coronariens aigus.

> Outil d'aide à la décision destiné aux professionnels de santé. Il ne remplace ni l'examen
> clinique, ni le jugement du praticien, ni les recommandations en vigueur.
