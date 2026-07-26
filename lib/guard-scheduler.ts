export interface GuardConstraints {
  noFridayUsers: string[] // M, W, O
  offSiteDays: { [user: string]: string[] } // Days when users are off-site
  noGuardBeforeNCT: string[] // M, W
  preferBeforeHalfDay: boolean
  noGuardDuringVisiteWeek: boolean
  vacations2026: { [user: string]: string[] } // Vacation dates
  fixedGuards2026: { date: string; user: string; type: string }[]
  fixedAstreintes2026: { date: string; user: string; type: string }[]
  noGuardAfterSundayAstreinte: string[] // M, W, O
}

export interface GuardProposal {
  date: string // ISO format YYYY-MM-DD
  day: string // LUNDI, MARDI, etc.
  user: string
  type: "Garde Matin" | "Garde Midi" | "Garde Nuit"
  isProposal: true
  weekKey: string
}

export interface AstreinteRotation {
  weekNumber: number
  year: number
  monday?: string
  tuesday?: string
  wednesday?: string
  thursday?: string // Added Thursday for CH rotation
  friday?: string
  saturday1?: string
  saturday2?: string
  sunday?: string
  sundayAstreinte?: string // Added for CH rotation on Sunday
}

export interface ScheduleData {
  [key: string]: { [day: string]: { value: string[] } }
}

// FV is an external doctor (no login account, no Supabase profile)
// FV is used for:
// - Night guard ("Garde Nuit") on Monday only
// - Coro activities ("Coro") on Thursday afternoon only
// FV cannot be assigned for other activities and never counts as an authenticated user
const GUARD_ELIGIBLE_USERS = ["A", "B", "G", "Z", "H", "S", "O", "M", "W", "U", "P"]

/**
 * Préférences / pools Garde Nuit par jour (aligné solveur guard-api).
 * - prefer : choisis en priorité s’ils sont disponibles
 * - only   : pool exclusif (pas de repli hors liste)
 */
export const NIGHT_GUARD_DAY_RULES: Record<
  string,
  { prefer?: readonly string[]; only?: readonly string[] }
> = {
  LUNDI: { prefer: ["U"] }, // uniquement si FV absent
  MARDI: { prefer: ["M", "W"] },
  MERCREDI: { prefer: ["S", "U", "P"] },
  JEUDI: { prefer: ["O", "G"] },
  VENDREDI: { only: ["B", "G", "A", "P", "Z", "H", "S"] }, // O/W/M jamais
}

/** O, W, M ne font jamais de garde vendredi nuit */
export const NO_FRIDAY_NIGHT_GUARD = ["O", "W", "M"] as const

// External doctor assignments - can be manually assigned by admin but not included in automatic rotations
const EXTERNAL_DOCTORS = {
  FV: {
    allowedActivities: ["Garde Nuit", "Coro"], // Only these activities
    allowedDays: {
      "Garde Nuit": ["LUNDI"], // FV only does night guard on Monday
      "Coro": ["JEUDI"], // FV only does coro on Thursday
    },
  },
}

const OFF_SITE_DAYS: Record<string, string[]> = {
  S: ["LUNDI", "VENDREDI"], // S en IRM lundi et vendredi
  V: ["MARDI"], // V en CDL mardi matin
  T: ["LUNDI", "MERCREDI"], // T en Scinti lundi et mercredi
  R: ["MARDI"], // R en Scinti mardi
}

