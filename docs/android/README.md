# Vérification de domaine pour l'application Android (TWA)

Une TWA n'est pas un navigateur déguisé : Android ne masque la barre d'adresse
que si le domaine **prouve** qu'il autorise cette application. La preuve est un
fichier servi par le site :

    https://<domaine-de-production>/.well-known/assetlinks.json

Sans lui, l'application s'ouvre avec une barre d'adresse visible en haut de
l'écran — elle fonctionne, mais elle ne ressemble plus à une application. C'est
l'erreur la plus fréquente sur ce type de projet.

## Mise en place

1. Copier `assetlinks.template.json` vers `public/.well-known/assetlinks.json`
   (Next.js sert `public/` à la racine du domaine, dossiers en point compris).
2. Remplacer `package_name` par le nom de paquet choisi à la création du projet
   Android. **Il est définitif** : il identifie l'application sur le Play Store
   et ne peut plus changer après la première publication.
3. Remplacer les deux empreintes SHA-256 (voir ci-dessous).
4. Committer, déployer, puis vérifier avec :

       node scripts/check-assetlinks.mjs https://<domaine>

## Les deux empreintes, et pourquoi les deux

C'est le piège du dispositif. Avec la **signature d'application Play** (activée
par défaut), la clé que vous créez localement n'est qu'une *clé d'envoi* :
Google re-signe l'application avec sa propre *clé de signature* avant de la
distribuer. Le téléphone d'un utilisateur voit donc l'empreinte de Google, pas
la vôtre.

- **Clé de signature Play** — celle qui compte en production.
  Play Console → Test et publication → Intégrité de l'application →
  Signature d'application Play → empreinte SHA-256 du certificat.
- **Clé d'envoi** — celle de votre `android.keystore` local, nécessaire pour
  tester l'APK que vous installez vous-même avant publication :

      keytool -list -v -keystore android.keystore -alias <alias> \
        | grep -A1 SHA256

Mettre les deux dans `sha256_cert_fingerprints` : le format accepte une liste,
et rien ne casse à avoir une empreinte de trop. Ne mettre que la clé locale est
la cause la plus courante d'une application publiée qui affiche la barre
d'adresse alors qu'elle fonctionnait parfaitement en test.

## Icônes

Inutile de fournir les icônes Android à la main : `bubblewrap` les dérive du
manifeste web (`public/manifest.webmanifest`) à l'initialisation et à chaque
`bubblewrap update`. Il prend `icon-512x512.png` pour l'icône héritée et
`icon-maskable-512x512.png` pour l'icône adaptative.

En revanche l'icône est **compilée dans l'APK** : changer le manifeste ne met
pas à jour une application déjà construite. Après toute modification des icônes
du dépôt, relancer `bubblewrap update && bubblewrap build`.

Voir `docs/PUBLIER-SUR-GOOGLE-PLAY.md` pour la procédure complète.
