/**
 * Run: bunx tsx lib/__tests__/guard-picks-view.test.ts
 */
import assert from "node:assert/strict"
import {
  defaultGuardCursor,
  guardMonthKey,
  stepGuardMonth,
  stepGuardSemester,
  summarizeGuardSlot,
  type PickLike,
} from "@/lib/guard-picks-view"

function main() {
  // --- Résumé d'un créneau ---
  const picks: PickLike[] = [
    { date: "2026-10-03", guard_type: "Garde Matin", status: "pending", doctor_code: "B" },
    { date: "2026-10-03", guard_type: "Garde Matin", status: "pending", doctor_code: "Z" },
    { date: "2026-10-03", guard_type: "Garde Nuit", status: "approved", doctor_code: "W" },
    { date: "2026-10-03", guard_type: "Garde Nuit", status: "pending", doctor_code: "M" },
    { date: "2026-10-04", guard_type: "Garde Matin", status: "rejected", doctor_code: "B" },
  ]
  assert.deepEqual(summarizeGuardSlot(picks, "2026-10-03", "Garde Matin"), {
    state: "pending",
    pendingCount: 2,
  })
  // Une demande approuvée l'emporte sur les demandes en attente
  assert.deepEqual(summarizeGuardSlot(picks, "2026-10-03", "Garde Nuit"), {
    state: "approved",
    doctor: "W",
    pendingCount: 1,
  })
  // Refusée seule = libre ; autre date = libre
  assert.equal(summarizeGuardSlot(picks, "2026-10-04", "Garde Matin").state, "free")
  assert.equal(summarizeGuardSlot(picks, "2026-10-10", "Garde Nuit").state, "free")

  // --- Curseur ---
  assert.deepEqual(defaultGuardCursor(new Date(2026, 9, 3)), { semester: 2, year: 2026, month0: 9 })
  assert.deepEqual(defaultGuardCursor(new Date(2026, 7, 31)), { semester: 1, year: 2026, month0: 7 })
  assert.deepEqual(defaultGuardCursor(new Date(2027, 0, 5)), { semester: 1, year: 2027, month0: 0 })

  // Passage d'un semestre / d'une année à l'autre
  const aug = { semester: 1 as const, year: 2026, month0: 7 }
  assert.deepEqual(stepGuardMonth(aug, 1), { semester: 2, year: 2026, month0: 8 })
  const dec = { semester: 2 as const, year: 2026, month0: 11 }
  assert.deepEqual(stepGuardMonth(dec, 1), { semester: 1, year: 2027, month0: 0 })
  assert.deepEqual(stepGuardMonth({ semester: 1, year: 2027, month0: 0 }, -1), dec)
  assert.deepEqual(stepGuardMonth({ semester: 2, year: 2026, month0: 8 }, -1), aug)
  assert.deepEqual(stepGuardMonth({ semester: 2, year: 2026, month0: 9 }, 1), { semester: 2, year: 2026, month0: 10 })

  // Aller-retour mois sur 30 mois : on revient toujours au point de départ
  let c = defaultGuardCursor(new Date(2026, 3, 1))
  const start = c
  for (let i = 0; i < 30; i++) c = stepGuardMonth(c, 1)
  for (let i = 0; i < 30; i++) c = stepGuardMonth(c, -1)
  assert.deepEqual(c, start)
  // Le semestre reste cohérent avec le mois (S1 ⇔ janv.–août)
  c = start
  for (let i = 0; i < 40; i++) {
    c = stepGuardMonth(c, 1)
    assert.equal(c.semester, c.month0 <= 7 ? 1 : 2)
  }

  // Semestres
  assert.deepEqual(stepGuardSemester({ semester: 1, year: 2026, month0: 4 }, 1), { semester: 2, year: 2026, month0: 8 })
  assert.deepEqual(stepGuardSemester({ semester: 2, year: 2026, month0: 9 }, 1), { semester: 1, year: 2027, month0: 0 })
  assert.deepEqual(stepGuardSemester({ semester: 1, year: 2027, month0: 3 }, -1), { semester: 2, year: 2026, month0: 8 })
  assert.deepEqual(stepGuardSemester({ semester: 2, year: 2026, month0: 10 }, -1), { semester: 1, year: 2026, month0: 0 })

  assert.equal(guardMonthKey({ year: 2026, month0: 0 }), "2026-01")
  assert.equal(guardMonthKey({ year: 2026, month0: 11 }), "2026-12")

  console.log("✅ guard-picks-view tests passed")
}

main()
