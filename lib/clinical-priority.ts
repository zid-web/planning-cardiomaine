/**
 * Priorités des propositions cliniques du générateur (consignes utilisateur) :
 *
 *  1. **Coro d'abord** : M, O, W — la vacation Coro prime sur Cs, EE, ETT. Une case
 *     Coro vide est pourvue par O/W/M *avant* de leur proposer autre chose : leur
 *     éventuelle proposition Cs/EE/ETT/Stress/Rééducation sur la même demi-journée
 *     est retirée au profit de la Coro.
 *  2. **O ne fait jamais d'ETT.**
 *  3. **Groupe G, H, S, B, Z** : ETT, Stress, Rééducation avant le Cs (leurs
 *     propositions Cs sont libérées, puis ils sont proposés d'abord à ces lignes).
 *  4. **Cs** : remplis par les médecins sans tâche principale sur la demi-journée —
 *     coronarographistes sans Coro, rythmologues sans Rythmo, autres médecins sans
 *     ETT/Stress/Rééducation. U, B, S ne font jamais de Cs PSS (Cs Tessée seulement).
 *  5. **U, lundi et mardi** : jamais à Cs Tessée s'il est de garde ce jour-là.
 *
 * Ne touche JAMAIS une case validée, saisie à la main ou vidée par l'admin :
 * uniquement les propositions du solveur (`pending`) et les cases vides. Le
 * solveur externe ne connaît pas ces règles fines : cette passe locale les
 * applique à ses propositions, avant affichage.
 */
import { dateStrForWeekDay } from "@/lib/fixed-assignments"
import { canAssignDoctorToSlot } from "@/lib/slot-blocking"
import { isSolverProposalCell } from "@/lib/guard-api-mapping"
import type { CellData, DoctorVacation, ScheduleData } from "@/lib/types"

const WEEKDAYS = ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI"] as const
const SLOTS = ["Matin", "Apm"] as const
const CORO_GROUP = ["M", "O", "W"] as const
/** Groupe écho / stress / rééducation : à proposer avant le Cs. */
const ECHO_GROUP = ["H", "Z", "G", "B", "S"] as const
const CS_PSS_EXCLUDED = ["U", "B", "S"]
const GARDE_ROWS = ["Garde Matin", "Garde Midi", "Garde Nuit"] as const

function rot<T>(arr: readonly T[], k: number): T[] {
  if (arr.length === 0) return []
  const n = ((k % arr.length) + arr.length) % arr.length
  return [...arr.slice(n), ...arr.slice(0, n)]
}

function cellValues(schedule: ScheduleData, row: string, day: string): string[] {
  const v = schedule[row]?.[day]?.value
  return Array.isArray(v) ? v : []
}

function isEmptyOpen(schedule: ScheduleData, row: string, day: string): boolean {
  const cell = schedule[row]?.[day]
  if (!schedule[row]) return false
  return cellValues(schedule, row, day).length === 0 && !cell?.manuallyCleared
}

/** Proposition du solveur modifiable (jamais une saisie manuelle / validée). */
function isMovableProposal(row: string, cell: CellData | undefined): boolean {
  return Boolean(cell) && isSolverProposalCell(row, cell) && !cell?.manualAssignment
}

function withCell(schedule: ScheduleData, row: string, day: string, cell: CellData): ScheduleData {
  return { ...schedule, [row]: { ...(schedule[row] || {}), [day]: cell } }
}

function setProposal(schedule: ScheduleData, row: string, day: string, doctor: string): ScheduleData {
  return withCell(schedule, row, day, {
    ...(schedule[row]?.[day] || {}),
    value: [doctor],
    type: "doctor",
    status: "pending",
  } as CellData)
}

function removeDoctor(schedule: ScheduleData, row: string, day: string, doctor: string): ScheduleData {
  const cell = schedule[row]?.[day]
  if (!cell || !(cell.value || []).includes(doctor)) return schedule
  const kept = cell.value.filter((d) => d !== doctor)
  return withCell(schedule, row, day, { ...cell, value: kept, type: kept.length ? cell.type : "empty" })
}

