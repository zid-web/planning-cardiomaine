import type { User } from "./types"

export const DAYS = ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI", "DIMANCHE"]

export const DOCTORS = [
  "P",
  "Z",
  "B",
  "G",
  "W",
  "M",
  "S",
  "O",
  "H",
  "U",
  "A",
  "V",
  "Val",
  "K",
  "CH",
  "FV",
  "D",
  "R",
  "T",
]

export const STAFF_INITIALS = [
  "P",
  "Z",
  "B",
  "G",
  "W",
  "M",
  "S",
  "O",
  "H",
  "U",
  "A",
  "V",
  "Val",
  "K",
  "CH",
  "FV",
  "D",
  "R",
  "T",
]

export const SPECIALTIES = {
  echo: ["P", "Z", "B", "G"],
  coro: ["W", "M", "S", "O"],
  rythmo: ["H", "U", "A", "V"],
  general: ["Val", "K", "CH", "FV", "D", "R", "T"],
}

export const INITIAL_USERS: User[] = [
  // Admin user for email-based login
  {
    id: "zidouissem@gmail.com",
    firstName: "Ouassim",
    lastName: "Zid",
    doctorCode: "Z",
    password: "1234",
    email: "zidouissem@gmail.com",
    failedAttempts: 0,
    isLocked: false,
    isFirstLogin: true,
    role: "admin",
    specialty: "general",
  },
  ...STAFF_INITIALS.map((code) => {
    let specialty: User["specialty"] = "general"
    if (SPECIALTIES.echo.includes(code)) specialty = "echo"
    else if (SPECIALTIES.coro.includes(code)) specialty = "coro"
    else if (SPECIALTIES.rythmo.includes(code)) specialty = "rythmo"

    return {
      id: code,
      firstName: "Dr",
      lastName: code,
      doctorCode: code,
      password: "1234",
      email: "",
      failedAttempts: 0,
      isLocked: false,
      isFirstLogin: true,
      role: code === "M" || code === "Z" ? "admin" : "user",
      specialty,
    }
  }),
]

export const DOCTOR_COLORS: { [key: string]: string } = {
  P: "bg-blue-500",
  Z: "bg-emerald-500",
  B: "bg-red-500",
  G: "bg-yellow-500",
  W: "bg-purple-500",
  M: "bg-pink-500",
  S: "bg-indigo-500",
  O: "bg-orange-500",
  H: "bg-teal-500",
  U: "bg-cyan-500",
  A: "bg-lime-600",
  V: "bg-fuchsia-500",
  Val: "bg-rose-500",
  K: "bg-violet-500",
  CH: "bg-sky-500",
  FV: "bg-amber-500",
  D: "bg-stone-500",
  R: "bg-red-700",
  T: "bg-emerald-700",
}

export const ACTIVITY_ICONS: { [key: string]: string } = {
  "Cs PSS": "🩺",
  "Cs Tessée": "🩺",
  Visite: "👀",
  Stress: "🏃",
  "ETT salle 1": "💓",
  "ETT salle 2": "💓",
  RÉEDUCATION: "💪",
  EE1: "🚲",
  EE2: "🚲",
  Rythmo: "⚡",
  Coro: "🫀",
  "Entrées PSS": "📥",
  "Pré-op": "📋",
  "Astreintes ATL Matin": "🌙",
  "Astreintes ATL Midi": "🌙",
  "Astreintes ATL Nuit": "🌙",
  "Garde Matin": "🛡️",
  "Garde Midi": "🛡️",
  "Garde Nuit": "🛡️",
  "Hors site - NCT": "🏥",
  "Hors site - CDL": "🏥",
  "Hors site - IRM": "🏥",
  "Hors site - Scinti": "🏥",
  "Hors site - LFB": "🏥",
  "Hors site - PSSL": "🏥",
}
