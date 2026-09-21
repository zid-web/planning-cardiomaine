/**
 * Vérifie que les textes de la fiche Play tiennent dans les limites de la
 * Console, qui tronque sans prévenir :
 *
 *   node scripts/check-fiche-play.mjs
 *
 * Les textes vivent dans docs/android/FICHE-PLAY.md, dans les deux premiers
 * blocs de code du document.
 */
import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const md = await readFile(resolve(ROOT, "docs/android/FICHE-PLAY.md"), "utf8")

const blocks = [...md.matchAll(/```\n([\s\S]*?)```/g)].map((m) => m[1].trimEnd())

const LIMITS = [
  { label: "Description courte", max: 80 },
  { label: "Description complète", max: 4000 },
]

let ok = true
LIMITS.forEach((l, i) => {
  const text = blocks[i]
  if (text === undefined) {
    console.error(`✗ ${l.label} : bloc introuvable dans FICHE-PLAY.md`)
    ok = false
    return
  }
  // Play compte les caractères, pas les octets.
  const n = [...text].length
  const verdict = n <= l.max ? "✓" : "✗"
  if (n > l.max) ok = false
  console.log(`${verdict} ${l.label.padEnd(22)} ${String(n).padStart(4)} / ${l.max}`)
})

if (!ok) process.exit(1)
