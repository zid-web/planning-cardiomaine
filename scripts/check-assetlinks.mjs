/**
 * Vérifie la vérification de domaine de l'application Android, avant ou après
 * déploiement :
 *
 *   node scripts/check-assetlinks.mjs                        # le fichier local
 *   node scripts/check-assetlinks.mjs https://mon-domaine.fr # le fichier servi
 *   node scripts/check-assetlinks.mjs https://mon-domaine.fr FA:1B:…
 *
 * Contrôle que le fichier existe, qu'il est du JSON valide, qu'il déclare la
 * relation attendue, et qu'aucun gabarit n'a été laissé en place. Le troisième
 * argument, optionnel, vérifie qu'une empreinte précise y figure — utile pour
 * confirmer que celle de la clé de signature Play a bien été ajoutée.
 *
 * Sans ce fichier, l'application s'ouvre avec une barre d'adresse de navigateur.
 */
import { readFile } from "node:fs/promises"

const LOCAL_PATH = "public/.well-known/assetlinks.json"
const [origin, expectedFingerprint] = process.argv.slice(2)

const fail = (msg) => {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

let source, raw

if (!origin) {
  source = LOCAL_PATH
  raw = await readFile(LOCAL_PATH, "utf8").catch(() =>
    fail(`${LOCAL_PATH} absent. Copier docs/android/assetlinks.template.json et le renseigner.`),
  )
  console.log(`Fichier local — non encore vérifié tel que servi. Relancer avec l'URL après déploiement.\n`)
} else {
  if (!/^https?:\/\//.test(origin)) fail(`« ${origin} » n'est pas une URL. Omettre l'argument pour contrôler le fichier local.`)
  source = new URL("/.well-known/assetlinks.json", origin).toString()

  const res = await fetch(source).catch((e) => fail(`${source} injoignable : ${e.message}`))
  if (!res.ok) {
    fail(
      `${source} répond ${res.status}. Le fichier doit être dans public/.well-known/ ; ` +
        `si l'hébergeur ignore les dossiers en point, le servir par une route.`,
    )
  }
  const type = res.headers.get("content-type") ?? ""
  if (!type.includes("json")) {
    console.warn(`⚠ content-type « ${type} » au lieu de application/json — accepté par Android, mais inhabituel.`)
  }
  raw = await res.text()
}

let data
try {
  data = JSON.parse(raw)
} catch (e) {
  fail(`le fichier n'est pas du JSON valide : ${e.message}`)
}
if (!Array.isArray(data) || data.length === 0) fail("le fichier doit être un tableau non vide.")

const norm = (f) => f.replace(/[^0-9a-fA-F]/g, "").toUpperCase()
let checked = 0

for (const entry of data) {
  const rel = entry?.relation ?? []
  if (!rel.includes("delegate_permission/common.handle_all_urls")) {
    fail("relation « delegate_permission/common.handle_all_urls » absente.")
  }
  const t = entry?.target ?? {}
  if (t.namespace !== "android_app") fail(`namespace « ${t.namespace} » au lieu de « android_app ».`)
  if (!t.package_name || t.package_name.startsWith("REMPLACER")) {
    fail("package_name non renseigné : le gabarit est encore en place.")
  }
  const prints = t.sha256_cert_fingerprints ?? []
  if (prints.length === 0) fail("aucune empreinte SHA-256 déclarée.")
  if (prints.some((p) => String(p).startsWith("REMPLACER"))) {
    fail("empreinte non renseignée : le gabarit est encore en place.")
  }

  console.log(`✓ ${t.package_name} — ${prints.length} empreinte(s)`)
  for (const p of prints) console.log(`    ${norm(p).match(/.{1,2}/g).join(":")}`)
  checked += prints.length

  if (expectedFingerprint) {
    if (prints.some((p) => norm(p) === norm(expectedFingerprint))) {
      console.log("✓ l'empreinte fournie est bien déclarée.")
    } else {
      fail("l'empreinte fournie n'est PAS déclarée dans le fichier.")
    }
  }
}

console.log(`\n✓ ${source} est en place (${checked} empreinte(s) au total).`)
console.log("Rappel : l'empreinte qui compte en production est celle de la clé de")
console.log("signature Play, pas celle de votre keystore local.")
