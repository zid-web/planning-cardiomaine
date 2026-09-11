# Marque Cardiomaine — « Le C battant »

Un C ouvert, l'initiale, dont l'ouverture laisse sortir la pulsation. Retenue
parmi six pistes proposées ; les cinq écartées (Systole, Rotation, Quatre
cavités, Tracé P·QRS·T, Diastole) ont été supprimées.

Ce dossier contient la marque **hors application** : en-tête de courrier, PDF,
diaporama, impression. Pour l'écran, on ne prend pas ces fichiers mais le
composant `components/brand/cardiomaine-mark.tsx`, qui est la géométrie de
référence.

| Fichier | Usage |
|---|---|
| `03-c-battant.svg` | couleur, sur fond clair |
| `03-c-battant-reserve.svg` | en réserve sur le panneau sombre `#0F2A47` |
| `03-c-battant-mono.svg` | une seule encre — impression, tampon, photocopie |

Grille de 64 × 64, sans texte et sans police embarquée : le nom se compose à
côté, il n'est pas vectorisé dans la marque. Palette — grenat `#B23A48`, ardoise
`#0F2A47`, celle que porte déjà l'écran de connexion.

Ne pas utiliser ces fichiers sous 24 px : le favicon 16 px a son propre dessin
(voir plus bas).

## Où la marque est utilisée

- `components/brand/cardiomaine-mark.tsx` — géométrie de référence, `CardiomaineMark`
  et `CardiomaineLockup` ; c'est le seul endroit où le tracé est défini pour l'écran
- `public/icon.svg` — favicon vectoriel, qui bascule en réserve selon le thème système
- `public/favicon-16x16.png` — **dessin simplifié** : à 16 px la ligne isoélectrique
  croise le pic R et forme une croix, donc seul le pic est conservé
- `public/favicon-32x32.png`, `icon-light-32x32.png`, `icon-dark-32x32.png`
- `public/apple-icon.png` (180) — fond blanc plein, à fond perdu : iOS applique son
  propre arrondi et ne gère pas la transparence. Le fond est blanc et non ardoise
  pour que la tuile d'écran d'accueil montre le logo dans sa forme principale, C
  ardoise et pulsation grenat, et non son négatif
- `public/icon-192x192.png`, `icon-512x512.png` — usage `any`
- `public/icon-maskable-{192,512}.png` — usage `maskable`, cadrés large : Android
  recadre au pire en cercle inscrit, et le dessin étant plus large que haut, un
  cadrage serré coupait la queue de la pulsation
- l'écran de connexion, en réserve sur le panneau `#0F2A47`
- l'en-tête du planning
- `lib/planning-pdf.ts` — l'export PDF, où les tracés sont redessinés en
  `drawSvgPath` (pdf-lib) plutôt qu'en PNG embarqué, pour rester nets à
  l'impression. Les valeurs y sont recopiées : à reporter en cas de
  modification de la géométrie. Le PDF embarque aussi Geist
  (voir `lib/fonts/README.md`), pour que le document imprimé partage la
  typographie de l'écran et non l'Helvetica standard des PDF

Pour régénérer les PNG après une modification de la géométrie :

```
npm i -D playwright && npx playwright install chromium   # si absent
node scripts/build-brand-icons.mjs
```

Le script relit le composant React et s'arrête si les deux ont divergé.