export const NCT_DATES_2026 = [
  { date: "2026-01-15", user: "W" }, // Starting with W for 2026
  { date: "2026-01-29", user: "M" },
  { date: "2026-02-05", user: "W" },
  { date: "2026-02-19", user: "M" },
  { date: "2026-02-26", user: "W" },
  { date: "2026-03-12", user: "M" },
  { date: "2026-03-26", user: "W" },
  { date: "2026-04-09", user: "M" },
  { date: "2026-04-30", user: "W" },
  { date: "2026-05-07", user: "M" },
  { date: "2026-05-21", user: "W" },
  { date: "2026-05-28", user: "M" },
  { date: "2026-06-11", user: "W" },
  { date: "2026-06-18", user: "M" },
  { date: "2026-06-25", user: "W" },
  { date: "2026-07-09", user: "M" },
  // Aligné guard-api/solver.py NCT_FIXED_SCHEDULE
  { date: "2026-07-23", user: "M" },
  { date: "2026-09-10", user: "M" },
  { date: "2026-09-17", user: "W" },
  { date: "2026-09-24", user: "M" },
  { date: "2026-10-01", user: "W" },
  { date: "2026-10-15", user: "M" },
  { date: "2026-10-29", user: "W" },
  { date: "2026-11-05", user: "M" },
  { date: "2026-11-19", user: "W" },
  { date: "2026-11-26", user: "M" },
  { date: "2026-12-03", user: "W" },
  { date: "2026-12-17", user: "M" },
]

export const NCT_DATES_2025_DEC = [
  { date: "2025-12-04", user: "M" },
  { date: "2025-12-11", user: "W" },
  { date: "2025-12-18", user: "M" },
]

const NCT_USERS_DATES: Record<string, string[]> = {}

NCT_DATES_2026.forEach((nct) => {
  if (!NCT_USERS_DATES[nct.user]) NCT_USERS_DATES[nct.user] = []
  NCT_USERS_DATES[nct.user].push(nct.date)
})
NCT_DATES_2025_DEC.forEach((nct) => {
  if (!NCT_USERS_DATES[nct.user]) NCT_USERS_DATES[nct.user] = []
  NCT_USERS_DATES[nct.user].push(nct.date)
})

export { EXTERNAL_DOCTORS }

