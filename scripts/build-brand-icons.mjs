/**
 * Rasterise la marque Cardiomaine dans les tailles attendues par le navigateur,
 * iOS et Android. À relancer si la géométrie de la marque change :
 *
 *   node scripts/build-brand-icons.mjs
 *
 * Nécessite Playwright (`npx playwright install chromium` si absent) : le rendu
 * passe par Chromium pour que jointures et bouts ronds soient identiques à ce
 * que l'application affiche.
 *
 * La géométrie « pleine » vit dans components/brand/cardiomaine-mark.tsx et
 * n'est pas recopiée ici de mémoire : le script la relit et refuse de tourner si
 * les deux fichiers ont divergé.
 */
import { chromium } from "playwright"
import { mkdir, writeFile, readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const OUT = resolve(ROOT, "public")

const INK = "#0F2A47"
const PULSE = "#B23A48"
const INK_REVERSED = "#FFFFFF"
const PULSE_REVERSED = "#EE8894"

/** Boîte serrée sur le dessin — doit rester égale à MARK_VIEWBOX_TIGHT. */
const TIGHT = "6.7 5.8 52.4 52.4"

/** Dessin complet : à partir de 24 px. */
const FULL = {
  c: { d: "M45.5 15.9A21 21 0 1 0 45.5 48.1", w: 8.5 },
  pulse: { d: "M16.5 32H32l5-11.5 6 23 4-11.5h9", w: 4.2 },
  viewBox: TIGHT,
}

/**
 * Dessin simplifié, pour 16 px et moins. À cette taille le filet de 4,2 tombe
 * sous le pixel, et surtout la ligne isoélectrique croise le pic R en formant
 * une croix : la marque devient illisible. On garde donc le seul pic R, réduit
 * à sa barre, dégagé des bras du C. C'est un dessin distinct, pas une
 * réduction d'échelle — ne pas l'utiliser en grand.
 *
 * Alternatives écartées à cette taille : le chevron (se lit « A »), le complexe
 * raccourci (refait la croix), le C seul (perd la cardiologie).
 */
const COMPACT = {
  c: { d: "M45.5 15.1A22 22 0 1 0 45.5 48.9", w: 11 },
  pulse: { d: "M38 19V45", w: 8 },
  viewBox: "4.5 4 55 55",
}

// Garde-fou anti-divergence avec le composant React.
const component = await readFile(resolve(ROOT, "components/brand/cardiomaine-mark.tsx"), "utf8")
for (const [name, part] of Object.entries({ c: FULL.c, pulse: FULL.pulse })) {
  if (!component.includes(part.d) || !component.includes(`strokeWidth="${part.w}"`)) {
    throw new Error(
      `Le tracé « ${name} » du dessin complet ne correspond plus à ` +
        `components/brand/cardiomaine-mark.tsx. Reportez la modification dans les deux fichiers.`,
    )
  }
}

const mark = (art, ink, pulse) => `
  <svg viewBox="${art.viewBox}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block">
    <path d="${art.c.d}" fill="none" stroke="${ink}" stroke-width="${art.c.w}" stroke-linecap="round"/>
    <path d="${art.pulse.d}" fill="none" stroke="${pulse}" stroke-width="${art.pulse.w}"
          stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`

/**
 * `inset` est la part du côté laissée libre autour de la marque.
 *
 * Les tuiles `maskable` sont recadrées par Android, au pire en cercle inscrit :
 * la marque doit tenir dans le cercle central de 80 % du côté. Le dessin étant
 * plus large que haut, ses extrémités partent vers les angles du carré, donc
 * 29 % de marge — sinon la queue de la pulsation est coupée. D'où deux jeux de
 * fichiers : les `any`, cadrés serré, et les `maskable`, cadrés large.
 */
const TARGETS = [
  { file: "favicon-16x16.png", size: 16, art: COMPACT, ground: null, ink: INK, pulse: PULSE, inset: 0 },
  { file: "favicon-32x32.png", size: 32, art: FULL, ground: null, ink: INK, pulse: PULSE, inset: 0 },
  { file: "icon-light-32x32.png", size: 32, art: FULL, ground: null, ink: INK, pulse: PULSE, inset: 0 },
  { file: "icon-dark-32x32.png", size: 32, art: FULL, ground: null, ink: INK_REVERSED, pulse: PULSE_REVERSED, inset: 0 },
  // iOS ne gère pas la transparence des icônes d'accueil et applique lui-même
  // l'arrondi : fond plein, à fond perdu, sans coins arrondis dans le fichier.
  { file: "apple-icon.png", size: 180, art: FULL, ground: INK, ink: INK_REVERSED, pulse: PULSE_REVERSED, inset: 0.19 },
  { file: "icon-192x192.png", size: 192, art: FULL, ground: INK, ink: INK_REVERSED, pulse: PULSE_REVERSED, inset: 0.19 },
  { file: "icon-512x512.png", size: 512, art: FULL, ground: INK, ink: INK_REVERSED, pulse: PULSE_REVERSED, inset: 0.19 },
  { file: "icon-maskable-192x192.png", size: 192, art: FULL, ground: INK, ink: INK_REVERSED, pulse: PULSE_REVERSED, inset: 0.29 },
  { file: "icon-maskable-512x512.png", size: 512, art: FULL, ground: INK, ink: INK_REVERSED, pulse: PULSE_REVERSED, inset: 0.29 },
]

const browser = await chromium.launch()
try {
  await mkdir(OUT, { recursive: true })
  for (const t of TARGETS) {
    const page = await browser.newPage({
      viewport: { width: t.size, height: t.size },
      deviceScaleFactor: 1,
    })
    const pad = Math.round(t.size * t.inset)
    await page.setContent(
      `<!doctype html><style>
         html,body{margin:0;padding:0;width:${t.size}px;height:${t.size}px}
         body{background:${t.ground ?? "transparent"};
              display:flex;align-items:center;justify-content:center}
         .m{width:${t.size - pad * 2}px;height:${t.size - pad * 2}px}
       </style><div class="m">${mark(t.art, t.ink, t.pulse)}</div>`,
    )
    await writeFile(resolve(OUT, t.file), await page.screenshot({ omitBackground: t.ground === null }))
    await page.close()
    console.log(
      `${t.file.padEnd(28)} ${t.size}×${t.size}` +
        `${t.art === COMPACT ? "  dessin simplifié" : ""}${t.ground ? "" : "  transparent"}`,
    )
  }
} finally {
  await browser.close()
}
