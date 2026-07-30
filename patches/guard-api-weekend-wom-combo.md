# Backend notes — weekend WOM combo / Ven↔Sam ATL Nuit

Solveur **`guard-api-cardiomaine`** (déjà à jour côté combo) + front câblé.

## Champs POST `/generate-week` (front → solveur)

Envoyés **uniquement** si la semaine est dans le calendrier des 5 combos / semestre :

| Champ | Rôle |
|-------|------|
| `weekend_astreinte_combo: true` | Active la génération combo |
| `weekend_combo_astreinte_anchor` | Préférence rôle ATL (Ven+Sat) = preset `atlSat` |
| `weekend_combo_garde_anchor` | Préférence rôle Garde Sam = preset `atlSun` |
| `last_combo_garde_doctor` | Qui a fait Garde au dernier combo (settings) |
| `last_combo_garde_date` | Samedi ISO de ce dernier combo |

Hors calendrier combo : ces champs sont **absents** (comportement inchangé).

Impl front : `lib/weekend-combo-solver.ts` → `generateGuardsViaAPI` + `buildCurrentWeekRequestPayload`.

## Persistance `last_combo_garde_*`

Table `settings` (`last_combo_garde_doctor` / `last_combo_garde_date`), mise à jour après Générer et après validation Garde Sam — d’après le **planning réel** (pas l’ancre), pour l’espacement 15 j. solveur.

## Règles métier (rappel)

1. **Ven ASTREINTE nuit = Sam ASTREINTE nuit** (même médecin).
2. Semaines `week_type=2` :
   - **Combo** : 5 / semestre (`WOM_COMBO_WEEK_KEYS_2026` / presets).
     - Rôle A = Ven ATL Nuit + Sat ATL + Garde Dim
     - Rôle B = Garde Sam + Sun ATL
   - **Mono** : Sat+Sun ATL = un seul M/O/W
   - **W52 2026** : special **M** Jeudi nuit + Ven matin/midi/nuit
3. Presets front **forcés** (`weekend-wom-presets.ts`) ; remplacants conservés.
