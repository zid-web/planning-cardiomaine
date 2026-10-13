# Contrat app ↔ solveur (`POST /generate-week`)

L'app envoie, en plus des champs existants, un bloc **`app_rules`** (version `SOLVER_RULES_VERSION`,
généré par `lib/solver-rules.ts` à partir des constantes de l'app — jamais saisi à la main).

| Clé | Sens attendu côté solveur |
|---|---|
| `holidays` | jour → nom du férié |
| `closed_slots[]` | `{row, day, reason}` : ne rien affecter (fériés, vacations fermées, NCT sans vacation au calendrier) |
| `fixed_assignments[]` | `{row, day, doctors}` : cases validées, à conserver |
| `cleared_cells[]` | cases vidées volontairement : ne pas remplir |
| `night_guard` | pas de nuits consécutives (y compris `previous_sunday_guard_doctor` → lundi), `friday_pool`, `never_friday` (O/W/M), `day_preferences`, `never_doctors` (I), repos après garde (demi-journée off, pas de Coro/ATL/Rythmo le lendemain) |
| `weekly_limits.stress` | max 1 Stress/médecin/semaine si assez de médecins disponibles (rotation) ; D exclu |
| `weekly_limits.pre_op` | un médecin différent chaque jour |
| `eligibility` | ETT interdit à O ; EE : un médecin par infirmière, identique EE1/EE2, O/V/DAAS seuls ; I = Garde Matin uniquement |
| `priorities` | Coro d'abord (M/O/W) ; groupe écho H,Z,G,B,S sur ETT/Stress/Rééduc avant Cs |
| `entrees_pss` | Entrées PSS : lun/mar = médecin de Garde Midi + 1 autre ; mer-ven = Garde Midi seul |
| `atl_night` | Astreinte ATL Nuit : `never` (FV), `follow_midi` (ATL Midi → nuit, bonus), `not_with_night_guard` (jamais avec la garde de nuit) |
| `hors_site_usual_days` | jours habituels CDL/LFB/PSSL/IRM/Scinti (propositions hors de ces jours écartées) |

## Accusé de réception
Le solveur doit renvoyer `applied_rules` (liste/objet) ou `rules_version` dans sa réponse. Sans cela, l'app
affiche un avertissement et applique les règles après génération (`lib/clinical-priority.ts`), qui reste
l'application garantie. Si le solveur répond 400/422 à cause de `app_rules`, l'app retente sans ce bloc.
