export const DAYS = ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI", "DIMANCHE"]

// DOCTORS list includes both internal (with login accounts) and external doctors (no login)
// External doctors: FV, CH (Centre Hospitalier), DAAS, D (no Supabase account, no authentication)
// FV: Garde Nuit chaque lundi + Coro chaque jeudi après-midi (hors vacances)
// CH: Centre Hospitalier externe — astreintes ATL uniquement (jamais de garde)
// DAAS: uniquement EE (Apm - EE2) chaque lundi après-midi (hors vacances)
// D: Echo PSS stress consultation externe (jeudi)
// IRM: uniquement S — lundi matin + vendredi après-midi (hors vacances)
// Visite: uniquement U, A, B en rotation hebdomadaire
// Rythmo: A chaque lundi + jeudi après-midi
// I: interne — Garde Matin uniquement, associé à un médecin (cumul Cs/ETT/EE autorisé)
//
// Admins hors planning (ex. Lucie = L) : voir `lib/staff-admin.ts` —
// PAS dans DOCTORS (pas de tâches médicales), login admin via profiles.
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
  "DAAS",
  "R",
  "T",
  "I",
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
  "DAAS",
  "R",
  "T",
  "I",
]

// Doctor classification - metadata for different doctor types
export const DOCTOR_METADATA: Record<
  string,
  {
    name: string
    is_externe: boolean
    can_be_assigned_to_guards: boolean
    can_be_assigned_to_astreinte: boolean
    can_be_assigned_to_nct: boolean
    can_have_vacations: boolean
    status: 'internal' | 'externe_garde' | 'externe_consultation' | 'ch' | 'admin'
  }
