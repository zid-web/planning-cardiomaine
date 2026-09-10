/**
 * Encode les sous-ensembles Geist de lib/fonts/ en base64 dans
 * lib/planning-pdf-fonts.ts :
 *
 *   node scripts/build-pdf-fonts.mjs
 *
 * Pourquoi du base64 dans un module et non un fichier lu à l'exécution :
 * `buildPlanningPdf` tourne dans les deux sens. Côté navigateur
 * (`lib/download-planning-pdf.ts`, le chemin que l'interface préfère), il n'y a
 * pas de système de fichiers ; côté serveur (`app/api/export-planning-pdf`), la
 * présence de `public/` dans le paquet déployé n'est pas garantie. Un module
 * fonctionne à l'identique des deux côtés, sans I/O ni requête.
 *
 * Il est importé dynamiquement par lib/planning-pdf.ts, donc placé dans un
 * segment à part : les ~41 Ko ne sont téléchargés qu'au premier export.
 *
 * Voir lib/fonts/README.md pour la provenance et la commande de sous-ensemble.
 */
import { readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

const FONTS = [
  { constant: "GEIST_REGULAR_BASE64", file: "lib/fonts/geist-regular-subset.ttf", label: "Geist 400" },
  { constant: "GEIST_SEMIBOLD_BASE64", file: "lib/fonts/geist-semibold-subset.ttf", label: "Geist 600" },
]

/** Coupe la chaîne base64 pour que le fichier reste diffable et relisible. */
const wrap = (s, width = 100) => s.match(new RegExp(`.{1,${width}}`, "g")).join("\\\n")

let out = `// Fichier généré par scripts/build-pdf-fonts.mjs — ne pas modifier à la main.
// Provenance, licence (OFL 1.1) et commande de sous-ensemble : lib/fonts/README.md.
`

for (const f of FONTS) {
  const bytes = await readFile(resolve(ROOT, f.file))
  out += `\n/** ${f.label}, sous-ensemble latin étendu — ${(bytes.length / 1024).toFixed(1)} Ko. */\n`
  out += `export const ${f.constant} =\n  "${wrap(bytes.toString("base64"))}"\n`
  console.log(`${f.label.padEnd(10)} ${(bytes.length / 1024).toFixed(1)} Ko → base64 ${((bytes.length * 4) / 3 / 1024).toFixed(1)} Ko`)
}

await writeFile(resolve(ROOT, "lib/planning-pdf-fonts.ts"), out)
console.log("écrit : lib/planning-pdf-fonts.ts")