export const constraints2026: GuardConstraints = {
  noFridayUsers: ["M", "W", "O"],
  offSiteDays: OFF_SITE_DAYS, // Add off-site days to constraints
  noGuardBeforeNCT: ["M", "W"],
  preferBeforeHalfDay: true,
  noGuardDuringVisiteWeek: true,
  vacations2026: {
    O: [
      // 28-31 janvier
      "2026-01-28",
      "2026-01-29",
      "2026-01-30",
      "2026-01-31",
      // 7-15 mars
      "2026-03-07",
      "2026-03-08",
      "2026-03-09",
      "2026-03-10",
      "2026-03-11",
      "2026-03-12",
      "2026-03-13",
      "2026-03-14",
      "2026-03-15",
      // 1-10 mai
      "2026-05-01",
      "2026-05-02",
      "2026-05-03",
      "2026-05-04",
      "2026-05-05",
      "2026-05-06",
      "2026-05-07",
      "2026-05-08",
      "2026-05-09",
      "2026-05-10",
    ],
    M: [
      // 14-22 février
      "2026-02-14",
      "2026-02-15",
      "2026-02-16",
      "2026-02-17",
      "2026-02-18",
      "2026-02-19",
      "2026-02-20",
      "2026-02-21",
      "2026-02-22",
      // 11-19 avril
      "2026-04-11",
      "2026-04-12",
      "2026-04-13",
      "2026-04-14",
      "2026-04-15",
      "2026-04-16",
      "2026-04-17",
      "2026-04-18",
      "2026-04-19",
    ],
    W: [
      // 21 février - 1 mars
      "2026-02-21",
      "2026-02-22",
      "2026-02-23",
      "2026-02-24",
      "2026-02-25",
      "2026-02-26",
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
      // 18-26 avril
      "2026-04-18",
      "2026-04-19",
      "2026-04-20",
      "2026-04-21",
      "2026-04-22",
      "2026-04-23",
      "2026-04-24",
      "2026-04-25",
      "2026-04-26",
    ],
  },
  fixedGuards2026: [
    { date: "2026-01-10", user: "O", type: "Garde Nuit" },
    { date: "2026-02-08", user: "O", type: "Garde Nuit" },
    { date: "2026-05-31", user: "O", type: "Garde Nuit" },
    { date: "2026-01-24", user: "M", type: "Garde Nuit" },
    { date: "2026-02-07", user: "M", type: "Garde Nuit" },
    { date: "2026-03-22", user: "M", type: "Garde Nuit" },
    { date: "2026-05-31", user: "M", type: "Garde Nuit" },
    { date: "2026-01-11", user: "W", type: "Garde Nuit" },
    { date: "2026-01-24", user: "W", type: "Garde Nuit" },
    { date: "2026-03-21", user: "W", type: "Garde Nuit" },
  ],
  fixedAstreintes2026: [
    { date: "2026-01-11", user: "O", type: "Astreintes ATL" },
    { date: "2026-02-07", user: "O", type: "Astreintes ATL" },
    { date: "2026-02-21", user: "O", type: "Astreintes ATL" },
    { date: "2026-02-22", user: "O", type: "Astreintes ATL" },
    { date: "2026-04-18", user: "O", type: "Astreintes ATL" },
    { date: "2026-04-19", user: "O", type: "Astreintes ATL" },
    { date: "2026-05-16", user: "O", type: "Astreintes ATL" },
    { date: "2026-05-17", user: "O", type: "Astreintes ATL" },
    { date: "2026-01-24", user: "M", type: "Astreintes ATL" },
    { date: "2026-02-08", user: "M", type: "Astreintes ATL" },
    { date: "2026-04-04", user: "M", type: "Astreintes ATL" },
    { date: "2026-04-05", user: "M", type: "Astreintes ATL" },
    { date: "2026-04-06", user: "M", type: "Astreintes ATL" },
    { date: "2026-05-31", user: "M", type: "Astreintes ATL" },
    { date: "2026-01-10", user: "W", type: "Astreintes ATL" },
    { date: "2026-01-25", user: "W", type: "Astreintes ATL" },
    { date: "2026-03-07", user: "W", type: "Astreintes ATL" },
    { date: "2026-03-08", user: "W", type: "Astreintes ATL" },
    { date: "2026-03-22", user: "W", type: "Astreintes ATL" },
    { date: "2026-05-01", user: "W", type: "Astreintes ATL" },
    { date: "2026-05-02", user: "W", type: "Astreintes ATL" },
    { date: "2026-05-03", user: "W", type: "Astreintes ATL" },
  ],
  noGuardAfterSundayAstreinte: ["M", "W", "O"],
}

function isWeekday(date: Date): boolean {
  const day = date.getDay()
  return day >= 1 && day <= 5 // Monday to Friday
}

function getDayName(date: Date): string {
  const days = ["DIMANCHE", "LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI"]
  return days[date.getDay()]
}

function dateToString(date: Date): string {
  return date.toISOString().split("T")[0]
}

