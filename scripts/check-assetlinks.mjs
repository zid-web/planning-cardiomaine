/**
 * Vérifie que la vérification de domaine de l'application Android est en place :
 *
 *   node scripts/check-assetlinks.mjs https://mon-domaine.fr
 *   node scripts/check-assetlinks.mjs https://mon-domaine.fr FA:1B:...  # compare une empreinte
 *
 * Contrôle que /.well-known/assetlinks.json est servi, qu'il est du JSON
 * valide, qu'il déclare bien la relation attendue, et qu'aucun gabarit n'a été
 * laissé en place. Sans cela l'application s'ouvre avec une barre d'adresse.
 */
const [origin, expectedFingerprint] = process.argv.slice(2)

if (!origin) {
  console.error("usage : node scripts/check-assetlinks.mjs https://<domaine> [empreinte SHA-256]")
  process.exit(2)
}

const url = new URL("/.well-known/assetlinks.json", origin).toString()
const fail = (msg) => {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

const res = await fetch(url).catch((e) => fail(`${url} injoignable : ${e.message}`))
if (!res.ok) fail(`${url} répond ${res.status}. Le fichier doit être dans public/.well-known/.`)

const type = res.headers.get("content-type") ?? ""
if (!type.includes("json")) {
  console.warn(`⚠ content-type « ${type} » au lieu de application/json — accepté par Android, mais inhabituel.`)
}

const raw = await res.text()
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

console.log(`\n✓ ${url} est en place (${checked} empreinte(s) au total).`)
console.log("Rappel : l'empreinte qui compte en production est celle de la clé de")
console.log("signature Play, pas celle de votre keystore local.")
