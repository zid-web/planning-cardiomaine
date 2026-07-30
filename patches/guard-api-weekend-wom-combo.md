# Backend notes — weekend WOM combo / Ven↔Sam ATL Nuit

À porter dans **`guard-api-cardiomaine`** (Cursor ne peut pas pusher ce dépôt).

## Règles métier

1. **Ven ASTREINTE nuit = Sam ASTREINTE nuit** (même médecin) — implication dure.
2. Semaines `week_type=2` (week-end ATL M/O/W) :
   - **Combo** : **exactement 5 week-ends / semestre**, calendrier **prédéfini**
     (2026 : `WOM_COMBO_WEEK_KEYS_2026` — H1 W04/10/16/22/26 ; H2 W30/36/38/42/44).
     Médecins A/B ou mono : `lib/weekend-wom-presets.ts` (W40–W52).
     - **A** = Ven ATL Nuit + Sat ATL Matin/Midi/Nuit + Garde Dim Matin/Midi/Nuit
     - **B** = Garde Sam Matin/Midi/Nuit + Sun ATL Matin/Midi/Nuit
     - Croisement : Sat ATL ⇒ Garde Dim ; Garde Sam ⇒ Sun ATL
   - **Mono** (tous les autres week-ends WOM) : Sat+Sun ATL = un seul M/O/W
     — **pas** de croisement Garde↔ATL forcé
   - **W52 2026** : special **M** = ATL Jeudi nuit + Ven matin/midi/nuit (pas de week-end auto)
3. Semaines `week_type=1` : week-end ATL = **CH** (inchangé).
4. **Presets front** (`weekend-wom-presets.ts`) : sur semaines listées, mono/combo
   sont **forcés** (pas seulement soft fill) pour corriger rotation/solveur/ancien
   combo. Remplacants conservés. Hors preset : soft fill ; saisie hors M/O/W sur
   Garde mono non touchée.

## Front déjà livré

`lib/weekend-wom-rules.ts` branché dans `applyStructuralConstraints` (soft fill cases vides uniquement).

## Implémentation solveur suggérée

- Contrainte : `astreinte_fri_night[d] == astreinte_sat_night[d]` pour d ∈ {M,O,W,CH}
- Combo uniquement si `week_key` ∈ calendrier des 5 / semestre (aligné front)
- Paires (A,B) ∈ permutations de {M,O,W} avec équité ; sinon mono
