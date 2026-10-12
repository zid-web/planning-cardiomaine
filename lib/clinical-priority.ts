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
import { canAssignDoctorToSlot, type AssignmentContext } from "@/lib/slot-blocking"
import { isSolverProposalCell } from "@/lib/guard-api-mapping"
import { isListedDoctor } from "@/lib/doctor-code"
import { isOutsideUsualHorsSiteDay } from "@/lib/closed-slots"
import { learnedCandidates, learnedPartners, type PatternStats } from "@/lib/pattern-replay"
import { DOC022_CLINICAL_ELIGIBILITY } from "@/lib/group-clinical-rules"
import { DAYS, NURSES } from "@/lib/constants"
import { doctorsOnStress, isStressRow, STRESS_ROWS } from "@/lib/stress-weekly"
import type { CellData, DoctorVacation, ScheduleData } from "@/lib/types"

const WEEKDAYS = ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI"] as const
const SLOTS = ["Matin", "Apm"] as const
const CORO_GROUP = ["M", "O", "W"] as const
/** Groupe écho / stress / rééducation : à proposer avant le Cs. */
const ECHO_GROUP = ["H", "Z", "G", "B", "S"] as const
const CS_PSS_EXCLUDED = ["U", "B", "S"]
const GARDE_ROWS = ["Garde Matin", "Garde Midi", "Garde Nuit"] as const
const PRE_OP_POOL = ["A", "H", "W", "B", "Z", "K", "G", "S"] as const

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

// Contexte hors semaine (garde de nuit du dimanche précédent) : posé pendant l'appel synchrone
// d'un point d'entrée, puis retiré — évite de le passer à chaque fonction interne.
let activeContext: AssignmentContext | undefined

