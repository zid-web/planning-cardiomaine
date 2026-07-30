/**
 * Calendrier week-end ATL / Garde prédéfini (consignes admin).
 *
 * Saisie manuelle reste prioritaire partout (`fillEmpty*` côté rules).
 *
 * 2026 H2 (W40–W52) — consignes :
 * - W40 mono M ; W42 combo O(A)+M(B) ; W44 combo W(A)+O(B)
 * - W46 mono O ; W48 mono M ; W50 mono W
 * - W52 : MG = ATL Jeudi nuit + Vendredi matin/midi/nuit (pas de pattern week-end)
 *
 * W42 : le médecin A (Ven+Sat ATL + Garde Dim) n’était pas nommé dans la consigne ;
 * on retient **O** (M = B clairement nommé). Corriger ici si besoin.
 *
 * W44 : « O … d'astreinte samedi … et de garde dimanche » interprété comme
 * combo B standard (Garde Sam + ATL Dim), aligné sur W42.
 */

export type WeekendSpecialCell = {
  row: string
  day: string
  doctors: string[]
}

export type WeekendWeekPreset =
  | {
      kind: "mono"
      atlDoctor: "M" | "O" | "W"
      specialCells?: WeekendSpecialCell[]
    }
  | {
      kind: "combo"
      atlSat: "M" | "O" | "W"
      atlSun: "M" | "O" | "W"
      specialCells?: WeekendSpecialCell[]
    }
  | {
      kind: "special"
      /** Pas de mono/combo week-end auto. */
      specialCells: WeekendSpecialCell[]
      /** Désactive Ven↔Sam ATL nuit (défaut true pour special). */
      skipFriSatCoupling?: boolean
    }

/**
 * Presets explicites par week key. Absents = heuristique indices / équité.
 */
export const WOM_WEEKEND_PRESETS: Readonly<Record<string, WeekendWeekPreset>> = {
  "2026-W40": { kind: "mono", atlDoctor: "M" },
  // A=O (Ven+Sat ATL + Garde Dim), B=M (Garde Sam + Sun ATL)
  "2026-W42": { kind: "combo", atlSat: "O", atlSun: "M" },
  // A=W, B=O
  "2026-W44": { kind: "combo", atlSat: "W", atlSun: "O" },
  "2026-W46": { kind: "mono", atlDoctor: "O" },
  "2026-W48": { kind: "mono", atlDoctor: "M" },
  "2026-W50": { kind: "mono", atlDoctor: "W" },
  "2026-W52": {
    kind: "special",
    skipFriSatCoupling: true,
    specialCells: [
      { row: "Astreintes ATL Nuit", day: "JEUDI", doctors: ["MG"] },
      { row: "Astreintes ATL Matin", day: "VENDREDI", doctors: ["MG"] },
      { row: "Astreintes ATL Midi", day: "VENDREDI", doctors: ["MG"] },
      { row: "Astreintes ATL Nuit", day: "VENDREDI", doctors: ["MG"] },
    ],
  },
}

/**
 * Combos 2026 (5 / semestre) — H2 aligné consignes W42/W44
 * (W48/W52 ne sont plus combo : mono M / special MG).
 */
export const WOM_COMBO_WEEK_KEYS_2026 = [
  // H1
  "2026-W04",
  "2026-W10",
  "2026-W16",
  "2026-W22",
  "2026-W26",
  // H2 — 5 slots : early provisional + W42/W44 consignes
  "2026-W30",
  "2026-W36",
  "2026-W38",
  "2026-W42",
  "2026-W44",
] as const

export function getWeekendWeekPreset(weekKey: string): WeekendWeekPreset | null {
  return WOM_WEEKEND_PRESETS[weekKey] ?? null
}
