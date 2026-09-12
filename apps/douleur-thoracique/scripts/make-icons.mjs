/**
 * Génère les icônes PNG de l'application (PWA + apple-touch) sans dépendance
 * externe : rastérisation maison en suréchantillonnage ×4 puis encodage PNG
 * via `zlib`. Relancer avec `npm run icons` après toute retouche du motif.
 *
 * Motif : cœur rouge sur fond ardoise, traversé par un tracé ECG blanc.
 */
import { deflateSync } from "node:zlib"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const ICONS_DIR = join(ROOT, "public", "icons")

const SLATE = [30, 41, 59] // #1e293b — couleur de thème
const RED = [220, 38, 38] // #dc2626
const WHITE = [255, 255, 255]

const SS = 4 // facteur de suréchantillonnage

// ── Primitives géométriques ────────────────────────────────────────────────

/** Cœur implicite : (x² + y² − 1)³ − x²·y³ ≤ 0, centré et normalisé. */
function insideHeart(x, y) {
  const a = x * x + y * y - 1
  return a * a * a - x * x * y * y * y <= 0
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared))
  const cx = ax + t * dx
  const cy = ay + t * dy
  return Math.hypot(px - cx, py - cy)
}

/** Tracé ECG en coordonnées normalisées [0,1]² — un complexe PQRST complet. */
const ECG_POINTS = [
  [0.04, 0.5],
  [0.26, 0.5],
  [0.32, 0.44],
  [0.38, 0.5],
  [0.44, 0.5],
  [0.48, 0.62],
  [0.54, 0.16],
  [0.6, 0.72],
  [0.65, 0.5],
  [0.74, 0.5],
  [0.8, 0.38],
  [0.86, 0.5],
  [0.96, 0.5],
]

function nearPolyline(x, y, points, halfWidth) {
  for (let i = 0; i < points.length - 1; i += 1) {
    const [ax, ay] = points[i]
    const [bx, by] = points[i + 1]
    if (distanceToSegment(x, y, ax, ay, bx, by) <= halfWidth) return true
  }
  return false
}

// ── Rendu ──────────────────────────────────────────────────────────────────

/**
 * @param {number} size      taille finale en pixels
 * @param {object} options
 * @param {number} options.inset   marge du motif (0 = plein cadre, 0.1 = 10 %)
 * @param {number} options.radius  rayon des coins, en fraction de la taille
 */
function renderIcon(size, { inset = 0, radius = 0.22 } = {}) {
  const hi = size * SS
  const accumulator = new Float64Array(size * size * 4)

  const cornerRadius = radius * hi
  const ecgHalfWidth = 0.028
  const heartScale = 0.34 // demi-largeur du cœur en fraction du cadre

  for (let py = 0; py < hi; py += 1) {
    for (let px = 0; px < hi; px += 1) {
      const u = (px + 0.5) / hi
      const v = (py + 0.5) / hi

      // Coins arrondis : hors du rectangle arrondi, le pixel reste transparent.
      if (cornerRadius > 0 && !insideRoundedRect(px + 0.5, py + 0.5, hi, hi, cornerRadius)) {
        continue
      }

      let color = SLATE

      // Repère du motif, resserré par `inset` (zone de sécurité maskable).
      const mx = (u - 0.5) / (1 - 2 * inset)
      const my = (v - 0.5) / (1 - 2 * inset)

      // Cœur : coordonnées normalisées avec y vers le haut, remonté d'un cran
      // pour que la pointe reste dans le cadre.
      const hx = mx / heartScale
      const hy = (0.06 - my) / heartScale
      if (Math.abs(hx) <= 1.6 && hy >= -1.6 && hy <= 1.6 && insideHeart(hx, hy)) {
        color = RED
      }

      // Tracé ECG par-dessus le cœur.
      if (nearPolyline(mx + 0.5, my + 0.5, ECG_POINTS, ecgHalfWidth)) {
        color = WHITE
      }

      const ox = Math.floor(px / SS)
      const oy = Math.floor(py / SS)
      const index = (oy * size + ox) * 4
      accumulator[index] += color[0]
      accumulator[index + 1] += color[1]
      accumulator[index + 2] += color[2]
      accumulator[index + 3] += 255
    }
  }

  const samples = SS * SS
  const pixels = Buffer.alloc(size * size * 4)
  for (let i = 0; i < size * size; i += 1) {
    const alpha = accumulator[i * 4 + 3] / samples
    // Les composantes sont accumulées non prémultipliées : on les ramène à la
    // moyenne des échantillons couverts pour éviter un liseré sombre.
    const covered = alpha === 0 ? 1 : accumulator[i * 4 + 3] / 255
    pixels[i * 4] = Math.round(accumulator[i * 4] / covered)
    pixels[i * 4 + 1] = Math.round(accumulator[i * 4 + 1] / covered)
    pixels[i * 4 + 2] = Math.round(accumulator[i * 4 + 2] / covered)
    pixels[i * 4 + 3] = Math.round(alpha)
  }
  return pixels
}

function insideRoundedRect(x, y, width, height, radius) {
  const cx = Math.min(Math.max(x, radius), width - radius)
  const cy = Math.min(Math.max(y, radius), height - radius)
  return Math.hypot(x - cx, y - cy) <= radius
}

/** Aplatit la transparence sur un fond opaque (exigence des icônes Apple). */
function flatten(pixels, background) {
  const out = Buffer.from(pixels)
  for (let i = 0; i < out.length; i += 4) {
    const alpha = out[i + 3] / 255
    out[i] = Math.round(out[i] * alpha + background[0] * (1 - alpha))
    out[i + 1] = Math.round(out[i + 1] * alpha + background[1] * (1 - alpha))
    out[i + 2] = Math.round(out[i + 2] * alpha + background[2] * (1 - alpha))
    out[i + 3] = 255
  }
  return out
}

// ── Encodage PNG ───────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, "ascii"), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function encodePNG(pixels, size) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0 // filtre « None »
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // profondeur
  ihdr[9] = 6 // RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

// ── Sortie ─────────────────────────────────────────────────────────────────

function write(name, pixels, size) {
  const path = join(ICONS_DIR, name)
  writeFileSync(path, encodePNG(pixels, size))
  console.log(`écrit ${name} (${size}×${size})`)
}

mkdirSync(ICONS_DIR, { recursive: true })

for (const size of [192, 512, 1024]) {
  write(`icon-${size}.png`, renderIcon(size), size)
}

// Icônes maskables : fond plein bord à bord (la plateforme applique son
// propre masque), motif réduit dans la zone sûre des 80 % centraux.
for (const size of [192, 512]) {
  write(`icon-maskable-${size}.png`, renderIcon(size, { inset: 0.14, radius: 0 }), size)
}

// iOS n'accepte pas la transparence et applique lui-même le masque.
write("apple-touch-icon.png", flatten(renderIcon(180, { radius: 0 }), SLATE), 180)

writeFileSync(
  join(ROOT, "public", "icon.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="Douleur thoracique">
  <rect width="100" height="100" rx="22" fill="#1e293b"/>
  <path d="M50 78C34 66 22 57 22 45a13 13 0 0 1 28-6 13 13 0 0 1 28 6c0 12-12 21-28 33Z" fill="#dc2626"/>
  <polyline points="${ECG_POINTS.map(([x, y]) => `${(x * 100).toFixed(1)},${(y * 100).toFixed(1)}`).join(" ")}"
    fill="none" stroke="#ffffff" stroke-width="5.5" stroke-linejoin="round" stroke-linecap="round"/>
</svg>
`,
)
console.log("écrit icon.svg")