> = {
  P: {
    name: 'Poret',
    is_externe: false,
    can_be_assigned_to_guards: true,
    can_be_assigned_to_astreinte: false,
    can_be_assigned_to_nct: true,
    can_have_vacations: true,
    status: 'internal',
  },
  Z: {
    name: 'Denizet',
    is_externe: false,
    can_be_assigned_to_guards: true,
    can_be_assigned_to_astreinte: false,
    can_be_assigned_to_nct: true,
    can_have_vacations: true,
    status: 'admin',
  },
  B: {
    name: 'Braun',
    is_externe: false,
    can_be_assigned_to_guards: true,
    can_be_assigned_to_astreinte: false,
    can_be_assigned_to_nct: true,
    can_have_vacations: true,
    status: 'internal',
  },
  G: {
    name: 'Terrien',
    is_externe: false,
    can_be_assigned_to_guards: true,
    can_be_assigned_to_astreinte: false,
    can_be_assigned_to_nct: true,
    can_have_vacations: true,
    status: 'internal',
  },
  W: {
    name: 'Ben Amara',
    is_externe: false,
    can_be_assigned_to_guards: true,
    can_be_assigned_to_astreinte: true,
    can_be_assigned_to_nct: true,
    can_have_vacations: true,
    status: 'internal',
  },
  M: {
    name: 'Zid',
    is_externe: false,
    can_be_assigned_to_guards: true,
    can_be_assigned_to_astreinte: true,
    can_be_assigned_to_nct: true,
    can_have_vacations: true,
    status: 'admin',
  },
  S: {
    name: 'Saint André',
    is_externe: false,
    can_be_assigned_to_guards: true,
    can_be_assigned_to_astreinte: false,
    can_be_assigned_to_nct: true,
    can_have_vacations: true,
    status: 'internal',
  },
  O: {
    name: 'Bros',
    is_externe: false,
    can_be_assigned_to_guards: true,
    can_be_assigned_to_astreinte: true,
    can_be_assigned_to_nct: true,
    can_have_vacations: true,
    status: 'internal',
  },
  H: {
    name: 'Bachelet',
    is_externe: false,
    can_be_assigned_to_guards: true,
    can_be_assigned_to_astreinte: false,
    can_be_assigned_to_nct: true,
    can_have_vacations: true,
    status: 'internal',
  },
  U: {
    name: 'Kabalu',
    is_externe: false,
    can_be_assigned_to_guards: true,
    can_be_assigned_to_astreinte: false,
    can_be_assigned_to_nct: true,
    can_have_vacations: true,
    status: 'internal',
  },
  A: {
    name: 'Amirault',
    is_externe: false,
    can_be_assigned_to_guards: true,
    can_be_assigned_to_astreinte: false,
    can_be_assigned_to_nct: true,
    can_have_vacations: true,
    status: 'internal',
  },
  V: {
    name: 'Lefebvre',
    is_externe: false,
    can_be_assigned_to_guards: true,
    can_be_assigned_to_astreinte: false,
    can_be_assigned_to_nct: true,
    can_have_vacations: true,
    status: 'internal',
  },
  Val: {
    name: 'Val',
    is_externe: false,
    can_be_assigned_to_guards: true,
    can_be_assigned_to_astreinte: false,
    can_be_assigned_to_nct: true,
    can_have_vacations: true,
    status: 'internal',
  },
  K: {
    name: 'Dericbourg',
    is_externe: false,
    can_be_assigned_to_guards: true,
    can_be_assigned_to_astreinte: false,
    can_be_assigned_to_nct: true,
    can_have_vacations: true,
    status: 'internal',
  },
  R: {
    name: 'Rousseau',
    is_externe: false,
    can_be_assigned_to_guards: true,
    can_be_assigned_to_astreinte: false,
    can_be_assigned_to_nct: true,
    can_have_vacations: true,
    status: 'internal',
  },
  T: {
    name: 'Cloitre',
    is_externe: false,
    can_be_assigned_to_guards: true,
    can_be_assigned_to_astreinte: false,
    can_be_assigned_to_nct: true,
    can_have_vacations: true,
    status: 'internal',
  },
  CH: {
    name: 'Centre Hospitalier',
    is_externe: true,
    can_be_assigned_to_guards: false, // Astreintes ATL uniquement — jamais Garde Matin/Midi/Nuit
    can_be_assigned_to_astreinte: true,
    can_be_assigned_to_nct: false,
    can_have_vacations: false,
    status: 'ch',
  },
  FV: {
    name: 'FV (Externe)',
    is_externe: true,
    can_be_assigned_to_guards: true, // Lundi nuit uniquement (contrainte métier)
    can_be_assigned_to_astreinte: false, // Pas d’ATL — Coro jeudi apm + garde lundi nuit
    can_be_assigned_to_nct: false,
    can_have_vacations: true, // Peut avoir des vacances
    status: 'externe_garde',
  },
  D: {
    name: 'D (Echo PSS stress)',
    is_externe: true,
    can_be_assigned_to_guards: false,
    can_be_assigned_to_astreinte: false,
    can_be_assigned_to_nct: false,
    can_have_vacations: true,
    status: 'externe_consultation',
  },
  DAAS: {
    name: 'DAAS (EE2)',
    is_externe: true,
    can_be_assigned_to_guards: false,
    can_be_assigned_to_astreinte: false,
    can_be_assigned_to_nct: false,
    can_have_vacations: true,
    status: 'externe_consultation',
  },
  I: {
    name: 'Interne',
    is_externe: true,
    can_be_assigned_to_guards: true, // Garde Matin uniquement (règle slot-blocking)
    can_be_assigned_to_astreinte: false,
    can_be_assigned_to_nct: false,
    can_have_vacations: false,
    status: 'externe_garde',
  },
}

export const SPECIALTIES = {
  echo: ["P", "Z", "B", "G"],
  coro: ["W", "M", "S", "O"],
  rythmo: ["H", "U", "A", "V", "P"],
  general: ["Val", "K", "CH", "FV", "D", "R", "T"],
}



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
  DAAS: "bg-slate-500",
  R: "bg-red-700",
  T: "bg-emerald-700",
  I: "bg-sky-700",
}

// Ancien gris neutre Congés — les badges Congés utilisent désormais DOCTOR_COLORS
export const CONGES_BADGE_COLOR = "bg-gray-500 opacity-75"

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
