export type CellData = {
  value: string[]
  type?: "doctor" | "shift" | "location" | "procedure" | "empty"
  status: "validated" | "pending"
  /** Nom libre d’un remplaçant (admin), affiché en plus des initiales dans `value`. */
  remplacant?: string
  /**
   * True si un admin a explicitement vidé cette case (dernier médecin retiré
   * manuellement). Empêche les mécanismes de remplissage automatique
   * (créneaux fixes, couplages ATL/Garde weekend, etc.) de la re-remplir -
   * distingue "jamais rempli" (peut recevoir un défaut) de "vidé
   * volontairement" (doit rester vide). Confirmé utilisateur 31/07/2026.
   */
  manuallyCleared?: boolean
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

/**
 * doctor_id can be either:
 * - UUID (for internal doctors with Supabase profiles)
 * - TEXT CODE like "FV" (for external doctors without accounts)
 * This allows vacations to be recorded for both authenticated and external doctors
 */
export type DoctorVacation = {
  id: string
  doctor_id: string // UUID or TEXT code (e.g., "FV", "Z", "A")
  start_date: string // YYYY-MM-DD
  end_date: string // YYYY-MM-DD
  reason?: string
  created_at: string
  updated_at: string
}