export function generateGuardProposals(
  startDate: Date,
  endDate: Date,
  constraints: GuardConstraints,
  existingSchedule?: Map<string, ScheduleData>,
): GuardProposal[] {
  const proposals: GuardProposal[] = []
  const userGuardCount: { [user: string]: number } = {}

  const allUsers = GUARD_ELIGIBLE_USERS

  allUsers.forEach((user) => {
    userGuardCount[user] = 0
  })

  // Track already assigned guards from fixed list
  const assignedDates = new Map<string, Set<string>>() // date -> Set of users already assigned
  constraints.fixedGuards2026.forEach((guard) => {
    if (!assignedDates.has(guard.date)) {
      assignedDates.set(guard.date, new Set())
    }
    assignedDates.get(guard.date)?.add(guard.user)
    if (!userGuardCount[guard.user]) userGuardCount[guard.user] = 0
    userGuardCount[guard.user]++
  })

  const nctDatesByUser = new Map<string, Set<string>>() // user -> Set of NCT dates
  ;[...constraints.fixedGuards2026, ...constraints.fixedAstreintes2026].forEach((nct) => {
    if (!nctDatesByUser.has(nct.user)) {
      nctDatesByUser.set(nct.user, new Set())
    }
    nctDatesByUser.get(nct.user)?.add(nct.date)
  })

  // Track Sunday astreintes for no-guard-next-day rule
  const sundayAstreintes = new Map<string, string[]>() // date -> users
  constraints.fixedAstreintes2026.forEach((astreinte) => {
    const date = new Date(astreinte.date)
    if (date.getDay() === 0) {
      if (!sundayAstreintes.has(astreinte.date)) {
        sundayAstreintes.set(astreinte.date, [])
      }
      sundayAstreintes.get(astreinte.date)?.push(astreinte.user)
    }
  })

  const astreintesByDate = new Map<string, Set<string>>()
  constraints.fixedAstreintes2026.forEach((astreinte) => {
    if (!astreintesByDate.has(astreinte.date)) {
      astreintesByDate.set(astreinte.date, new Set())
    }
    astreintesByDate.get(astreinte.date)?.add(astreinte.user)
  })

  const currentDate = new Date(startDate)

  while (currentDate <= endDate) {
    const dateStr = dateToString(currentDate)
    const dayName = getDayName(currentDate)
    const dayOfWeek = currentDate.getDay()

    if (dayOfWeek >= 1 && dayOfWeek <= 4) {
      const weekInfo = getWeekNumber(currentDate)
      const weekKey = `${weekInfo.year}-W${String(weekInfo.week).padStart(2, "0")}`

      // Get schedule data for this week if available
      const scheduleData = existingSchedule?.get(weekKey)

      // Check half-day off for this day
      const halfDayOffUsers = new Set<string>()
      if (scheduleData) {
        const morningOff = scheduleData["1/2 journée off Matin"]?.[dayName]?.value || []
        const afternoonOff = scheduleData["1/2 journée off Après-midi"]?.[dayName]?.value || []
        morningOff.forEach((u) => halfDayOffUsers.add(u))
        afternoonOff.forEach((u) => halfDayOffUsers.add(u))
      }

      // Check rythmo and coro assignments for this day
      const rythmoCoroUsers = new Set<string>()
      if (scheduleData) {
        const morningRythmo = scheduleData["Matin - Rythmo"]?.[dayName]?.value || []
        const apmRythmo = scheduleData["Apm - Rythmo"]?.[dayName]?.value || []
        const morningCoro = scheduleData["Matin - Coro"]?.[dayName]?.value || []
        const apmCoro = scheduleData["Apm - Coro"]?.[dayName]?.value || []
        ;[...morningRythmo, ...apmRythmo, ...morningCoro, ...apmCoro].forEach((u) => rythmoCoroUsers.add(u))
      }

      const tomorrow = new Date(currentDate)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = dateToString(tomorrow)
      const usersWithNCTTomorrow = new Set<string>()
      nctDatesByUser.forEach((dates, user) => {
        if (dates.has(tomorrowStr)) {
          usersWithNCTTomorrow.add(user)
        }
      })

      // Check if this is the day after a Sunday astreinte
      const yesterday = new Date(currentDate)
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = dateToString(yesterday)
      const blockedUsers = new Set<string>()

      if (yesterday.getDay() === 0 && sundayAstreintes.has(yesterdayStr)) {
        const sundayUsers = sundayAstreintes.get(yesterdayStr) || []
        sundayUsers.forEach((user) => {
          if (constraints.noGuardAfterSundayAstreinte.includes(user)) {
            blockedUsers.add(user)
          }
        })
      }

      const yesterdayAstreintes = astreintesByDate.get(yesterdayStr) || new Set()

      const usersAlreadyAssigned = assignedDates.get(dateStr) || new Set()
      const slotsNeeded = 2 - usersAlreadyAssigned.size

      if (slotsNeeded > 0) {
        // Find available users
        const availableUsers = allUsers.filter((user) => {
          if (usersAlreadyAssigned.has(user)) return false
          if (constraints.vacations2026[user]?.includes(dateStr)) return false
          if (blockedUsers.has(user)) return false
          if (halfDayOffUsers.has(user)) return false
          if (rythmoCoroUsers.has(user)) return false
          if (usersWithNCTTomorrow.has(user)) return false // Block if NCT tomorrow

          if (["M", "O", "W"].includes(user) && yesterdayAstreintes.has(user)) {
            return false
          }

          return true
        })

        if (availableUsers.length > 0) {
          // Sort by current guard count (ascending) for equitable distribution
          availableUsers.sort((a, b) => userGuardCount[a] - userGuardCount[b])

          // Assign up to slotsNeeded users
          for (let i = 0; i < Math.min(slotsNeeded, availableUsers.length); i++) {
            const assignedUser = availableUsers[i]
            userGuardCount[assignedUser]++

            if (!assignedDates.has(dateStr)) {
              assignedDates.set(dateStr, new Set())
            }
            assignedDates.get(dateStr)?.add(assignedUser)

            if (i === 0) {
              proposals.push({
                date: dateStr,
                day: dayName,
                user: assignedUser,
                type: "Garde Matin",
                isProposal: true,
                weekKey,
              })
            } else {
              proposals.push({
                date: dateStr,
                day: dayName,
                user: assignedUser,
                type: "Garde Midi",
                isProposal: true,
                weekKey,
              })
              proposals.push({
                date: dateStr,
                day: dayName,
                user: assignedUser,
                type: "Garde Nuit",
                isProposal: true,
                weekKey,
              })
            }
          }
        }
      }
    }

    currentDate.setDate(currentDate.getDate() + 1)
  }

  return proposals
}

