# Pistes d'identité — Cardiomaine

Six pistes de marque proposées pour l'application de planning. **La piste 03,
« Le C battant », a été retenue** et est désormais celle de l'application.

La géométrie de référence vit dans `components/brand/cardiomaine-mark.tsx`, et les
icônes (favicons, tuiles iOS et Android) sont produites par
`scripts/build-brand-icons.mjs`. Les cinq autres pistes restent ici comme trace de
la proposition : elles ne sont référencées par aucun code et peuvent être
supprimées.

| Piste | Nom | Idée |
|---|---|---|
| 01 | Systole | Sept barres (les sept jours) dont la hauteur dessine un complexe QRS |
| 02 | Rotation | Anneau de garde en quatre segments, un seul en grenat, tracé au centre |
| 03 | **Le C battant** | **Retenue.** Monogramme C ouvert, la pulsation sort par l'ouverture |
| 04 | Quatre cavités | Le cœur découpé aux gouttières de la grille du planning |
| 05 | Tracé P·QRS·T | Le complexe juste, sans stylisation |
| 06 | Diastole | Cœur en réserve dans une tuile pleine, traversé par la ligne isoélectrique |

Trois déclinaisons par piste :

- `NN-nom.svg` — couleur, sur fond clair
- `NN-nom-reserve.svg` — en réserve sur le panneau sombre `#0F2A47`
- `NN-nom-mono.svg` — une seule encre (impression, tampon, fax)

Toutes sont sur une grille de 64 × 64, sans texte et sans police embarquée.
Palette : grenat `#B23A48`, ardoise `#0F2A47`, atone `#9BB0C4` — celle que porte
déjà l'écran de connexion.

## Où la marque retenue est utilisée

- `components/brand/cardiomaine-mark.tsx` — géométrie de référence, `CardiomaineMark`
  et `CardiomaineLockup` ; c'est le seul endroit où le tracé est défini pour l'écran
- `public/icon.svg` — favicon vectoriel, qui bascule en réserve selon le thème système
- `public/favicon-16x16.png` — **dessin simplifié** : à 16 px la ligne isoélectrique
  croise le pic R et forme une croix, donc seul le pic est conservé
- `public/favicon-32x32.png`, `icon-light-32x32.png`, `icon-dark-32x32.png`
- `public/apple-icon.png` (180) — fond plein, à fond perdu : iOS applique son propre
  arrondi et ne gère pas la transparence
- `public/icon-192x192.png`, `icon-512x512.png` — usage `any`
- `public/icon-maskable-{192,512}.png` — usage `maskable`, cadrés large : Android
  recadre au pire en cercle inscrit, et le dessin étant plus large que haut, un
  cadrage serré coupait la queue de la pulsation
- l'écran de connexion, en réserve sur le panneau `#0F2A47`
- l'en-tête du planning et `components/navbar.tsx`

Pour régénérer les PNG après une modification de la géométrie :

```
npm i -D playwright && npx playwright install chromium   # si absent
node scripts/build-brand-icons.mjs
```

Le script relit le composant React et s'arrête si les deux ont divergé.
