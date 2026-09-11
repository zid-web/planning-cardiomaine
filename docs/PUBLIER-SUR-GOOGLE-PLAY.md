# Publier Cardiomaine sur Google Play

Procédure complète depuis un Mac, en repartant de zéro. L'application Android
est une **TWA** (Trusted Web Activity) : une coquille Android qui affiche le
site en plein écran, sans barre d'adresse. Le code de l'application, c'est ce
dépôt ; le projet Android ne fait que l'envelopper.

Il n'y a donc rien à porter, rien à réécrire en Kotlin, et aucun fichier Gradle
à assembler à la main : `bubblewrap`, l'outil de Google, génère le projet
Android complet à partir de `public/manifest.webmanifest`.

---

## Avant de commencer : trois points qui ne sont pas techniques

Ils bloquent la publication plus souvent que le code. À traiter en parallèle du
reste, pas à la fin.

### 1. L'application est derrière une authentification

Tout Cardiomaine est protégé par connexion. Un examinateur de Google qui
installe l'application ne voit qu'un écran de connexion et **refuse la
publication** s'il ne peut pas aller plus loin.

Play Console → *Règles et programmes* → *Contenu de l'application* → **Accès à
l'application** : déclarer que l'application est restreinte et fournir un
identifiant et un mot de passe de démonstration. Prévoir un compte dédié, avec
des données fictives, et ne pas le supprimer ensuite : il est réutilisé à chaque
mise à jour.

### 2. Une politique de confidentialité est obligatoire

L'application traite des données personnelles — noms, adresses e-mail,
plannings de praticiens. Google exige une **URL publique** de politique de
confidentialité, accessible sans connexion, et refuse la fiche sans elle. Elle
doit dire quelles données sont collectées, par qui elles sont hébergées
(Supabase), combien de temps elles sont conservées et comment demander leur
suppression.

Le formulaire **Sécurité des données** de la Console doit ensuite décrire les
mêmes choses, et être cohérent avec cette page.

### 3. Le délai de test fermé, pour un compte personnel

Un compte développeur **personnel** créé récemment doit faire tourner un test
fermé avec **au moins 12 testeurs inscrits pendant 14 jours continus** avant de
pouvoir demander l'accès à la production. Un compte **organisation** n'y est pas
soumis.

C'est un délai calendaire, pas une formalité : à lancer dès le premier envoi
utilisable. L'équipe du service suffit à réunir les 12 testeurs. Vérifier la
règle en vigueur dans la Console, ces conditions évoluent.

Compter aussi les **25 $ d'inscription** (une seule fois) et la **vérification
d'identité**, qui prend quelques jours.

---

## Étape 0 — D'abord fusionner les icônes

`bubblewrap` dérive les icônes Android du manifeste web **au moment de
l'initialisation**. Si le projet Android est généré avant que les bonnes icônes
soient déployées, l'application portera les anciennes.

Donc, dans cet ordre : fusionner la PR qui installe les icônes → attendre le
déploiement → vérifier que `https://<domaine>/icon-512x512.png` renvoie bien le
logo attendu → seulement ensuite générer le projet Android.

---

## Étape 1 — Outils sur le Mac

```sh
# Homebrew, si absent
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

brew install node
npm install -g @bubblewrap/cli

# Au premier lancement, bubblewrap télécharge lui-même le JDK et les
# outils Android dont il a besoin. Répondre oui.
bubblewrap doctor
```

Pas besoin d'Android Studio, ni du SDK Android installé à la main, ni de Java
installé séparément.

---

## Étape 2 — Générer le projet Android

Dans un dossier **hors** de ce dépôt (le projet Android a son propre cycle de
vie) :

```sh
mkdir -p ~/cardiomaine-android && cd ~/cardiomaine-android
bubblewrap init --manifest https://<domaine-de-production>/manifest.webmanifest
```

Si la keystore du projet précédent a pu être récupérée, la copier dans ce
dossier **avant** de lancer la commande et l'indiquer à l'invite : l'empreinte
déjà déclarée dans `assetlinks.json` reste alors valable. Sinon, une clé neuve
est créée et il faudra remplacer l'empreinte dans ce fichier.

Les réponses qui comptent :

| Question | Réponse | Pourquoi |
|---|---|---|
| Application ID / package name | `com.cardiomaine.planning` | Celui déjà déclaré dans `public/.well-known/assetlinks.json`. **Définitif** : identifie l'application sur le Play Store et ne peut plus changer après la première publication. Toute autre valeur casserait la vérification de domaine. |
| App name | `Planning Cardiomaine` | Nom complet, dans la fiche. |
| Short name | `Cardiomaine` | Sous l'icône de l'écran d'accueil : 12 caractères maximum, sinon Android tronque. |
| Display mode | `standalone` | Comme le manifeste. |
| Status bar color | `#0F2A47` | L'ardoise de la marque, comme `theme_color`. |
| Key store location | `./android.keystore` | Créée à cette étape — ou réutiliser celle du projet précédent, si elle a pu être récupérée, pour conserver la même empreinte que celle déjà déclarée. |
| Key alias | par ex. `cardiomaine` | À noter, il faudra le ressaisir. |

