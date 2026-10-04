/**
 * Run: bunx tsx lib/__tests__/guard-calendar.test.ts
 */
import assert from "node:assert/strict"
import { guardDatesInMonth, guardDayKind, guardFill, toggleGuardDoctor } from "@/lib/guard-calendar"

function main() {
  // Types de jour
  assert.equal(guardDayKind("2026-10-03"), "samedi")
  assert.equal(guardDayKind("2026-10-04"), "dimanche")
  assert.equal(guardDayKind("2026-10-05"), null) // lundi ordinaire
  assert.equal(guardDayKind("2026-05-14"), "ferie") // Ascension (jeudi)
  assert.equal(guardDayKind("2026-05-25"), "ferie") // lundi de Pentecôte
  assert.equal(guardDayKind("2026-11-01"), "ferie") // Toussaint tombe un dimanche : le férié prime
  assert.equal(guardDayKind("2026-12-25"), "ferie")
  assert.equal(guardDayKind("n'importe quoi"), null)

  // Jours d'un mois : octobre 2026 = 4 samedis + 4 dimanches + 0 férié en semaine (1ᵉʳ nov. hors mois)
  const oct = guardDatesInMonth(2026, 9)
  assert.deepEqual(oct.slice(0, 4), ["2026-10-03", "2026-10-04", "2026-10-10", "2026-10-11"])
  assert.equal(oct.length, 9) // samedis 3,10,17,24,31 + dimanches 4,11,18,25 (le 1ᵉʳ nov. est hors mois)
  assert.ok(!oct.includes("2026-11-01"))
  // Mai 2026 : 1ᵉʳ (ven. férié), 8 (ven. férié), 14 (jeu. férié), 25 (lun. férié) en plus des week-ends
  const may = guardDatesInMonth(2026, 4)
  for (const d of ["2026-05-01", "2026-05-08", "2026-05-14", "2026-05-25", "2026-05-02", "2026-05-03"]) {
    assert.ok(may.includes(d), d)
  }
  assert.ok(!may.includes("2026-05-05"))
  assert.deepEqual(may, [...may].sort())

  // Bascule d'un médecin
  assert.deepEqual(toggleGuardDoctor([], "W"), ["W"])
  assert.deepEqual(toggleGuardDoctor(["W"], "M"), ["W", "M"])
  assert.deepEqual(toggleGuardDoctor(["W", "M"], "W"), ["M"])
  assert.deepEqual(toggleGuardDoctor(["W"], "W"), [])
  const frozen = Object.freeze(["B"])
  assert.deepEqual(toggleGuardDoctor(frozen, "Z"), ["B", "Z"]) // n'altère pas l'entrée

  // Taux de remplissage
  const data: Record<string, string[]> = {
    "2026-10-03|Garde Matin": ["B"],
    "2026-10-03|Garde Nuit": ["B"],
    "2026-10-04|Garde Matin": ["Z"],
  }
  const fill = guardFill(oct, (d, r) => data[`${d}|${r}`] ?? [])
  assert.deepEqual(fill, { total: 9, complete: 1, partial: 1 })

  console.log("✅ guard-calendar tests passed")
}

main()
