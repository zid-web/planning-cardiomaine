# Backend notes — weekend WOM combo / Ven↔Sam ATL Nuit

À porter dans **`guard-api-cardiomaine`** (Cursor ne peut pas pusher ce dépôt).

## Règles métier

1. **Ven ASTREINTE nuit = Sam ASTREINTE nuit** (même médecin) — implication dure.
2. Semaines `week_type=2` (week-end ATL M/O/W) :
   - **Combo** (~10 / 13 week-ends paires sur 6 mois) :
     - **A** = Ven ATL Nuit + Sat ATL Matin/Midi/Nuit + Garde Dim Matin/Midi/Nuit
     - **B** = Garde Sam Matin/Midi/Nuit + Sun ATL Matin/Midi/Nuit
     - Croisement : Sat ATL ⇒ Garde Dim ; Garde Sam ⇒ Sun ATL
   - **Mono** : Sat+Sun ATL = un seul M/O/W (équité `points_weekend` / 6 mois)
3. Semaines `week_type=1` : week-end ATL = **CH** (inchangé).

## Front déjà livré

`lib/weekend-wom-rules.ts` branché dans `applyStructuralConstraints` (soft fill cases vides uniquement).

## Implémentation solveur suggérée

- Contrainte : `astreinte_fri_night[d] == astreinte_sat_night[d]` pour d ∈ {M,O,W,CH}
- Heuristique combo vs mono selon compteur week-ends WOM sur fenêtre 6 mois
- Paires (A,B) ∈ permutations de {M,O,W} avec équité
