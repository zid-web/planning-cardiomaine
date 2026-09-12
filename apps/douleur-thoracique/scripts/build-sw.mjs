/**
 * Assemble `out/sw.js` à partir de `scripts/sw-template.js` en y injectant la
 * liste des fichiers réellement produits par `next build` et une version de
 * cache dérivée de leur contenu.
 *
 * Conséquence : toute modification du code invalide automatiquement l'ancien
 * cache, et l'application entière est pré-téléchargée dès la première visite —
 * elle reste donc utilisable hors ligne même si l'utilisateur n'a parcouru
 * qu'un seul écran.
 */
import { createHash } from "node:crypto"
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const OUT_DIR = join(ROOT, "out")
const TEMPLATE = join(ROOT, "scripts", "sw-template.js")

/** Extensions embarquées dans le pré-cache. */
const PRECACHED_EXTENSIONS = new Set([
  ".html",
  ".js",
  ".css",
  ".json",
  ".webmanifest",
  // Charges utiles RSC des navigations client de l'export statique.
  ".txt",
  ".png",
  ".svg",
  ".ico",
  ".woff",
  ".woff2",
])

function walk(dir) {
  const entries = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) entries.push(...walk(path))
    else entries.push(path)
  }
  return entries
}

/** `out/references/index.html` → `/references/` ; `out/index.html` → `/`. */
function toUrl(absolutePath) {
  const rel = relative(OUT_DIR, absolutePath).split(sep).join("/")
  if (rel === "index.html") return "/"
  if (rel.endsWith("/index.html")) return `/${rel.slice(0, -"index.html".length)}`
  return `/${rel}`
}

let files
try {
  files = walk(OUT_DIR)
} catch {
  console.error("out/ introuvable — lancer `next build` avant `build-sw`.")
  process.exit(1)
}

const precached = files
  .filter((path) => {
    const lower = path.toLowerCase()
    if (lower.endsWith(".map") || lower.endsWith("/sw.js")) return false
    const dot = lower.lastIndexOf(".")
    return dot !== -1 && PRECACHED_EXTENSIONS.has(lower.slice(dot))
  })
  .sort()

const hash = createHash("sha256")
for (const path of precached) {
  hash.update(relative(OUT_DIR, path))
  hash.update(readFileSync(path))
}
const version = hash.digest("hex").slice(0, 12)

const urls = [...new Set(precached.map(toUrl))].sort()

const source = readFileSync(TEMPLATE, "utf8")
  .replace("__CACHE_VERSION__", version)
  .replace("__PRECACHE_MANIFEST__", JSON.stringify(urls, null, 2))

writeFileSync(join(OUT_DIR, "sw.js"), source)
console.log(`out/sw.js écrit — version ${version}, ${urls.length} ressources pré-cachées.`)
