import { DAYS } from "./constants"
import type { CellData, ScheduleData } from "./types"
import { constraints2026, generateAstreinteRotation, NCT_DATES_2026, NCT_DATES_2025_DEC } from "./guard-scheduler"

export const getWeekNumber = (d: Date) => {
  // Copy date so don't modify original
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday's day number 7
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  // Get first day of year
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  // Calculate full weeks to nearest Thursday
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)

  return {
    year: date.getUTCFullYear(),
    week: weekNo,
  }
}

export const getWeekDates = (date: Date) => {
  const curr = new Date(date)
  // Adjust to Monday
  const day = curr.getDay()
  const diff = curr.getDate() - day + (day === 0 ? -6 : 1)

  const monday = new Date(curr.setDate(diff))
  const dates = []

  for (let i = 0; i < 7; i++) {
    const nextDay = new Date(monday)
    nextDay.setDate(monday.getDate() + i)
    dates.push(nextDay.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" }))
  }
  return dates
}

export const getFrenchPublicHolidays = (year: number) => {
  const holidays: Record<string, string> = {
    [`01/01/${year}`]: "Jour de l'an",
    [`01/05/${year}`]: "Fête du travail",
    [`08/05/${year}`]: "Victoire 1945",
    [`14/07/${year}`]: "Fête Nationale",
    [`15/08/${year}`]: "Assomption",
    [`01/11/${year}`]: "Toussaint",
    [`11/11/${year}`]: "Armistice 1918",
    [`25/12/${year}`]: "Noël",
  }

  // Calculate dynamic holidays (Easter based)
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const n0 = h + l - 7 * m + 114
  const n = Math.floor(n0 / 31) - 1
  const p = (n0 % 31) + 1

  const easterDate = new Date(year, n, p)

  // Easter Monday
  const easterMonday = new Date(easterDate)
  easterMonday.setDate(easterDate.getDate() + 1)
  holidays[easterMonday.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })] =
    "Lundi de Pâques"

  // Ascension (39 days after Easter)
  const ascension = new Date(easterDate)
  ascension.setDate(easterDate.getDate() + 39)
  holidays[ascension.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })] = "Ascension"

  // Pentecost Monday (50 days after Easter)
  const pentecost = new Date(easterDate)
  pentecost.setDate(easterDate.getDate() + 50)
  holidays[pentecost.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })] =
    "Lundi de Pentecôte"

  return holidays
}

export const isHoliday = (dateStr: string) => {
  // dateStr is dd/mm/yy, convert to full year for check if needed or handle logic
  // our getWeekSchedule logic might need full dates, but getWeekDates returns dd/mm/yy
  // Let's adjust the holiday keys to match dd/mm/yy
  const [day, month, year] = dateStr.split("/")
  const fullYear = Number.parseInt(year) + 2000 // assumption for 21st century
  const holidays = getFrenchPublicHolidays(fullYear)
  // holidays keys are dd/mm/yyyy
  const key = `${day}/${month}/${fullYear}`
  return holidays[key]
}

export const createEmptyRow = () => {
  return DAYS.reduce(
    (acc, day) => ({
      ...acc,
      [day]: { value: [], type: "empty" as const, status: "validated" as const },
    }),
    {} as { [key: string]: CellData },
  )
}

