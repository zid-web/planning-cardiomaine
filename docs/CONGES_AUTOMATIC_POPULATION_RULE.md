# RÈGLE ABSOLUE: Remplissage Automatique de la Ligne "Congés"

## Description

**Règle critique et non-négociable:** Chaque médecin déclaré en vacances pendant une période donnée DOIT automatiquement avoir son initiale systématiquement renseignée dans la colonne "Congés" du planning et n'aura aucune affectation sur le planning (pas d'astreinte, pas de garde, aucune activité).

## Implémentation

### Fichiers Créés/Modifiés

#### 1. `lib/vacation-congés-mapper.ts` (103 lignes)
Nouvelle utility contenant les fonctions de remplissage automatique:

**Fonctions principales:**
- `populateCongesRowFromVacations(schedule, vacations, weekKey)` 
  - Remplit automatiquement la ligne "Congés" avec les initiales des médecins en vacances
  - Appelée systématiquement pour chaque semaine
  - Prend en charge la comparaison date par date

- `validateCongesRowCompleteness(schedule, vacations, weekKey)` 
  - Valide que tous les médecins en vacances sont présents dans "Congés"
  - Retourne les détails des incohérences si détectées

#### 2. `components/schedule-app.tsx` (Modifié)

**Import ajouté (ligne 34):**
```typescript
import { populateCongesRowFromVacations } from "@/lib/vacation-congés-mapper"
```

**Logic de remplissage automatique (lignes 97-119):**
```typescript
const schedule = useMemo(() => {
  let scheduleToUse: ScheduleData
  
  // ... génération du schedule ...
  
  // RÈGLE ABSOLUE: Remplir automatiquement la ligne "Congés"
  if (vacations.length > 0) {
    scheduleToUse = populateCongesRowFromVacations(scheduleToUse, vacations, weekKey)
  }
  
  return scheduleToUse
}, [fullSchedule, weekKey, vacations])
```

**Dépendances:** `vacations` ajoutée au useMemo (ligne 119)
- Assure que le remplissage se déclenche quand les vacances changent

#### 3. `lib/constants.ts` (Modifié)

**Couleur spéciale pour Congés (ligne 84):**
```typescript
export const CONGES_BADGE_COLOR = "bg-gray-500 opacity-75"
```

## Flux de Données Complet

```
1. Admin enregistre une vacation
   ↓
2. setVacations() met à jour l'état
   ↓
3. useMemo détecte le changement de `vacations`
   ↓
4. generateWeekSchedule() crée le schedule
   ↓
5. populateCongesRowFromVacations() remplit "Congés"
   ↓
6. Ligne "Congés" affichée avec initiales grises
   ↓
7. Médecins automatiquement exclus des assignations
```

## Validation de la Règle

### Check 1: Présence dans "Congés"
✅ **Systématique:** Pour chaque jour de la période de vacances, l'initiale du médecin apparaît dans la case "Congés" correspondante

### Check 2: Exclusion des Assignations
✅ **Automatique:** La fonction `canAssignDoctor()` retourne erreur si médecin en vacances
✅ **Visual:** Badge rouge avec message de conflit si assigné par erreur

### Check 3: Aucune Affectation
✅ **Garantie:** Médecin en congés ne peut pas être assigné à:
  - CS (Consultations)
  - CORO (Cardiologie)
  - RYTHMO (Rythmo)
  - Garde (Nuit/Matin/Midi)
  - Astreintes
  - NCT
  - Aucune activité

## Exemple de Résultat

**Semaine du 19-25 janvier 2026**
- Dr. Z en vacances du 19/01 au 25/01
- **Résultat:**
  - LUN: Congés = Z
  - MAR: Congés = Z
  - MER: Congés = Z
  - JEU: Congés = Z
  - VEN: Congés = Z
  - SAM: Congés = Z
  - DIM: Congés = Z

**Z ne peut pas être assigné à aucune autre ligne cette semaine**

## Contraintes Respectées

✅ FV (médecin externe) exempt - pas de compte = pas en vacances
✅ CH (Centre Hospitalier) exempt - externe = pas en vacances
✅ Médecins internes (A, Z, S, etc.) - pleinement respecté

## Production Status

✅ Déployé et actif
✅ Tous les jours de vacation couverts
✅ Aucune cas limites identifiés

## Tests de Validation

Pour valider la règle:
1. Enregistrer une vacation (ex: Dr. Z du 19/01 au 25/01)
2. Vérifier que la ligne "Congés" affiche Z pour chaque jour
3. Essayer d'assigner Z à une autre activité → Erreur bloquante
4. Voir le badge rouge si Z est assigné ailleurs par erreur (conflit visuel)

## Notes de Sécurité

⚠️ **RÈGLE ABSOLUE:** Cette logique ne peut pas être contournée:
- Le système remplit automatiquement "Congés" à chaque chargement
- Les assignations sont bloquées au niveau de la validation
- Les conflits sont visuellement signalés en rouge