L'outil produit `twa-manifest.json` (la configuration, à versionner ou à
sauvegarder) et `android.keystore` (la clé de signature).

---

## Étape 3 — Sauvegarder la clé, tout de suite

```sh
cp android.keystore ~/Documents/cardiomaine-keystore-sauvegarde.keystore
```

Et le mot de passe dans un gestionnaire de mots de passe, pas dans un fichier
du projet.

La clé créée ici est une **clé d'envoi**. Avec la signature d'application Play,
activée par défaut, Google détient la vraie clé de signature et re-signe
l'application : si vous perdez la clé d'envoi, Google peut la réinitialiser.
C'est précisément ce qui manquait au projet précédent, dont la clé est restée
sur une machine inaccessible.

Ne jamais committer `android.keystore` dans un dépôt, même privé.

---

## Étape 4 — Vérification de domaine

Sans cette étape, l'application s'ouvre avec une barre d'adresse de navigateur
en haut de l'écran. Elle fonctionne, mais elle ne ressemble plus à une
application.

`public/.well-known/assetlinks.json` **est déjà en place**, pour le paquet
`com.cardiomaine.planning` et l'empreinte de la clé d'envoi. Reste donc :

1. Contrôler le fichier avant de déployer :

   ```sh
   node scripts/check-assetlinks.mjs
   ```

2. Après déploiement, contrôler qu'il est bien **servi** — c'est un test
   distinct, un hébergeur peut ignorer les dossiers commençant par un point :

   ```sh
   node scripts/check-assetlinks.mjs https://<domaine>
   ```

3. **Après le premier envoi sur Play**, récupérer l'empreinte de la clé de
   signature Play (Play Console → *Test et publication* → *Intégrité de
   l'application* → *Signature d'application Play*) et l'**ajouter** à la liste.
   C'est elle qui compte pour les utilisateurs : c'est l'oubli le plus fréquent,
   et il donne une application publiée qui affiche la barre d'adresse alors que
   l'APK de test était parfait.

Détails dans `docs/android/README.md`.

---

## Étape 5 — Construire et tester

```sh
bubblewrap build
```

Produit deux fichiers :

- `app-release-bundle.aab` — le format attendu par Play ;
- `app-release-signed.apk` — pour tester sur un téléphone branché en USB.

```sh
bubblewrap install          # installe l'APK sur le téléphone connecté
```

À vérifier sur le téléphone, avant de penser à publier :

- l'icône de lanceur est bien le logo, C ardoise et pulsation grenat ;
- **aucune barre d'adresse** en haut — sinon, revoir l'étape 4 ;
- la connexion fonctionne, le planning s'affiche, le bouton retour se comporte
  normalement ;
- l'export PDF du planning se télécharge.

---

## Étape 6 — La fiche Play

Éléments à préparer, tous obligatoires :

- **Icône** 512 × 512 (dans l'archive d'icônes Android, `play-store/icon-512.png`)
- **Image de présentation** 1024 × 500
- **Captures d'écran** : au moins 2 pour téléphone, en 16:9 ou 9:16
- **Description courte** (80 caractères) et **complète** (4000)
- **URL de politique de confidentialité** (voir plus haut)
- **Catégorie** : Médecine, ou Productivité
- **Questionnaire de classification du contenu**
- **Public cible**
- **Formulaire Sécurité des données**
- **Accès à l'application** : les identifiants de démonstration (voir plus haut)

Une application de planning interne à un service peut être publiée en **test
fermé** et n'être jamais ouverte au public : c'est souvent le bon régime pour
cet usage, et cela évite l'examen de production.

---

## Publier une mise à jour plus tard

Le site se met à jour tout seul — une TWA charge le site en direct, donc une
modification déployée est visible immédiatement dans l'application, sans
republier sur Play.

Il faut republier seulement si l'**enveloppe** change : icônes, nom, couleur de
barre d'état, ou pour suivre un niveau d'API exigé par Google.

```sh
cd ~/cardiomaine-android
# incrémenter appVersionCode et appVersionName dans twa-manifest.json
bubblewrap update          # réaligne le projet sur le manifeste web
bubblewrap build
```

`appVersionCode` doit **strictement augmenter** à chaque envoi, sinon Play
refuse le fichier.

---

## Si la génération échoue

- **`bubblewrap doctor`** d'abord : il signale le JDK ou les outils Android
  manquants et propose de les installer.
- **Erreur de synchronisation Gradle** : ne pas récupérer `gradle-wrapper.jar`
  à la main — c'est un exécutable qui tourne à chaque build, et un jar qui ne
  correspond pas au `distributionUrl` du fichier `.properties` reproduit
  exactement l'échec. `bubblewrap update` régénère un wrapper cohérent.
- **Niveau d'API cible refusé par Play** : mettre `@bubblewrap/cli` à jour
  (`npm i -g @bubblewrap/cli`) puis `bubblewrap update && bubblewrap build`.