function canAssign(schedule: ScheduleData, weekKey: string, doctor: string, row: string, day: string, vacations: DoctorVacation[]) {
  const dateStr = dateStrForWeekDay(weekKey, day)
  if (!dateStr) return false
  return canAssignDoctorToSlot(doctor, dateStr, row, day, schedule, vacations, activeContext).allowed
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

/** Éligibilité DOC022 de la ligne (les schémas appris ne contournent jamais les consignes). */
function isEligibleForRow(row: string, doctor: string): boolean {
  const E = DOC022_CLINICAL_ELIGIBILITY
  const inList = (l: readonly string[]) => l.includes(doctor)
  if (row.includes("ETT")) return inList(E.echo)
  if (row.includes("Stress")) return inList(E.stress)
  if (row.includes("RÉEDUCATION")) return inList(E.reeduc)
  if (row.includes("EE")) return inList(E.ee)
  if (row.includes("Cs PSS")) return inList(E.cs_pss) && !CS_PSS_EXCLUDED.includes(doctor)
  if (row.includes("Cs Tessée")) return inList(E.cs_tesse) || doctor === "U"
  return true
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
  const preOpPool = (k: number) => rot(PRE_OP_POOL, k)

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
function fillByPriority(
  schedule: ScheduleData,
  weekKey: string,
  vacations: DoctorVacation[],
  stats?: PatternStats,
): ScheduleData {
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

  // Deux passes : (1) schémas appris du remplissage manuel, sur toutes les lignes, avant
  // (2) le pool par défaut — sinon une ligne traitée plus tôt (ETT) consommerait le médecin
  // que l'admin place d'habitude sur une ligne suivante (Stress).
  for (const learnedOnly of stats ? [true, false] : [false]) {
    for (const { row, pool } of fillTargets()) {
      if (!next[row]) continue
      WEEKDAYS.forEach((day, di) => {
        if (!isEmptyOpen(next, row, day)) return
        // Schémas du remplissage manuel d'abord (médecins éligibles à la ligne), puis le pool par défaut.
        const learned = learnedCandidates(stats, row, day).filter((d) => isEligibleForRow(row, d))
        let candidates = learnedOnly ? learned : [...new Set([...learned, ...pool(di + weekNum)])]
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
        // Stress : un médecin déjà au Stress cette semaine passe après les autres (roulement) ;
        // il n'est repris qu'en dernier recours, s'il n'y a pas assez de médecins disponibles.
        if (isStressRow(row)) {
          const used = doctorsOnStress(next, { row, day })
          candidates = [...candidates.filter((d) => !used.has(d)), ...candidates.filter((d) => used.has(d))]
        }
        if (row === "Pré-op") {
          const used = new Set(WEEKDAYS.flatMap((d) => cellValues(next, "Pré-op", d)))
          candidates = [...candidates.filter((d) => !used.has(d)), ...candidates.filter((d) => used.has(d))]
        }
        const pick = candidates.find((doc) => canAssign(next, weekKey, doc, row, day, vacations))
        if (pick) next = setProposal(next, row, day, pick)
      })
    }
  }
  return next
}

/**
 * Une seule fois par semaine par médecin sur un groupe de lignes (Stress : roulement ; Pré-op :
 * un médecin différent chaque jour), quand il y a assez de médecins disponibles. Affectation
 * maximale (chemins augmentants) sur les cases libres — propositions du solveur modifiables et
 * cases vides ouvertes — avec les mêmes règles que la saisie manuelle ; les propositions déjà
 * valides et uniques sont conservées (stabilité, idempotent). Sans assez de médecins disponibles
 * (congés, absences), la répétition est tolérée plutôt que de laisser la case vide.
 */
function enforceDistinctPerWeek(
  schedule: ScheduleData,
  weekKey: string,
  vacations: DoctorVacation[],
  cfg: { rows: readonly string[]; order: readonly string[]; stats?: PatternStats },
): ScheduleData {
  const isProposalDoctor = (d: string) =>
    isListedDoctor(d) && !(NURSES as readonly string[]).includes(d) && d !== "CH" && d !== "FV"

  const cells: Array<{ row: string; day: string }> = []
  for (const day of WEEKDAYS) for (const row of cfg.rows) if (schedule[row]?.[day]) cells.push({ row, day })
  const free = cells.filter(
    ({ row, day }) => isMovableProposal(row, schedule[row]?.[day]) || isEmptyOpen(schedule, row, day),
  )
  if (free.length === 0) return schedule

  // Base : les médecins proposés sont retirés des cases libres (infirmières, CH, FV conservés).
  let base = schedule
  const original = new Map<string, string[]>()
  for (const { row, day } of free) {
    const cell = base[row]![day]!
    const proposed = (cell.value || []).filter(isProposalDoctor)
    original.set(`${row}||${day}`, proposed)
    if (proposed.length) {
      const kept = cell.value.filter((v) => !isProposalDoctor(v))
      base = withCell(base, row, day, { ...cell, value: kept, type: kept.length ? cell.type : "empty" })
    }
  }

  // Médecins tenant une case non libre (validée / manuelle / fixe) : ils comptent d'office.
  const freeKeys = new Set(free.map((c) => `${c.row}||${c.day}`))
  const fixedUsed = new Set<string>()
  for (const { row, day } of cells) {
    if (freeKeys.has(`${row}||${day}`)) continue
    for (const d of cellValues(base, row, day)) if (isProposalDoctor(d)) fixedUsed.add(d)
  }

  // Candidats autorisés (règles de la saisie manuelle) : médecin déjà proposé, schéma appris, puis roulement.
  const allowed: string[][] = free.map(({ row, day }) => {
    const current = original.get(`${row}||${day}`) || []
    const learned = learnedCandidates(cfg.stats, row, day)
    return [...new Set([...current, ...learned, ...cfg.order])].filter((d) => canAssign(base, weekKey, d, row, day, vacations))
  })

  const owner = new Map<string, number>() // médecin → index de case
  const assigned: Array<string | null> = free.map(() => null)
  // 1. Les propositions valides et uniques sont conservées (stabilité). En cas de conflit entre
  // deux cases, celle qui correspond au schéma appris du remplissage manuel est servie la première.
  const matchesLearned = (ci: number) => {
    const { row, day } = free[ci]
    const top = learnedCandidates(cfg.stats, row, day)[0]
    return top !== undefined && (original.get(`${row}||${day}`) || []).includes(top) ? 0 : 1
  }
  free
    .map((_, ci) => ci)
    .sort((a, b) => matchesLearned(a) - matchesLearned(b) || a - b)
    .forEach((ci) => {
      const { row, day } = free[ci]
      const keep = (original.get(`${row}||${day}`) || []).find(
        (d) => allowed[ci].includes(d) && !fixedUsed.has(d) && !owner.has(d),
      )
      if (keep) {
        owner.set(keep, ci)
        assigned[ci] = keep
      }
    })
  // 2. Les autres cases : chemins augmentants (réaffecte au besoin pour que personne ne soit répété).
  const tryAssign = (ci: number, visited: Set<string>): boolean => {
    const candidates = allowed[ci].filter((d) => !fixedUsed.has(d) && !visited.has(d))
    // Médecin libre d'abord ; sinon on réaffecte la case d'un autre (jamais une case conforme au schéma appris).
    const sorted = [
      ...candidates.filter((d) => !owner.has(d)),
      // jamais la case qui suit le schéma appris : mieux vaut tolérer une répétition
      ...candidates.filter((d) => owner.has(d) && matchesLearned(owner.get(d) as number) === 1),
    ]
    for (const d of sorted) {
      if (visited.has(d)) continue
      visited.add(d)
      const holder = owner.get(d)
      if (holder === undefined || tryAssign(holder, visited)) {
        owner.set(d, ci)
        assigned[ci] = d
        return true
      }
    }
    return false
  }
  free.forEach((_, ci) => {
    if (!assigned[ci]) tryAssign(ci, new Set())
  })

  // 3. Écritures. Case non affectée (pas assez de médecins) : proposition d'origine conservée, ou
  // candidat le moins déjà utilisé (répétition tolérée).
  const usage = new Map<string, number>()
  assigned.forEach((d) => d && usage.set(d, (usage.get(d) || 0) + 1))
  for (const d of fixedUsed) usage.set(d, (usage.get(d) || 0) + 1)
  let next = base
  free.forEach(({ row, day }, ci) => {
    let doctor = assigned[ci]
    if (!doctor) {
      const cur = (original.get(`${row}||${day}`) || []).find((d) => allowed[ci].includes(d))
      doctor = cur ?? [...allowed[ci]].sort((a, b) => (usage.get(a) || 0) - (usage.get(b) || 0))[0] ?? null
      if (doctor) usage.set(doctor, (usage.get(doctor) || 0) + 1)
    }
    if (!doctor) return
    const cell = next[row]![day]!
    next = withCell(next, row, day, {
      ...cell,
      value: [...(cell.value || []), doctor],
      type: "doctor",
      status: "pending",
    })
  })
  return next
}

/** Stress : roulement — un médecin une seule fois par semaine (le moins sollicité récemment d'abord). */
function enforceStressOncePerWeek(schedule: ScheduleData, weekKey: string, vacations: DoctorVacation[], stats?: PatternStats): ScheduleData {
  const load = new Map<string, number>()
  if (stats) {
    for (const [key, bucket] of stats.slots) {
      if (!/ - Stress\|\|/.test(key)) continue
      for (const [doc, w] of bucket) load.set(doc, (load.get(doc) || 0) + w)
    }
  }
  const order = [...DOC022_CLINICAL_ELIGIBILITY.stress]
    .filter((d) => d !== "D") // D : Stress fixe du jeudi, jamais en roulement
    .sort((a, b) => (load.get(a) || 0) - (load.get(b) || 0))
  return enforceDistinctPerWeek(schedule, weekKey, vacations, { rows: STRESS_ROWS, order, stats })
}

/** Pré-op : un médecin différent chaque jour de la semaine. */
function enforcePreOpDistinctDays(schedule: ScheduleData, weekKey: string, vacations: DoctorVacation[], stats?: PatternStats): ScheduleData {
  const weekNum = Number.parseInt(weekKey.split("-W")[1] || "1", 10)
  const order = rot(PRE_OP_POOL, weekNum)
  return enforceDistinctPerWeek(schedule, weekKey, vacations, { rows: ["Pré-op"], order, stats })
}

export type RejectedProposal = { row: string; day: string; doctor: string; reason: string }

const ROW_PRIORITY = [
  "Garde Nuit", "Garde Midi", "Garde Matin",
  "Astreintes ATL Nuit", "Astreintes ATL Midi", "Astreintes ATL Matin",
  "Matin - Coro", "Apm - Coro",
  "Hors site - LFB", "Hors site - PSSL", "Hors site - CDL", "Hors site - IRM", "Hors site - Scinti",
  "Matin - ETT salle 1", "Matin - ETT salle 2", "Apm - ETT salle 1", "Apm - ETT salle 2",
  "Matin - Stress", "Apm - Stress", "Apm - RÉEDUCATION",
  "Matin - EE1", "Matin - EE2", "Apm - EE1", "Apm - EE2",
  "Matin - Cs PSS", "Apm - Cs PSS", "Matin - Cs Tessée", "Apm - Cs Tessée",
  "Entrées PSS", "Pré-op",
]

function rowPriority(row: string): number {
  const i = ROW_PRIORITY.indexOf(row)
  return i >= 0 ? i : ROW_PRIORITY.length
}

/**
 * Toute proposition du solveur doit passer **la même validation que l'affectation
 * manuelle** (`canAssignDoctorToSlot` : congés, repos après garde de nuit, jamais
 * deux nuits consécutives, un seul créneau à la fois, Coro / ATL / Rythmo, cases
 * fermées, jours fériés, binômes infirmières, K, S/IRM…). On retire toutes les
 * propositions, puis on les remet une à une par ordre de priorité (gardes,
 * astreintes, Coro, hors site, ETT, Stress, Rééducation, EE, Cs) : chacune n'est
 * conservée que si un admin pourrait la saisir à la main à cet instant. Les
 * refus sont consignés avec leur motif ; les cases vidées sont repourvues ensuite
 * par la passe de priorité, avec des candidats validés par la même logique.
 */
export function validateProposalsLikeManual(
  schedule: ScheduleData,
  weekKey: string,
  vacations: DoctorVacation[] = [],
  rejected: RejectedProposal[] = [],
  ctx?: AssignmentContext,
): ScheduleData {
  const previous = activeContext
  if (ctx) activeContext = ctx
  try {
    return validateProposalsLikeManualInner(schedule, weekKey, vacations, rejected)
  } finally {
    activeContext = previous
  }
}

function validateProposalsLikeManualInner(
  schedule: ScheduleData,
  weekKey: string,
  vacations: DoctorVacation[],
  rejected: RejectedProposal[],
): ScheduleData {
  type Pending = { row: string; day: string; doctor: string; dup: boolean }
  const pending: Pending[] = []
  let base = schedule

  for (const [row, days] of Object.entries(schedule)) {
    if (!days) continue
    for (const day of DAYS) {
      const cell = days[day]
      if (!isMovableProposal(row, cell)) continue
      const seen = new Set<string>()
      const keep: string[] = []
      for (const d of cell!.value) {
        const isProposalDoctor =
          isListedDoctor(d) && !(NURSES as readonly string[]).includes(d) && d !== "CH" && d !== "FV"
        if (!isProposalDoctor) {
          keep.push(d) // infirmières, remplaçants, CH, FV : structurels, jamais retirés
          continue
        }
        pending.push({ row, day, doctor: d, dup: seen.has(d) })
        seen.add(d)
      }
      base = withCell(base, row, day, {
        ...cell!,
        value: keep,
        type: keep.length ? cell!.type : "empty",
      })
    }
  }

  pending.sort((a, b) => rowPriority(a.row) - rowPriority(b.row))

  let next = base
  // Bloc de garde du jour : Matin / Midi / Nuit vont ensemble — si la Garde Nuit d'un médecin est
  // écartée, ses Garde Matin / Midi du même jour le sont aussi (sinon le couplage de la structure
  // recopierait sa garde sur la nuit refusée).
  const blockedGuardDays = new Set<string>()
  for (const p of pending) {
    const cell = next[p.row]?.[p.day]
    if (!cell) continue
    const dateStr = dateStrForWeekDay(weekKey, p.day)
    if ((p.row === "Garde Matin" || p.row === "Garde Midi") && blockedGuardDays.has(`${p.day}|${p.doctor}`)) {
      rejected.push({ row: p.row, day: p.day, doctor: p.doctor, reason: "Garde de nuit du jour refusée : le bloc de garde est écarté." })
      continue
    }
    // Hors site : les cases restent libres, mais le solveur ne propose que les jours habituels
    if (isOutsideUsualHorsSiteDay(p.row, p.day)) {
      rejected.push({ row: p.row, day: p.day, doctor: p.doctor, reason: "Jour habituel de cette vacation hors site non respecté." })
      continue
    }
    // Doublon voulu (même médecin deux fois dans une case Cs) : conservé tel quel
    const result = p.dup && cell.value.includes(p.doctor)
      ? { allowed: true as const }
      : dateStr
        ? canAssignDoctorToSlot(p.doctor, dateStr, p.row, p.day, next, vacations, activeContext)
        : { allowed: false as const, reason: "Date introuvable" }
    if (result.allowed) {
      next = withCell(next, p.row, p.day, {
        ...cell,
        value: [...cell.value, p.doctor],
        type: "doctor",
        status: "pending",
      })
    } else {
      if (p.row === "Garde Nuit") blockedGuardDays.add(`${p.day}|${p.doctor}`)
      rejected.push({ row: p.row, day: p.day, doctor: p.doctor, reason: ("reason" in result && result.reason) || "Règle d'affectation" })
    }
  }
  return next
}

/**
 * Binôme d'une infirmière sur Stress / EE : le médecin que l'admin associe d'habitude à
 * cette infirmière sur cette case (schémas appris). Sans historique : case laissée telle quelle.
 */
const NURSE_BINOME_ROWS_REPLAY = ["Matin - Stress", "Apm - Stress", "Matin - EE1", "Apm - EE1", "Matin - EE2", "Apm - EE2"]

function fillNursePartnersFromHistory(
  schedule: ScheduleData,
  weekKey: string,
  vacations: DoctorVacation[],
  stats?: PatternStats,
): ScheduleData {
  if (!stats) return schedule
  let next = schedule
  for (const row of NURSE_BINOME_ROWS_REPLAY) {
    for (const day of WEEKDAYS) {
      const cell = next[row]?.[day]
      if (!cell || cell.manuallyCleared) continue
      const values = cell.value || []
      const nurses = values.filter((v) => (NURSES as readonly string[]).includes(v))
      if (nurses.length === 0 || values.some((v) => !(NURSES as readonly string[]).includes(v))) continue
      if (cell.status !== "pending" && cell.manualAssignment) continue
      const nurse = nurses[0]
      const partner = learnedPartners(stats, row, day, nurse).find(
        (d) => isEligibleForRow(row, d) && canAssign(next, weekKey, d, row, day, vacations),
      )
      if (!partner) continue
      next = withCell(next, row, day, { ...cell, value: [...values, partner], type: "doctor", status: "pending" })
    }
  }
  return next
}

/** Point d'entrée : à appeler sur les propositions du solveur (idempotent). */
export function applyClinicalPriorityRules(
  schedule: ScheduleData,
  weekKey: string,
  vacations: DoctorVacation[] = [],
  rejected: RejectedProposal[] = [],
  stats?: PatternStats,
  ctx?: AssignmentContext,
): ScheduleData {
  const previous = activeContext
  if (ctx) activeContext = ctx
  try {
    return applyClinicalPriorityRulesInner(schedule, weekKey, vacations, rejected, stats)
  } finally {
    activeContext = previous
  }
}

function applyClinicalPriorityRulesInner(
  schedule: ScheduleData,
  weekKey: string,
  vacations: DoctorVacation[],
  rejected: RejectedProposal[],
  stats?: PatternStats,
): ScheduleData {
  // 0. Mêmes règles que l'affectation manuelle, appliquées à chaque proposition
  let next = validateProposalsLikeManual(schedule, weekKey, vacations, rejected)
  next = enforceUCsTesseeGuardRule(next)
  next = fillCoroFirst(next, weekKey, vacations)
  next = enforceCoroPrecedenceAndRules(next)
  next = fillNursePartnersFromHistory(next, weekKey, vacations, stats)
  next = fillByPriority(next, weekKey, vacations, stats)
  next = enforceStressOncePerWeek(next, weekKey, vacations, stats)
  next = enforcePreOpDistinctDays(next, weekKey, vacations, stats)
  return next
}
