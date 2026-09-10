# Geist, sous-ensemble pour l'export PDF

`geist-regular-subset.ttf` et `geist-semibold-subset.ttf` sont des
sous-ensembles de **Geist** (400 et 600), la police que l'application déclare
utiliser. Ils servent uniquement à `lib/planning-pdf.ts`, qui embarque la police
dans le PDF téléchargé pour que le document imprimé ait la même typographie que
l'écran, au lieu de l'Helvetica standard des PDF.

Licence : SIL Open Font License 1.1, texte complet dans `OFL.txt`. Le
sous-ensemble en est une version modifiée, ce que l'OFL autorise ; le nom
« Geist » est conservé car les glyphes ne sont pas retouchés, seule la
couverture est réduite.

## Provenance et régénération

Les fichiers complets viennent de Google Fonts (Geist v5) :

```
curl -o geist-400.ttf 'https://fonts.gstatic.com/s/geist/v5/gyBhhwUxId8gMGYQMKR3pzfaWI_RnOM4nQ.ttf'
curl -o geist-600.ttf 'https://fonts.gstatic.com/s/geist/v5/gyBhhwUxId8gMGYQMKR3pzfaWI_RQuQ4nQ.ttf'
```

Le sous-ensemble est produit avec `fontTools` (`pip install fonttools`) :

```
UNI="U+0020-007E,U+00A0-00FF,U+0152-0153,U+0178,U+2018-201A,U+201C-201E,U+2013,U+2014,U+2019,U+2022,U+2026,U+00B7,U+20AC,U+2030,U+2039,U+203A"
python3 -m fontTools.subset geist-400.ttf --unicodes="$UNI" \
  --layout-features='' --no-hinting --desubroutinize \
  --drop-tables+=GSUB,GPOS,GDEF --output-file=geist-regular-subset.ttf
```

La couverture retenue est le Latin de base, le supplément Latin-1 (donc tous
les accents français), les ligatures œ/Œ, Ÿ, et la ponctuation typographique
(tirets cadratin et demi-cadratin, guillemets français et anglais, apostrophe
courbe, points de suspension, puce, point médian, euro, pour mille).
73 Ko par graisse au départ, 15 Ko après.

**Tout caractère hors de cette couverture ferait échouer le tracé du texte**,
et non seulement l'afficher de travers : `lib/planning-pdf.ts` normalise donc
le texte avant de le dessiner. Si vous élargissez la couverture ici, élargissez
`PDF_TEXT_CHARSET` là-bas — et inversement.

Après toute modification :

```
node scripts/build-pdf-fonts.mjs
```

qui régénère `lib/planning-pdf-fonts.ts` (les mêmes octets en base64, pour que
la police soit disponible à l'identique côté navigateur et côté serveur, sans
lecture de fichier ni requête réseau).