export const generateWeekSchedule = (weekKey: string): ScheduleData => {
  const schedule: ScheduleData = {
    // Astreintes ATL
    "Astreintes ATL Matin": createEmptyRow(),
    "Astreintes ATL Midi": createEmptyRow(),
    "Astreintes ATL Nuit": createEmptyRow(),

    // Garde
    "Garde Matin": createEmptyRow(),
    "Garde Midi": createEmptyRow(),
    "Garde Nuit": createEmptyRow(),

    // Hors site (Detailed)
    "Matin - Visite": createEmptyRow(),
    "Hors site - NCT": createEmptyRow(),
    "Hors site - CDL": createEmptyRow(),
    "Hors site - IRM": createEmptyRow(),
    "Hors site - Scinti": createEmptyRow(),
    "Hors site - LFB": createEmptyRow(),
    "Hors site - PSSL": createEmptyRow(),

    // Vacations Matin
    "Matin - Cs PSS": createEmptyRow(),
    "Matin - Cs Tessée": createEmptyRow(),
    "Matin - Stress": createEmptyRow(),
    "Matin - ETT salle 1": createEmptyRow(),
    "Matin - ETT salle 2": createEmptyRow(),
    "Matin - EE1": createEmptyRow(),
    "Matin - EE2": createEmptyRow(),
    "Matin - Rythmo": createEmptyRow(),
    "Matin - Coro": createEmptyRow(),

    // Vacations Après-midi
    "Apm - Cs PSS": createEmptyRow(),
    "Apm - Cs Tessée": createEmptyRow(),
    "Apm - Stress": createEmptyRow(),
    "Apm - ETT salle 1": createEmptyRow(),
    "Apm - ETT salle 2": createEmptyRow(),
    "Apm - RÉEDUCATION": createEmptyRow(),
    "Apm - EE1": createEmptyRow(),
    "Apm - EE2": createEmptyRow(),
    "Apm - Rythmo": createEmptyRow(),
    "Apm - Coro": createEmptyRow(),

    // Autres
    "Entrées PSS": createEmptyRow(),
    "Pré-op": createEmptyRow(),
    "1/2 journée off Matin": createEmptyRow(),
    "1/2 journée off Après-midi": createEmptyRow(),
    Vacances: createEmptyRow(),
    Congrès: createEmptyRow(),
    Congés: createEmptyRow(),

    // Notes row
    "Notes du jour": createEmptyRow(),
  }

  const weekNum = Number.parseInt(weekKey.split("-W")[1] || "1", 10)
  const yearNum = Number.parseInt(weekKey.split("-")[0] || "2025", 10)

  // Reconstruct date from ISO week
  const simple = new Date(Date.UTC(yearNum, 0, 1 + (weekNum - 1) * 7))
  const dayOfWeek = simple.getUTCDay()
  const isoWeekStart = simple
  if (dayOfWeek <= 4) simple.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1)
  else simple.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay())

  // This approximation is good enough for generating dates for the week
  // actually let's use the helper we have if we can pass a date
  // Better: We need to know which DAYS (Lundi..Dimanche) map to which dates to check holidays
  // Let's create a map of DayName -> isHoliday

  // Reuse the logic from getWeekNumber reverse or similar to find the Monday of that week
  // Using the ISO logic from before:
  // We need to find Monday of weekNum, yearNum
  // Simple approach for ISO weeks:
  const jan4 = new Date(Date.UTC(yearNum, 0, 4))
  const dayJan4 = jan4.getUTCDay() || 7
  const monday1 = new Date(jan4.getTime() - (dayJan4 - 1) * 86400000) // Monday of week 1
  const targetMonday = new Date(monday1.getTime() + (weekNum - 1) * 7 * 86400000)

  const weekDatesMap: Record<string, boolean> = {}
  DAYS.forEach((dayName, index) => {
    const d = new Date(targetMonday)
    d.setUTCDate(targetMonday.getUTCDate() + index)
    const dateStr = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
    const holidays = getFrenchPublicHolidays(yearNum)
    // Also check next year if week spans years
    const holidaysNext = getFrenchPublicHolidays(yearNum + 1)
    weekDatesMap[dayName] = !!holidays[dateStr] || !!holidaysNext[dateStr]
  })

  // Apply Rules
  // P: Rythmo Matin & Apm (Mardi)
  if (schedule["Matin - Rythmo"] && schedule["Matin - Rythmo"]["MARDI"]) {
    schedule["Matin - Rythmo"]["MARDI"].value = ["P"]
  }
  if (schedule["Apm - Rythmo"] && schedule["Apm - Rythmo"]["MARDI"]) {
    schedule["Apm - Rythmo"]["MARDI"].value = ["P"]
  }

  // U: Rythmo Mercredi Apm
  if (schedule["Apm - Rythmo"] && schedule["Apm - Rythmo"]["MERCREDI"]) {
    schedule["Apm - Rythmo"]["MERCREDI"].value = ["U"]
  }

  // A: Rythmo Apm (Lundi, Jeudi)
  if (schedule["Apm - Rythmo"]) {
    if (schedule["Apm - Rythmo"]["LUNDI"]) schedule["Apm - Rythmo"]["LUNDI"].value = ["A"]
    if (schedule["Apm - Rythmo"]["JEUDI"]) schedule["Apm - Rythmo"]["JEUDI"].value = ["A"]
  }

  if (schedule["Hors site - IRM"]) {
    DAYS.forEach((day) => (schedule["Hors site - IRM"][day].value = []))
    if (schedule["Hors site - IRM"]["LUNDI"]) schedule["Hors site - IRM"]["LUNDI"].value = ["S"]
    if (schedule["Hors site - IRM"]["VENDREDI"]) schedule["Hors site - IRM"]["VENDREDI"].value = ["S"]
  }

  if (schedule["Matin - Visite"]) {
    const visiteUsers = ["A", "B", "U"]
    const visiteUser = visiteUsers[weekNum % 3]
    DAYS.forEach((day) => {
      // Apply to all days for Visite? Usually Visite is daily.
      // Assuming daily assignment for the whole week based on "alternance par semaine"
      if (schedule["Matin - Visite"][day]) schedule["Matin - Visite"][day].value = [visiteUser]
    })
  }

  if (schedule["Hors site - LFB"]) {
    DAYS.forEach((day) => (schedule["Hors site - LFB"][day].value = []))
    if (schedule["Hors site - LFB"]["JEUDI"]) {
      const lfbUsers = ["B", "Z", "A"]
      const lfbUser = lfbUsers[weekNum % 3]
      schedule["Hors site - LFB"]["JEUDI"].value = [lfbUser]
    }
  }

  // User blocked Mon, Tue, Wed, Fri. Assuming Thursday open.
  if (schedule["Hors site - PSSL"]) {
    // Just ensuring we don't auto-fill it incorrectly. Currently no auto-fill rule exists for PSSL, so it stays empty.
  }

  // Lundi matin: R, K
  if (schedule["1/2 journée off Matin"] && schedule["1/2 journée off Matin"]["LUNDI"]) {
    schedule["1/2 journée off Matin"]["LUNDI"].value = ["R", "K"]
  }
  // Lundi après-midi: R, K, Z
  if (schedule["1/2 journée off Après-midi"] && schedule["1/2 journée off Après-midi"]["LUNDI"]) {
    schedule["1/2 journée off Après-midi"]["LUNDI"].value = ["R", "K", "Z"]
  }

  // Mardi matin: H, S
  if (schedule["1/2 journée off Matin"] && schedule["1/2 journée off Matin"]["MARDI"]) {
    schedule["1/2 journée off Matin"]["MARDI"].value = ["H", "S"]
  }
  // Mardi après-midi: H, S
  if (schedule["1/2 journée off Après-midi"] && schedule["1/2 journée off Après-midi"]["MARDI"]) {
    schedule["1/2 journée off Après-midi"]["MARDI"].value = ["H", "S"]
  }

  // Mercredi après-midi: B, W, M, G
  if (schedule["1/2 journée off Après-midi"] && schedule["1/2 journée off Après-midi"]["MERCREDI"]) {
    schedule["1/2 journée off Après-midi"]["MERCREDI"].value = ["B", "W", "M", "G"]
  }

  // Jeudi après-midi: P, U
  if (schedule["1/2 journée off Après-midi"] && schedule["1/2 journée off Après-midi"]["JEUDI"]) {
    schedule["1/2 journée off Après-midi"]["JEUDI"].value = ["P", "U"]
  }

  // Vendredi après-midi: O, K, A
  if (schedule["1/2 journée off Après-midi"] && schedule["1/2 journée off Après-midi"]["VENDREDI"]) {
    schedule["1/2 journée off Après-midi"]["VENDREDI"].value = ["O", "K", "A"]
  }

  // K off Friday morning to complete "tous les vendredis off"
  if (schedule["1/2 journée off Matin"] && schedule["1/2 journée off Matin"]["VENDREDI"]) {
    const current = schedule["1/2 journée off Matin"]["VENDREDI"].value
    if (!current.includes("K")) {
      schedule["1/2 journée off Matin"]["VENDREDI"].value = [...current, "K"]
    }
  }

  const allowedRows = [
    "Astreintes ATL Matin",
    "Astreintes ATL Midi",
    "Astreintes ATL Nuit",
    "Garde Matin",
    "Garde Midi",
    "Garde Nuit",
  ]

  Object.keys(schedule).forEach((rowKey) => {
    // If row is NOT in allowed list
    if (!allowedRows.includes(rowKey)) {
      DAYS.forEach((day) => {
        if (weekDatesMap[day]) {
          // It is a holiday, clear the cell
          schedule[rowKey][day].value = []
          // Optionally mark as closed visually if we had a status for it,
          // but 'value: []' effectively closes it for assignment
        }
      })
    }
  })

  if (yearNum === 2025 && weekNum >= 49) {
    const dayToDateMap: Record<string, string> = {}
    DAYS.forEach((dayName, index) => {
      const d = new Date(targetMonday)
      d.setUTCDate(targetMonday.getUTCDate() + index)
      dayToDateMap[dayName] = d.toISOString().split("T")[0]
    })

    NCT_DATES_2025_DEC.forEach((nct) => {
      const dayName = Object.keys(dayToDateMap).find((day) => dayToDateMap[day] === nct.date)
      if (dayName && schedule["Hors site - NCT"]) {
        schedule["Hors site - NCT"][dayName].value = [nct.user]
      }
    })
  }

  if (yearNum === 2026) {
    const dayToDateMap: Record<string, string> = {}
    DAYS.forEach((dayName, index) => {
      const d = new Date(targetMonday)
      d.setUTCDate(targetMonday.getUTCDate() + index)
      dayToDateMap[dayName] = d.toISOString().split("T")[0] // YYYY-MM-DD
    })

    // Apply NCT dates
    NCT_DATES_2026.forEach((nct) => {
      const dayName = Object.keys(dayToDateMap).find((day) => dayToDateMap[day] === nct.date)
      if (dayName && schedule["Hors site - NCT"]) {
        schedule["Hors site - NCT"][dayName].value = [nct.user]
      }
    })

    // Apply fixed guards
    constraints2026.fixedGuards2026.forEach((guard) => {
      const dayName = Object.keys(dayToDateMap).find((day) => dayToDateMap[day] === guard.date)
      if (dayName && schedule[guard.type]) {
        const currentValue = schedule[guard.type][dayName]?.value || []
        if (!currentValue.includes(guard.user)) {
          schedule[guard.type][dayName].value = [...currentValue, guard.user]
        }
      }
    })

    // Apply fixed astreintes
    constraints2026.fixedAstreintes2026.forEach((astreinte) => {
      const dayName = Object.keys(dayToDateMap).find((day) => dayToDateMap[day] === astreinte.date)
      const rowKey = astreinte.type // "Astreintes ATL"

      // Apply to all three periods (Matin, Midi, Nuit)
      if (dayName) {
        ;["Matin", "Midi", "Nuit"].forEach((period) => {
          const fullRowKey = `${rowKey} ${period}`
          if (schedule[fullRowKey]) {
            const currentValue = schedule[fullRowKey][dayName]?.value || []
            if (!currentValue.includes(astreinte.user)) {
              schedule[fullRowKey][dayName].value = [...currentValue, astreinte.user]
            }
          }
        })
      }
    })

    // Apply vacations
    Object.entries(constraints2026.vacations2026).forEach(([user, dates]) => {
      dates.forEach((dateStr) => {
        const dayName = Object.keys(dayToDateMap).find((day) => dayToDateMap[day] === dateStr)
        if (dayName && schedule["Vacances"]) {
          const currentValue = schedule["Vacances"][dayName]?.value || []
          if (!currentValue.includes(user)) {
            schedule["Vacances"][dayName].value = [...currentValue, user]
          }
        }
      })
    })
  }

  if (yearNum >= 2025 && (yearNum > 2025 || weekNum >= 49)) {
    const rotations = generateAstreinteRotation(49, 2025, 52, 2026)
    const currentRotation = rotations.find((r) => r.weekNumber === weekNum && r.year === yearNum)

    if (currentRotation) {
      const dayToDateMap: Record<string, string> = {}
      DAYS.forEach((dayName, index) => {
        const d = new Date(targetMonday)
        d.setUTCDate(targetMonday.getUTCDate() + index)
        dayToDateMap[dayName] = d.toISOString().split("T")[0]
      })

      const hasFixedAstreinte = (day: string, user: string) => {
        const dateStr = dayToDateMap[day]
        return constraints2026.fixedAstreintes2026.some((a) => a.date === dateStr && a.user === user)
      }

      const applyAstreinteIfNotFixed = (dayName: string, user: string | undefined) => {
        if (!user) return

        const dateStr = dayToDateMap[dayName]
        // Check if there's already a fixed astreinte for this date
        const hasFixed = constraints2026.fixedAstreintes2026.some((a) => a.date === dateStr)

        if (!hasFixed) {
          ;["Matin", "Midi", "Nuit"].forEach((period) => {
            const rowKey = `Astreintes ATL ${period}`
            if (schedule[rowKey]?.[dayName]) {
              const current = schedule[rowKey][dayName].value
              if (!current.includes(user)) {
                schedule[rowKey][dayName].value = [...current, user]
              }
            }
          })
        }
      }

      // Apply Monday astreinte
      applyAstreinteIfNotFixed("LUNDI", currentRotation.monday)

      // Apply Tuesday astreinte
      applyAstreinteIfNotFixed("MARDI", currentRotation.tuesday)

      // Apply Wednesday astreinte
      applyAstreinteIfNotFixed("MERCREDI", currentRotation.wednesday)

      // Apply Thursday astreinte (CH in even weeks)
      applyAstreinteIfNotFixed("JEUDI", currentRotation.thursday)

      // Apply Friday astreinte
      applyAstreinteIfNotFixed("VENDREDI", currentRotation.friday)

      // Apply weekend rotation
      if (currentRotation.saturday1) {
        const satDate = dayToDateMap["SAMEDI"]
        const hasFixedSat = constraints2026.fixedAstreintes2026.some((a) => a.date === satDate)

        if (!hasFixedSat) {
          ;["Matin", "Midi", "Nuit"].forEach((period) => {
            const gardeKey = `Garde ${period}`
            if (schedule[gardeKey]?.["SAMEDI"]) {
              const current = schedule[gardeKey]["SAMEDI"].value
              if (!current.includes(currentRotation.saturday1!)) {
                schedule[gardeKey]["SAMEDI"].value = [...current, currentRotation.saturday1!]
              }
            }
          })
        }

        const sunDate = dayToDateMap["DIMANCHE"]
        const hasFixedSun = constraints2026.fixedAstreintes2026.some((a) => a.date === sunDate)

        if (!hasFixedSun) {
          ;["Matin", "Midi", "Nuit"].forEach((period) => {
            const gardeKey = `Garde ${period}`
            if (schedule[gardeKey]?.["DIMANCHE"]) {
              const current = schedule[gardeKey]["DIMANCHE"].value
              if (!current.includes(currentRotation.saturday1!)) {
                schedule[gardeKey]["DIMANCHE"].value = [...current, currentRotation.saturday1!]
              }
            }
          })
        }
      }

      if (currentRotation.saturday2) {
        const satDate = dayToDateMap["SAMEDI"]
        const hasFixedSat = constraints2026.fixedAstreintes2026.some((a) => a.date === satDate)

        if (!hasFixedSat) {
          ;["Midi", "Nuit"].forEach((period) => {
            const gardeKey = `Garde ${period}`
            if (schedule[gardeKey]?.["SAMEDI"]) {
              const current = schedule[gardeKey]["SAMEDI"].value
              if (!current.includes(currentRotation.saturday2!)) {
                schedule[gardeKey]["SAMEDI"].value = [...current, currentRotation.saturday2!]
              }
            }
          })
        }

        const sunDate = dayToDateMap["DIMANCHE"]
        const hasFixedSun = constraints2026.fixedAstreintes2026.some((a) => a.date === sunDate)

        if (!hasFixedSun) {
          ;["Matin", "Midi", "Nuit"].forEach((period) => {
            const astrKey = `Astreintes ATL ${period}`
            if (schedule[astrKey]?.["DIMANCHE"]) {
              const current = schedule[astrKey]["DIMANCHE"].value
              if (!current.includes(currentRotation.saturday2!)) {
                schedule[astrKey]["DIMANCHE"].value = [...current, currentRotation.saturday2!]
              }
            }
          })
        }
      }
    }
  }

  return schedule
}

export const validatePassword = (password: string): { valid: boolean; error: string } => {
  if (password.length < 10) {
    return { valid: false, error: "Le mot de passe doit contenir au moins 10 caractères" }
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "Le mot de passe doit contenir au moins une majuscule" }
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Le mot de passe doit contenir au moins un chiffre" }
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { valid: false, error: "Le mot de passe doit contenir au moins un caractère spécial (!@#$%^&*...)" }
  }
  return { valid: true, error: "" }
}
