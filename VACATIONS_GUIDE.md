# Guide de Gestion des Vacances - Cardiomaine Planning

## Vue d'ensemble

Le système de gestion des vacances permet aux administrateurs de :
- Enregistrer les périodes de congés des médecins
- Exclure automatiquement les médecins en vacances lors de la génération des gardes
- Visualiser les vacances dans le planning
- Maintenir l'équité dans la répartition des gardes

## Architecture

### Base de données

Table `doctor_vacations` dans Supabase :
```sql
CREATE TABLE doctor_vacations (
  id UUID PRIMARY KEY,
  doctor_id TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(doctor_id, start_date, end_date)
);
```

### Fichiers créés

**Utilitaires:**
- `lib/vacation-utils.ts` - Fonctions de vérification de vacances
- `lib/vacation-converter.ts` - Conversion des données pour l'algorithme

**Actions serveur:**
- `app/actions/vacation-actions.ts` - CRUD pour les vacations
- `app/actions/guard-generation-actions.ts` - Génération gardes avec vacations

**Composants UI:**
- `components/vacations-modal.tsx` - Modale de gestion
- `components/vacations-button.tsx` - Bouton d'accès
- `components/vacations-badge.tsx` - Badge d'affichage

## Utilisation

### Pour les administrateurs

1. **Accéder à la gestion des vacances:**
   - Cliquez sur le bouton "✈️ Vacances" dans la barre de contrôle

2. **Ajouter une vacation:**
   - Sélectionnez la date de début
   - Sélectionnez la date de fin
   - Optionnel: ajoutez une raison (Congés, Maladie, Sabbatique...)
   - Cliquez sur "Ajouter les vacances"

3. **Supprimer une vacation:**
   - Cliquez sur le bouton "Supprimer" à côté de la vacation

4. **Générer les gardes:**
   - Cliquez sur "Générer Gardes Nuit"
   - Les médecins en vacances seront automatiquement exclus
   - Les gardes restantes seront réparties équitablement

### Visualisation

Les médecins en vacances à une date donnée sont marqués avec un badge:
```
✈️ Congés
```

## Flux de données

```
Administrateur ajoute vacation
    ↓
VacationsModal → vacation-actions.ts → Supabase
    ↓
Lors de la génération de gardes:
    ↓
generateGuardsWithVacations()
    ↓
getAllVacations() → Récupère depuis Supabase
    ↓
vacation-converter.ts → Convertit pour l'algorithme
    ↓
mergeVacations() → Fusionne avec vacations statiques
    ↓
generateNightGuardProposals() → Génère gardes sans médecins en vacances
```

## Logique de l'algorithme

### Exclusion des médecins en vacances

```typescript
const availableUsers = GUARD_ELIGIBLE_USERS.filter((user) => {
  // ... autres vérifications ...
  
  // Vérifier si le médecin est en vacances
  if (constraints.vacations2026[user]?.includes(dateStr)) return false
  
  return true
})
```

### Rééquilibrage automatique

Lorsqu'un médecin est en vacances et ne peut pas faire une garde, l'algorithme :
1. Exclut le médecin de la sélection
2. Sélectionne parmi les autres médecins disponibles
3. Maintient l'équité en utilisant le comptage des gardes

## Exemples

### Ajouter des vacances pour un médecin

```typescript
const result = await addVacation(
  "M",                    // doctor_id
  "2026-03-15",          // start_date
  "2026-03-22",          // end_date
  "Vacances d'été"       // reason (optional)
)
```

### Vérifier la disponibilité

```typescript
const isAvailable = !isDoctorOnVacation("M", new Date("2026-03-20"), vacations)
const availableDoctors = getAvailableDoctorsForDate(
  ["M", "W", "O"],
  new Date("2026-03-20"),
  vacations
)
```

### Générer les gardes

```typescript
const { proposals, error } = await generateGuardsWithVacations(
  new Date("2026-01-01"),
  new Date("2026-12-31")
)
```

## Conseils de gestion

1. **Planification à l'avance:** Enregistrez les vacances dès que possible
2. **Mise à jour régulière:** Mettez à jour avant de générer les gardes
3. **Vérification:** Relisez les propositions générées pour vérifier l'équité
4. **Raisons:** Utilisez le champ raison pour la traçabilité

## Règles de validation

- Date de fin ≥ Date de début
- Un médecin ne peut pas avoir deux périodes chevauchantes
- Les dates doivent être dans le format YYYY-MM-DD

## Améliorations futures possibles

- [ ] Édition des vacations existantes
- [ ] Import/export des vacations (CSV, Excel)
- [ ] Calendrier visuel pour les vacations
- [ ] Notifications d'approche de gardes
- [ ] Historique des modifications
- [ ] Approbation des vacances par un gestionnaire

## Dépannage

### Les vacations ne s'appliquent pas aux gardes générées

1. Vérifiez que les vacations ont été ajoutées correctement
2. Recharges la page pour s'assurer que les données sont à jour
3. Vérifiez que la date de la vacation correspond à la date de la garde

### Impossible d'ajouter une vacation

1. Vérifiez que les deux dates sont remplies
2. Assurez-vous que la date de fin est après la date de début
3. Vérifiez qu'il n'existe pas déjà une vacation pour cette période

## Support

Pour toute question ou problème, consultez l'administrateur système ou la documentation technique.
