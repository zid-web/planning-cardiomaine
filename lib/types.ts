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

export type GuardProposal = {
  date: string
  day: string
  user: string
  type: "Garde Matin" | "Garde Midi" | "Garde Nuit"
  isProposal: true
  weekKey: string
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
