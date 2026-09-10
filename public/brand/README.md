# Pistes d'identité — Cardiomaine

Six pistes de marque proposées pour l'application de planning, **aucune n'est encore
retenue**. Rien dans ce dossier n'est référencé par le code : `public/icon.svg` et les
favicons portent toujours l'icône du template de départ.

| Piste | Nom | Idée |
|---|---|---|
| 01 | Systole | Sept barres (les sept jours) dont la hauteur dessine un complexe QRS |
| 02 | Rotation | Anneau de garde en quatre segments, un seul en grenat, tracé au centre |
| 03 | Le C battant | Monogramme C ouvert, la pulsation sort par l'ouverture |
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

Une fois une piste choisie, la déclinaison à produire : `public/icon.svg`,
`favicon-16x16`, `favicon-32x32`, `icon-light/dark-32x32`, `apple-icon.png` (180),
`icon-192x192`, `icon-512x512`, le lockup de l'écran de connexion, et le
`theme_color` du manifeste.