/** Lignes de la demi-journée sur lesquelles la Coro prime. */
function slotRowsBelowCoro(prefix: string): string[] {
  return [
    `${prefix} - Cs PSS`,
    `${prefix} - Cs Tessée`,
    `${prefix} - ETT salle 1`,
    `${prefix} - ETT salle 2`,
    `${prefix} - EE1`,
    `${prefix} - EE2`,
    `${prefix} - Stress`,
    ...(prefix === "Apm" ? ["Apm - RÉEDUCATION"] : []),
  ]
}

/** Retire les propositions (uniquement) de ce médecin sur ces lignes pour ce jour. */
function releaseProposals(schedule: ScheduleData, rows: string[], day: string, doctor: string): ScheduleData {
  let next = schedule
  for (const row of rows) {
    if (isMovableProposal(row, next[row]?.[day])) next = removeDoctor(next, row, day, doctor)
  }
  return next
}

function canAssign(schedule: ScheduleData, weekKey: string, doctor: string, row: string, day: string, vacations: DoctorVacation[]) {
  const dateStr = dateStrForWeekDay(weekKey, day)
  if (!dateStr) return false
  return canAssignDoctorToSlot(doctor, dateStr, row, day, schedule, vacations).allowed
}

/** 1. Coro d'abord : pourvoit les Coro vides par M/O/W, au besoin en libérant leurs propositions. */
function fillCoroFirst(schedule: ScheduleData, weekKey: string, vacations: DoctorVacation[]): ScheduleData {
  let next = schedule
  const load: Record<string, number> = { M: 0, O: 0, W: 0 }
  for (const prefix of SLOTS)
    for (const day of WEEKDAYS)
      for (const d of cellValues(next, `${prefix} - Coro`, day)) if (d in load) load[d]++

  SLOTS.forEach((prefix, si) => {
    const coroRow = `${prefix} - Coro`
    WEEKDAYS.forEach((day, di) => {
      if (!isEmptyOpen(next, coroRow, day)) return
      const order = rot(CORO_GROUP, di + si).sort((a, b) => load[a] - load[b])
      for (const doc of order) {
        const freed = releaseProposals(next, slotRowsBelowCoro(prefix), day, doc)
        if (!canAssign(freed, weekKey, doc, coroRow, day, vacations)) continue
        next = setProposal(freed, coroRow, day, doc)
        load[doc]++
        break
      }
    })
  })
  return next
}

/** 1bis/2. Coro prime ; O jamais en ETT (propositions uniquement). */
function enforceCoroPrecedenceAndRules(schedule: ScheduleData): ScheduleData {
  let next = schedule
  for (const prefix of SLOTS) {
    for (const day of WEEKDAYS) {
      for (const doc of cellValues(next, `${prefix} - Coro`, day)) {
        if (!(CORO_GROUP as readonly string[]).includes(doc)) continue
        next = releaseProposals(next, slotRowsBelowCoro(prefix), day, doc)
      }
      for (const row of [`${prefix} - ETT salle 1`, `${prefix} - ETT salle 2`]) {
        if (isMovableProposal(row, next[row]?.[day])) next = removeDoctor(next, row, day, "O")
      }
    }
  }
  return next
}

/** 5. U lundi/mardi : pas de Cs Tessée s'il est de garde ce jour-là. */
function enforceUCsTesseeGuardRule(schedule: ScheduleData): ScheduleData {
  let next = schedule
  for (const day of ["LUNDI", "MARDI"] as const) {
    const uOnGuard = GARDE_ROWS.some((r) => cellValues(next, r, day).includes("U"))
    if (!uOnGuard) continue
    for (const row of ["Matin - Cs Tessée", "Apm - Cs Tessée"]) {
      if (cellValues(next, row, day).includes("U")) next = removeDoctor(next, row, day, "U")
    }
  }
  return next
}

type FillTarget = { row: string; pool: (k: number) => readonly string[] }

