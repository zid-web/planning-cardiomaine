# Backend notes — weekend WOM combo / Ven↔Sam ATL Nuit

À porter dans **`guard-api-cardiomaine`** (Cursor ne peut pas pusher ce dépôt).

## Règles métier

1. **Ven ASTREINTE nuit = Sam ASTREINTE nuit** (même médecin) — implication dure.
2. Semaines `week_type=2` (week-end ATL M/O/W) :
   - **Combo** : **exactement 5 week-ends / semestre**, calendrier **prédéfini**
     (front : `WOM_COMBO_EVEN_INDICES = [1,4,7,10,12]` → ex. 2026 H1 =
     W04, W10, W16, W22, W26 ; H2 = W30, W36, W42, W48, W52).
     Surcharge possible via `WOM_COMBO_WEEK_KEYS_OVERRIDE`.
     - **A** = Ven ATL Nuit + Sat ATL Matin/Midi/Nuit + Garde Dim Matin/Midi/Nuit
     - **B** = Garde Sam Matin/Midi/Nuit + Sun ATL Matin/Midi/Nuit
     - Croisement : Sat ATL ⇒ Garde Dim ; Garde Sam ⇒ Sun ATL
   - **Mono** (tous les autres week-ends WOM) : Sat+Sun ATL = un seul M/O/W
     (équité `points_weekend` / 6 mois) — **pas** de croisement Garde↔ATL forcé
3. Semaines `week_type=1` : week-end ATL = **CH** (inchangé).
4. **Saisie manuelle prioritaire** sur pattern / solveur / croisement soft
   (ne jamais réécrire une case déjà pourvue d’un médecin listé).

## Front déjà livré

`lib/weekend-wom-rules.ts` branché dans `applyStructuralConstraints` (soft fill cases vides uniquement).

## Implémentation solveur suggérée

- Contrainte : `astreinte_fri_night[d] == astreinte_sat_night[d]` pour d ∈ {M,O,W,CH}
- Combo uniquement si `week_key` ∈ calendrier des 5 / semestre (aligné front)
- Paires (A,B) ∈ permutations de {M,O,W} avec équité ; sinon mono
