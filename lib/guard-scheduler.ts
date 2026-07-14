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

const GUARD_ELIGIBLE_USERS = ["A", "B", "G", "Z", "H", "S", "O", "M", "W", "U", "P"]

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

export function generateNightGuardProposals(
  startDate: Date,
  endDate: Date,
  constraints: GuardConstraints,
  existingSchedule?: Map<string, any>,
): GuardProposal[] {
  const proposals: GuardProposal[] = []
  const userGuardCount: Record<string, number> = {}
  const userAstreinteCount: Record<string, number> = {} // Track astreintes for M, O, W

  // Initialize counts
  GUARD_ELIGIBLE_USERS.forEach((user) => {
    userGuardCount[user] = 0
    userAstreinteCount[user] = 0
  })

  // Count existing fixed guards
  constraints.fixedGuards2026.forEach((guard) => {
    if (guard.type === "Garde Nuit" && userGuardCount[guard.user] !== undefined) {
      userGuardCount[guard.user]++
    }
  })

  // Count existing fixed astreintes for M, O, W (they count in the balance)
  constraints.fixedAstreintes2026.forEach((astreinte) => {
    if (["M", "O", "W"].includes(astreinte.user)) {
      userAstreinteCount[astreinte.user] = (userAstreinteCount[astreinte.user] || 0) + 1
    }
  })

  // Build NCT dates lookup (date -> users with NCT)
  const nctDateUsers = new Map<string, string[]>()
  ;[...constraints.fixedGuards2026, ...constraints.fixedAstreintes2026].forEach((nct) => {
    if (!nctDateUsers.has(nct.date)) nctDateUsers.set(nct.date, [])
    nctDateUsers.get(nct.date)!.push(nct.user)
  })

  // Track assigned dates to avoid duplicates
  const assignedDates = new Map<string, Set<string>>()
  constraints.fixedGuards2026.forEach((guard) => {
    if (!assignedDates.has(guard.date)) assignedDates.set(guard.date, new Set())
    assignedDates.get(guard.date)!.add(guard.user)
  })

  // Track astreinte dates for M, O, W to avoid guard the day after
  const astreinteDates = new Map<string, Set<string>>()
  constraints.fixedAstreintes2026.forEach((astreinte) => {
    if (!astreinteDates.has(astreinte.date)) astreinteDates.set(astreinte.date, new Set())
    astreinteDates.get(astreinte.date)!.add(astreinte.user)
  })

  const currentDate = new Date(startDate)

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split("T")[0]
    const dayOfWeek = currentDate.getDay()
    const dayName = ["DIMANCHE", "LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI"][dayOfWeek]

    // Only Monday to Thursday (1-4)
    if (dayOfWeek >= 1 && dayOfWeek <= 4) {
      const weekInfo = getWeekNumber(currentDate)
      const weekKey = `${weekInfo.year}-W${String(weekInfo.week).padStart(2, "0")}`

      // Get tomorrow's date for NCT check
      const tomorrow = new Date(currentDate)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = tomorrow.toISOString().split("T")[0]

      // Get yesterday for astreinte check
      const yesterday = new Date(currentDate)
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split("T")[0]

      // Check who already has a guard on this date
      const alreadyAssigned = assignedDates.get(dateStr) || new Set()

      // Find available users
      const availableUsers = GUARD_ELIGIBLE_USERS.filter((user) => {
        // Already assigned this day
        if (alreadyAssigned.has(user)) return false

        // On vacation
        if (constraints.vacations2026[user]?.includes(dateStr)) return false

        // Off-site this day
        if (OFF_SITE_DAYS[user]?.includes(dayName)) return false

        // Has NCT tomorrow
        const tomorrowNCTUsers = nctDateUsers.get(tomorrowStr) || []
        if (tomorrowNCTUsers.includes(user)) return false

        // M, O, W: check if had astreinte yesterday (ATL night)
        if (["M", "O", "W"].includes(user)) {
          const yesterdayAstreintes = astreinteDates.get(yesterdayStr) || new Set()
          if (yesterdayAstreintes.has(user)) return false
        }

        return true
      })

      if (availableUsers.length > 0) {
        // Sort by total count (guards + astreintes for M/O/W) for equitable distribution
        availableUsers.sort((a, b) => {
          const countA = userGuardCount[a] + (["M", "O", "W"].includes(a) ? userAstreinteCount[a] * 0.5 : 0)
          const countB = userGuardCount[b] + (["M", "O", "W"].includes(b) ? userAstreinteCount[b] * 0.5 : 0)
          return countA - countB
        })

        // Assign the user with lowest count
        const assignedUser = availableUsers[0]
        userGuardCount[assignedUser]++

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

// Export exceptional rotation constraints
export const exceptionalRotations2026 = [
  {
    id: "rotation-week1-jul13-19",
    name: "Roulement exceptionnel semaine 1",
    startDate: "2026-07-13",
    endDate: "2026-07-19",
    isActive: true,
    rules: [
      // Week 1 rules - CH dominant
      { date: "2026-07-13", dayOfWeek: "LUNDI", astreinteType: "Nuit", allowedDoctors: ["CH"], rotationMode: "fixed" as const },
      { date: "2026-07-14", dayOfWeek: "MARDI", astreinteType: "Nuit", allowedDoctors: ["CH"], rotationMode: "fixed" as const },
      { date: "2026-07-15", dayOfWeek: "MERCREDI", astreinteType: "Nuit", allowedDoctors: ["W", "M"], rotationMode: "round_robin" as const },
      { date: "2026-07-16", dayOfWeek: "JEUDI", astreinteType: "Nuit", allowedDoctors: ["W", "M"], rotationMode: "round_robin" as const },
      { date: "2026-07-17", dayOfWeek: "VENDREDI", astreinteType: "Nuit", allowedDoctors: ["CH"], rotationMode: "fixed" as const },
      { date: "2026-07-18", dayOfWeek: "SAMEDI", astreinteType: "Entier", allowedDoctors: ["CH"], rotationMode: "fixed" as const },
      { date: "2026-07-19", dayOfWeek: "DIMANCHE", astreinteType: "Entier", allowedDoctors: ["CH"], rotationMode: "fixed" as const },
    ],
    rotationHistory: [],
  },
  {
    id: "rotation-week2-jul20-26",
    name: "Roulement exceptionnel semaine 2",
    startDate: "2026-07-20",
    endDate: "2026-07-26",
    isActive: true,
    rules: [
      // Week 2 rules - M/W/O dominant, CH for Wed/Thu only
      { date: "2026-07-20", dayOfWeek: "LUNDI", astreinteType: "Nuit", allowedDoctors: ["M", "W", "O"], rotationMode: "round_robin" as const },
      { date: "2026-07-21", dayOfWeek: "MARDI", astreinteType: "Nuit", allowedDoctors: ["M", "W", "O"], rotationMode: "round_robin" as const },
      { date: "2026-07-22", dayOfWeek: "MERCREDI", astreinteType: "Nuit", allowedDoctors: ["CH"], rotationMode: "fixed" as const },
      { date: "2026-07-23", dayOfWeek: "JEUDI", astreinteType: "Nuit", allowedDoctors: ["CH"], rotationMode: "fixed" as const },
      { date: "2026-07-24", dayOfWeek: "VENDREDI", astreinteType: "Nuit", allowedDoctors: ["M", "W", "O"], rotationMode: "round_robin" as const },
      { date: "2026-07-25", dayOfWeek: "SAMEDI", astreinteType: "Entier", allowedDoctors: ["M", "W", "O"], rotationMode: "fixed" as const },
      { date: "2026-07-26", dayOfWeek: "DIMANCHE", astreinteType: "Entier", allowedDoctors: ["M", "W", "O"], rotationMode: "fixed" as const },
    ],
    rotationHistory: [],
  },
] as const