function fillTargets(): FillTarget[] {
  const others = ["A", "K"]
  const ettPool = (k: number) => [...rot(ECHO_GROUP, k), ...others]
  const stressPool = (k: number) => [...rot(ECHO_GROUP, k), ...others]
  const reeducPool = (k: number) => [...rot(ECHO_GROUP, k), "R", "K"]
  const eePool = () => ["A", "H", "W", "B", "O", "Z", "U", "V", "G", "S", "M", "R", "K"]
  // Cs PSS : coronarographistes sans Coro, puis rythmologues sans Rythmo, puis le groupe écho
  // sans ETT/Stress/Rééducation (U, B, S exclus : Cs Tessée uniquement).
  const csPssPool = (k: number) =>
    [...rot(CORO_GROUP, k), "P", "A", ...rot(["H", "Z", "G"], k), "K"].filter((d) => !CS_PSS_EXCLUDED.includes(d))
  const csTesseePool = () => ["B", "S", "V", "U"]
  const preOpPool = () => ["A", "H", "W", "B", "Z", "K", "G", "S"]

  const targets: FillTarget[] = []
  for (const p of SLOTS) {
    targets.push({ row: `${p} - ETT salle 1`, pool: ettPool })
    targets.push({ row: `${p} - ETT salle 2`, pool: ettPool })
  }
  for (const p of SLOTS) targets.push({ row: `${p} - Stress`, pool: stressPool })
  targets.push({ row: "Apm - RÉEDUCATION", pool: reeducPool })
  for (const p of SLOTS) {
    targets.push({ row: `${p} - EE1`, pool: eePool })
    targets.push({ row: `${p} - EE2`, pool: eePool })
  }
  for (const p of SLOTS) targets.push({ row: `${p} - Cs PSS`, pool: csPssPool })
  for (const p of SLOTS) targets.push({ row: `${p} - Cs Tessée`, pool: csTesseePool })
  targets.push({ row: "Pré-op", pool: preOpPool })
  return targets
}

/** 3/4. Remplit les cases vides dans l'ordre de priorité : ETT, Stress, Rééducation, EE, Cs. */
function fillByPriority(schedule: ScheduleData, weekKey: string, vacations: DoctorVacation[]): ScheduleData {
  let next = schedule
  const weekNum = Number.parseInt(weekKey.split("-W")[1] || "1", 10)

  // Le groupe écho voit d'abord ses propositions Cs libérées : il est proposé aux
  // ETT / Stress / Rééducation avant le Cs (le Cs est ensuite repourvu par les autres).
  for (const day of WEEKDAYS)
    for (const prefix of SLOTS)
      for (const row of [`${prefix} - Cs PSS`, `${prefix} - Cs Tessée`])
        for (const doc of ECHO_GROUP)
          if (isMovableProposal(row, next[row]?.[day]) && cellValues(next, row, day).includes(doc))
            next = removeDoctor(next, row, day, doc)

  for (const { row, pool } of fillTargets()) {
    if (!next[row]) continue
    WEEKDAYS.forEach((day, di) => {
      if (!isEmptyOpen(next, row, day)) return
      let candidates = [...pool(di + weekNum)]
      // ETT : deux salles = deux médecins différents quand c'est possible
      // (le même médecin sur les deux n'est qu'un dernier recours).
      const sibling = row.endsWith("ETT salle 2")
        ? row.replace("salle 2", "salle 1")
        : row.endsWith("ETT salle 1")
          ? row.replace("salle 1", "salle 2")
          : null
      if (sibling) {
        const taken = cellValues(next, sibling, day)
        candidates = [...candidates.filter((d) => !taken.includes(d)), ...candidates.filter((d) => taken.includes(d))]
      }
      const pick = candidates.find((doc) => canAssign(next, weekKey, doc, row, day, vacations))
      if (pick) next = setProposal(next, row, day, pick)
    })
  }
  return next
}

/** Point d'entrée : à appeler sur les propositions du solveur (idempotent). */
export function applyClinicalPriorityRules(
  schedule: ScheduleData,
  weekKey: string,
  vacations: DoctorVacation[] = [],
): ScheduleData {
  let next = schedule
  next = enforceUCsTesseeGuardRule(next)
  next = fillCoroFirst(next, weekKey, vacations)
  next = enforceCoroPrecedenceAndRules(next)
  next = fillByPriority(next, weekKey, vacations)
  return next
}
