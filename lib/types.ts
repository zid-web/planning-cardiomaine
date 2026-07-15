export type CellData = {
  value: string[]
  type?: "doctor" | "shift" | "location" | "procedure" | "empty"
  status: "validated" | "pending"
  request?: {
    requester: string
    status: "pending" | "validated"
    timestamp: number
  }
}

export type ScheduleData = {
  [key: string]: {
    [key: string]: CellData
  }
}

export type FullSchedule = {
  [weekKey: string]: ScheduleData
}

export type User = {
  id: string // The username chosen by the user
  firstName?: string
  lastName?: string
  doctorCode: string // The initial (P, Z, B...) used in the schedule
  password?: string
  email?: string
  failedAttempts: number
  isLocked: boolean
  isFirstLogin?: boolean // Added isFirstLogin flag
  role: "admin" | "manager" | "user" | "observer"
  specialty: "echo" | "coro" | "rythmo" | "general"
}

export type SwapRequest = {
  id: string
  requesterId: string
  targetUserId?: string // Optional, if open to anyone
  date: string // YYYY-MM-DD
  shiftType: string // e.g., "Garde", "Astreinte"
  status: "pending" | "accepted" | "rejected" | "cancelled"
  createdAt: string
}

export type GuardProposal = {
  date: string
  day: string
  user: string
  type: "Garde Matin" | "Garde Midi" | "Garde Nuit"
  isProposal: true
  weekKey: string
}

export type Preference = {
  id: string
  userId: string
  date: string
  type: "available" | "unavailable" | "preferred"
  weight?: number // 1-5 importance
}

export type AuditLog = {
  id: string
  userId: string
  action: string
  details: string
  timestamp: string
  ip?: string
}

export type DoctorVacation = {
  id: string
  doctor_id: string
  start_date: string // YYYY-MM-DD
  end_date: string // YYYY-MM-DD
  reason?: string
  created_at: string
  updated_at: string
}