export function generateAstreinteRotation(
  startWeek: number,
  startYear: number,
  endWeek: number,
  endYear: number,
): AstreinteRotation[] {
  const rotations: AstreinteRotation[] = []
  const usersOMW = ["O", "M", "W"] // Rotation order for O, M, W
  let userIndex = 0

  let currentYear = startYear
  let currentWeek = startWeek

  while (currentYear < endYear || (currentYear === endYear && currentWeek <= endWeek)) {
    const rotation: AstreinteRotation = {
      weekNumber: currentWeek,
      year: currentYear,
    }

    const isEvenWeek = currentWeek % 2 === 0

    if (isEvenWeek) {
      // Semaines PAIRES:
      // O/M/W: lundi nuit, mardi nuit, vendredi nuit, samedi midi+nuit, dimanche entier
      // CH: mercredi nuit, jeudi nuit
      const user1 = usersOMW[userIndex % 3]
      const user2 = usersOMW[(userIndex + 1) % 3]

      rotation.monday = user1 // O/M/W lundi nuit
      rotation.tuesday = user1 // O/M/W mardi nuit
      rotation.wednesday = "CH" // CH mercredi nuit
      rotation.thursday = "CH" // CH jeudi nuit
      rotation.friday = user1 // O/M/W vendredi nuit
      rotation.saturday1 = user1 // O/M/W samedi midi + nuit (garde vendredi = garde samedi)
      rotation.saturday2 = user2 // 2ème utilisateur samedi midi + nuit
      rotation.sunday = user1 // O/M/W dimanche entier (celui qui fait vendredi fait dimanche entier)
      rotation.sundayAstreinte = user2 // 2ème fait astreinte dimanche

      userIndex++
    } else {
      // Semaines IMPAIRES:
      // CH: lundi nuit, mardi nuit, vendredi nuit, samedi midi+nuit, dimanche entier
      // O/M/W: mercredi nuit, jeudi nuit
      const user1 = usersOMW[userIndex % 3]

      rotation.monday = "CH" // CH lundi nuit
      rotation.tuesday = "CH" // CH mardi nuit
      rotation.wednesday = user1 // O/M/W mercredi nuit
      rotation.thursday = usersOMW[(userIndex + 1) % 3] // O/M/W jeudi nuit
      rotation.friday = "CH" // CH vendredi nuit
      rotation.saturday1 = "CH" // CH samedi midi + nuit
      rotation.saturday2 = "CH" // CH samedi
      rotation.sunday = "CH" // CH dimanche entier
      rotation.sundayAstreinte = "CH" // CH astreinte dimanche

      userIndex++
    }

    rotations.push(rotation)

    // Move to next week
    currentWeek++
    if (currentWeek > 52) {
      currentWeek = 1
      currentYear++
    }
  }

  return rotations
}

