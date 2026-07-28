/**
 * Repli local si le backend voice échoue (ex. doctor_in=null côté Pydantic).
 * Couvre les consignes simples les plus fréquentes — pas un second solveur.
 */
export type LocalVoiceCommand = {
  date: string
  slot: string
  activity: string
  doctor_out?: string | null
  doctor_in: string
  confidence: "high" | "low"
}

const DAY_OFFSETS: Record<string, number> = {
  dimanche: 0,
  lundi: 1,
  mardi: 2,
  mercredi: 3,
  jeudi: 4,
  vendredi: 5,
  samedi: 6,
}

function toIsoLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function resolveRelativeDate(text: string, referenceIso: string): string | null {
  const ref = new Date(`${referenceIso}T12:00:00`)
  if (Number.isNaN(ref.getTime())) return null
  const t = text.toLowerCase()

  if (/\baprès[- ]?demain\b/.test(t)) {
    ref.setDate(ref.getDate() + 2)
    return toIsoLocal(ref)
  }
  if (/\bdemain\b/.test(t)) {
    ref.setDate(ref.getDate() + 1)
    return toIsoLocal(ref)
  }
  if (/\baujourd'?hui\b/.test(t)) return toIsoLocal(ref)

  const isoMatch = t.match(/\b(20\d{2}-\d{2}-\d{2})\b/)
  if (isoMatch) return isoMatch[1]

  for (const [name, targetDow] of Object.entries(DAY_OFFSETS)) {
    if (!t.includes(name)) continue
    const cur = ref.getDay()
    let delta = (targetDow - cur + 7) % 7
    if (delta === 0 && !/\bce\b/.test(t)) delta = 7
    if (/\bprochain/.test(t) && delta === 0) delta = 7
    const out = new Date(ref)
    out.setDate(ref.getDate() + delta)
    return toIsoLocal(out)
  }
  return null
}

function matchKnownDoctor(token: string, known: string[]): string | null {
  const raw = token.trim()
  if (!raw) return null
  const exact = known.find((k) => k === raw)
  if (exact) return exact
  const upper = raw.toUpperCase()
  return known.find((k) => k.toUpperCase() === upper) || null
}

function findDoctorsInText(text: string, known: string[]): string[] {
  // Codes les plus longs d'abord (DAAS, Val avant D/V)
  const sorted = [...known].sort((a, b) => b.length - a.length)
  const found: string[] = []
  const lower = text
  for (const code of sorted) {
    const re = new RegExp(`(?:^|[^A-Za-z0-9])${code}(?:[^A-Za-z0-9]|$)`, "i")
    if (re.test(lower) && !found.includes(code)) found.push(code)
  }
  return found
}

function inferActivitySlot(text: string): { activity: string; slot: string } {
  const t = text.toLowerCase()
  if (/\bnct\b/.test(t)) return { activity: "NCT", slot: "nuit" }
  if (/cong[eéè]s|vacances?|\babsent/.test(t)) return { activity: "VACANCES", slot: "matin" }
  if (/congr[eéè]s/.test(t)) return { activity: "CONGRES", slot: "matin" }
  if (/\brythmo\b/.test(t)) {
    return { activity: "RYTHMO", slot: /\bmatin\b/.test(t) ? "matin" : "am" }
  }
  if (/\bcoro\b|\bcoroscanner\b|\bcoronaro/.test(t)) {
    return { activity: "CORO", slot: /\bmatin\b/.test(t) ? "matin" : "am" }
  }
  if (/\bastreinte\b|\batl\b/.test(t)) {
    if (/\bnuit\b|\bsoir\b/.test(t)) return { activity: "ASTREINTE", slot: "nuit" }
    if (/\bmidi\b|\bapr[eè]s/.test(t)) return { activity: "ASTREINTE", slot: "am" }
    return { activity: "ASTREINTE", slot: "matin" }
  }
  if (/\bgarde\b/.test(t)) {
    if (/\bnuit\b|\bsoir\b/.test(t)) return { activity: "GARDE", slot: "nuit" }
    if (/\bmidi\b|\bapr[eè]s/.test(t)) return { activity: "GARDE", slot: "am" }
    return { activity: "GARDE", slot: "matin" }
  }
  if (/\bnuit\b|\bsoir\b/.test(t)) return { activity: "GARDE", slot: "nuit" }
  return { activity: "GARDE", slot: "nuit" }
}

/**
 * Parse heuristique d’une consigne FR → ParsedCommand-like.
 * Retourne null si trop ambigu (pas de médecin / pas de date).
 */
export function parseVoiceCommandLocally(
  text: string,
  referenceDate: string,
  knownDoctors: string[],
): LocalVoiceCommand | null {
  const trimmed = (text || "").trim()
  if (!trimmed || !knownDoctors?.length) return null

  const date = resolveRelativeDate(trimmed, referenceDate)
  if (!date) return null

  const doctors = findDoctorsInText(trimmed, knownDoctors)
  if (!doctors.length) return null

  const { activity, slot } = inferActivitySlot(trimmed)
  const t = trimmed.toLowerCase()

  // "X remplace Y"
  const remplace = trimmed.match(
    /\b([A-Za-z]{1,4})\s+remplace\s+([A-Za-z]{1,4})\b/i,
  )
  if (remplace) {
    const din = matchKnownDoctor(remplace[1], knownDoctors)
    const dout = matchKnownDoctor(remplace[2], knownDoctors)
    if (din) {
      return {
        date,
        slot,
        activity,
        doctor_in: din,
        doctor_out: dout,
        confidence: "low",
      }
    }
  }

  // Absence : premier médecin mentionné
  if (activity === "VACANCES" || activity === "CONGRES") {
    return {
      date,
      slot,
      activity,
      doctor_in: doctors[0],
      doctor_out: null,
      confidence: "low",
    }
  }

  // Affectation simple : "S est de garde" / "garde de nuit pour W"
  let doctorIn = doctors[0]
  if (/\bpour\b/i.test(trimmed) && doctors.length) {
    doctorIn = doctors[doctors.length - 1]
  }

  return {
    date,
    slot,
    activity,
    doctor_in: doctorIn,
    doctor_out: null,
    confidence: t.includes("remplace") ? "low" : "low",
  }
}

/** True si l’erreur upstream ressemble au bug doctor_in=null Pydantic. */
export function isDoctorInValidationError(message: string): boolean {
  const m = (message || "").toLowerCase()
  return (
    m.includes("doctor_in") &&
    (m.includes("string_type") ||
      m.includes("valid string") ||
      m.includes("nonetype") ||
      m.includes("input_value=none") ||
      m.includes("manquant"))
  )
}
