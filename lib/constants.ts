export const DAYS = ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI", "DIMANCHE"]

// DOCTORS list includes both internal (with login accounts) and external doctors (no login)
// External doctors: FV, CH (Centre Hospitalier), DAAS, D (no Supabase account, no authentication)
// FV constraints: Garde Nuit lundi only, Coro jeudi après-midi only
// CH: Centre Hospitalier externe (astreinte/garde)
// DAAS: EE2 consultation externe (lundi)
// D: Echo PSS stress consultation externe (jeudi)
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
    name: 'P',
    is_externe: false,
    can_be_assigned_to_guards: true,
    can_be_assigned_to_astreinte: true,
    can_be_assigned_to_nct: true,
    can_have_vacations: true,
    status: 'internal',
  },
  Z: {
    name: 'Z',
    is_externe: false,
    can_be_assigned_to_guards: true,
    can_be_assigned_to_astreinte: true,
    can_be_assigned_to_nct: true,
    can_have_vacations: true,
    status: 'admin',
  },
  B: {
    name: 'B',
    is_externe: false,
    can_be_assigned_to_guards: true,
    can_be_assigned_to_astreinte: true,
    can_be_assigned_to_nct: true,
    can_have_vacations: true,
    status: 'internal',
  },
  G: {
    name: 'G',
    is_externe: false,
    can_be_assigned_to_guards: true,
    can_be_assigned_to_astreinte: true,
    can_be_assigned_to_nct: true,
    can_have_vacations: true,
    status: 'internal',
  },
  W: {
    name: 'W',
    is_externe: false,
    can_be_assigned_to_guards: true,
    can_be_assigned_to_astreinte: true,
    can_be_assigned_to_nct: true,
    can_have_vacations: true,
    status: 'internal',
  },
  M: {
    name: 'M',
    is_externe: false,
    can_be_assigned_to_guards: true,
    can_be_assigned_to_astreinte: true,
    can_be_assigned_to_nct: true,
    can_have_vacations: true,
    status: 'admin',
  },
  S: {
    name: 'S',
    is_externe: false,
    can_be_assigned_to_guards: true,
    can_be_assigned_to_astreinte: true,
    can_be_assigned_to_nct: true,
    can_have_vacations: true,
    status: 'internal',
  },
  O: {
    name: 'O',
    is_externe: false,
    can_be_assigned_to_guards: true,
    can_be_assigned_to_astreinte: true,
    can_be_assigned_to_nct: true,
    can_have_vacations: true,
    status: 'internal',
  },
  H: {
    name: 'H',
    is_externe: false,
    can_be_assigned_to_guards: true,
    can_be_assigned_to_astreinte: true,
    can_be_assigned_to_nct: true,
    can_have_vacations: true,
    status: 'internal',
  },
  U: {
    name: 'U',
    is_externe: false,
    can_be_assigned_to_guards: true,
    can_be_assigned_to_astreinte: true,
    can_be_assigned_to_nct: true,
    can_have_vacations: true,
    status: 'internal',
  },
  A: {
    name: 'A',
    is_externe: false,
    can_be_assigned_to_guards: true,
    can_be_assigned_to_astreinte: true,
    can_be_assigned_to_nct: true,
    can_have_vacations: true,
    status: 'internal',
  },
  V: {
    name: 'V',
    is_externe: false,
    can_be_assigned_to_guards: true,
    can_be_assigned_to_astreinte: true,
    can_be_assigned_to_nct: true,
    can_have_vacations: true,
    status: 'internal',
  },
  Val: {
    name: 'Val',
    is_externe: false,
    can_be_assigned_to_guards: true,
    can_be_assigned_to_astreinte: true,
    can_be_assigned_to_nct: true,
    can_have_vacations: true,
    status: 'internal',
  },
  K: {
    name: 'K',
    is_externe: false,
    can_be_assigned_to_guards: true,
    can_be_assigned_to_astreinte: true,
    can_be_assigned_to_nct: true,
    can_have_vacations: true,
    status: 'internal',
  },
  R: {
    name: 'R',
    is_externe: false,
    can_be_assigned_to_guards: true,
    can_be_assigned_to_astreinte: true,
    can_be_assigned_to_nct: true,
    can_have_vacations: true,
    status: 'internal',
  },
  T: {
    name: 'T',
    is_externe: false,
    can_be_assigned_to_guards: true,
    can_be_assigned_to_astreinte: true,
    can_be_assigned_to_nct: true,
    can_have_vacations: true,
    status: 'internal',
  },
  CH: {
    name: 'Centre Hospitalier',
    is_externe: true,
    can_be_assigned_to_guards: true,
    can_be_assigned_to_astreinte: true,
    can_be_assigned_to_nct: false,
    can_have_vacations: false,
    status: 'ch',
  },
  FV: {
    name: 'FV (Externe)',
    is_externe: true,
    can_be_assigned_to_guards: true, // Lundi nuit uniquement (contrainte métier)
    can_be_assigned_to_astreinte: true, // Jeudi coro après-midi uniquement (contrainte métier)
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
}

export const SPECIALTIES = {
  echo: ["P", "Z", "B", "G"],
  coro: ["W", "M", "S", "O"],
  rythmo: ["H", "U", "A", "V"],
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
  R: "bg-red-700",
  T: "bg-emerald-700",
}

// Couleur spéciale pour la ligne Congés (gris neutre)
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