/** YYYY-MM-DD en calendrier local (évite le décalage UTC de toISOString). */
function toLocalIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/** Calendrier NCT (W/M uniquement) : date ISO → médecin */
function buildNctDoctorByDate(): Map<string, string> {
  const map = new Map<string, string>()
  ;[...NCT_DATES_2025_DEC, ...NCT_DATES_2026].forEach((nct) => {
    map.set(nct.date, nct.user)
  })
  return map
}

/**
 * Propositions de Garde Nuit sur Lundi→Dimanche.
 * Lundi exclu (FV) sauf vacances FV → alors préférence U.
 * Préférences : Mar M/W, Mer S/U/P, Jeu O/G, Ven pool B/G/A/P/Z/H/S.
 * Jamais de garde la veille d’un NCT pour le médecin NCT (W/M).
 */
export function generateNightGuardProposals(
  startDate: Date,
  endDate: Date,
  constraints: GuardConstraints,
  existingSchedule?: Map<string, any>,
): GuardProposal[] {
  const proposals: GuardProposal[] = []
  const userGuardCount: Record<string, number> = {}
  const userAstreinteCount: Record<string, number> = {}
  const fridayRotationCount: Record<string, number> = {}

  const fridayPool = NIGHT_GUARD_DAY_RULES.VENDREDI.only || []
  fridayPool.forEach((user) => {
    fridayRotationCount[user] = 0
  })

  GUARD_ELIGIBLE_USERS.forEach((user) => {
    userGuardCount[user] = 0
    userAstreinteCount[user] = 0
  })

  constraints.fixedGuards2026.forEach((guard) => {
    if (guard.type === "Garde Nuit" && userGuardCount[guard.user] !== undefined) {
      userGuardCount[guard.user]++
      if (fridayRotationCount[guard.user] !== undefined) {
        const d = new Date(`${guard.date}T12:00:00`)
        if (d.getDay() === 5) fridayRotationCount[guard.user]++
      }
    }
  })

  constraints.fixedAstreintes2026.forEach((astreinte) => {
    if (["M", "O", "W"].includes(astreinte.user)) {
      userAstreinteCount[astreinte.user] = (userAstreinteCount[astreinte.user] || 0) + 1
    }
  })

  // NCT : uniquement W/M (calendrier dédié, pas les fixed guards)
  const nctDoctorByDate = buildNctDoctorByDate()

  const assignedDates = new Map<string, Set<string>>()
  constraints.fixedGuards2026.forEach((guard) => {
    if (!assignedDates.has(guard.date)) assignedDates.set(guard.date, new Set())
    assignedDates.get(guard.date)!.add(guard.user)
  })

  const astreinteDates = new Map<string, Set<string>>()
  constraints.fixedAstreintes2026.forEach((astreinte) => {
    if (!astreinteDates.has(astreinte.date)) astreinteDates.set(astreinte.date, new Set())
    astreinteDates.get(astreinte.date)!.add(astreinte.user)
  })

  const noFridayHard = new Set<string>([
    ...NO_FRIDAY_NIGHT_GUARD,
    ...(constraints.noFridayUsers || []),
  ])

  const currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())

  while (currentDate <= end) {
    const dateStr = toLocalIsoDate(currentDate)
    const dayOfWeek = currentDate.getDay()
    const dayName = ["DIMANCHE", "LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI"][dayOfWeek]

    const weekInfo = getWeekNumber(currentDate)
    const weekKey = `${weekInfo.year}-W${String(weekInfo.week).padStart(2, "0")}`

    const fvOnVacation = constraints.vacations2026["FV"]?.includes(dateStr) === true
    if (dayOfWeek === 1 && !fvOnVacation) {
      currentDate.setDate(currentDate.getDate() + 1)
      continue
    }

    const existingNight =
      existingSchedule?.get(weekKey)?.["Garde Nuit"]?.[dayName]?.value || []
    if (Array.isArray(existingNight) && existingNight.length > 0) {
      currentDate.setDate(currentDate.getDate() + 1)
      continue
    }

    const tomorrow = new Date(currentDate)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = toLocalIsoDate(tomorrow)
    const nctDoctorTomorrow = nctDoctorByDate.get(tomorrowStr) // W ou M ou undefined

    const yesterday = new Date(currentDate)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = toLocalIsoDate(yesterday)

    const alreadyAssigned = assignedDates.get(dateStr) || new Set()
    const dayRules = NIGHT_GUARD_DAY_RULES[dayName]

    let availableUsers = GUARD_ELIGIBLE_USERS.filter((user) => {
      if (alreadyAssigned.has(user)) return false
      if (constraints.vacations2026[user]?.includes(dateStr)) return false
      if (OFF_SITE_DAYS[user]?.includes(dayName)) return false

      // Vendredi : O/W/M jamais ; pool exclusif B/G/A/P/Z/H/S
      if (dayOfWeek === 5 && noFridayHard.has(user)) return false

      // Jamais de garde la veille d’un NCT pour le médecin NCT (W/M uniquement)
      if (nctDoctorTomorrow && user === nctDoctorTomorrow) return false

      if (["M", "O", "W"].includes(user)) {
        const yesterdayAstreintes = astreinteDates.get(yesterdayStr) || new Set()
        if (yesterdayAstreintes.has(user)) return false
      }

      return true
    })

    // Pool exclusif (vendredi)
    if (dayRules?.only?.length) {
      availableUsers = availableUsers.filter((u) => dayRules.only!.includes(u))
    }

    // Préférences souples (lundi U, mardi M/W, …)
    if (dayRules?.prefer?.length) {
      const preferred = availableUsers.filter((u) => dayRules.prefer!.includes(u))
      if (preferred.length > 0) availableUsers = preferred
    }

    if (availableUsers.length > 0) {
      availableUsers.sort((a, b) => {
        // Vendredi : rotation équitable dans le pool
        if (dayOfWeek === 5) {
          const fa = fridayRotationCount[a] ?? 0
          const fb = fridayRotationCount[b] ?? 0
          if (fa !== fb) return fa - fb
        }
        const countA = userGuardCount[a] + (["M", "O", "W"].includes(a) ? userAstreinteCount[a] * 0.5 : 0)
        const countB = userGuardCount[b] + (["M", "O", "W"].includes(b) ? userAstreinteCount[b] * 0.5 : 0)
        return countA - countB
      })

      const assignedUser = availableUsers[0]
      userGuardCount[assignedUser]++
      if (dayOfWeek === 5 && fridayRotationCount[assignedUser] !== undefined) {
        fridayRotationCount[assignedUser]++
      }

      if (!assignedDates.has(dateStr)) assignedDates.set(dateStr, new Set())
      assignedDates.get(dateStr)!.add(assignedUser)

      proposals.push({
        date: dateStr,
        day: dayName,
        user: assignedUser,
        type: "Garde Nuit",
        isProposal: true,
        weekKey,
      })
    }

    currentDate.setDate(currentDate.getDate() + 1)
  }

  return proposals
}

function getWeekNumber(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return {
    year: date.getUTCFullYear(),
    week: weekNo,
  }
}
