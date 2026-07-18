# Fonctionnalité Consignes de Planning

## Vue d'ensemble
Nouvelle rubrique "Consignes" pour permettre aux admins de gérer les notes, absences et contraintes de planning. Intègre l'enregistrement vocal automatique via Web Speech API.

## Fichiers créés/modifiés

### 1. Migration SQL
**File:** `supabase/migrations/20250118_create_planning_notes_table.sql`

Crée la table `planning_notes` avec:
- `id` (UUID, clé primaire)
- `content` (TEXT, contenu de la note)
- `category` (TEXT: 'absence', 'contrainte', 'note_generale')
- `created_by` (UUID, référence vers auth.users)
- `created_by_email` (TEXT, email du créateur)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

RLS: Seuls les admins peuvent accéder aux notes

Indexes: 
- created_at (DESC) pour le tri
- created_by pour le filtrage

### 2. Server Actions
**File:** `app/actions/planning-notes-actions.ts`

Fonctions:
- `getPlanningNotes()` - Récupère toutes les notes (admin only)
- `createPlanningNote(content, category)` - Crée une note
- `updatePlanningNote(id, content, category)` - Met à jour une note
- `deletePlanningNote(id)` - Supprime une note

Toutes les actions vérifient que l'utilisateur est admin via `profiles.role = 'admin'`

### 3. Composant Client
**File:** `components/planning-notes.tsx`

Fonctionnalités:
- Saisie texte libre avec catégorie
- Enregistrement vocal (Web Speech API)
  - Support français (fr-FR)
  - Indicateur visuel pendant l'enregistrement (micro pulse + icône)
  - Texte transcrit fusionné au contenu saisi
- Affichage chronologique des notes (plus récentes en premier)
- Modification inline des notes
- Suppression avec confirmation
- Messages d'erreur et de succès

Design:
- Interface épurée et professionnelle
- Badges colorés par catégorie
- Responsive (cachage du texte du bouton micro sur mobile)

### 4. Page Dédiée
**File:** `app/protected/planning-notes/page.tsx`

Route: `/protected/planning-notes`
- Accessible uniquement aux utilisateurs connectés
- Metadata SEO optimisée

### 5. Navigation
**File:** `components/navbar.tsx` (modifié)

Ajout:
- Import de l'icône `MessageSquare` de lucide-react
- Bouton "Consignes" dans la navbar
- Lien vers `/protected/planning-notes`
- Icône + texte (caché sur mobile)

## Déploiement

### Étapes:

1. **Appliquer la migration SQL:**
   ```bash
   supabase migration up
   # ou manually via Supabase dashboard
   ```

2. **Déployer le code:**
   ```bash
   git add -A
   git commit -m "Add planning notes feature with audio recording"
   git push
   ```

3. **Vérifier que les admins ont accès:**
   - Naviguer vers `/protected/planning-notes`
   - Bouton "Consignes" visible dans la navbar

### Browser Requirements:
- Web Speech API (supportée par Chrome, Edge, Safari)
- Firefox: moins de support (optionnel)
- Fallback: champ texte fonctionne toujours

## Utilisation

### Pour les Admins:

1. **Créer une note:**
   - Sélectionner la catégorie
   - Taper ou enregistrer la consigne
   - Cliquer "Ajouter la consigne"

2. **Enregistrement vocal:**
   - Cliquer le bouton micro
   - Parler clairement
   - Le texte s'ajoute automatiquement
   - Reclique pour arrêter

3. **Modifier/Supprimer:**
   - Boutons edit/delete à droite de chaque note
   - Les changements sont sauvegardés immédiatement

### Catégories:
- **Note générale**: Consigne générale pour le planning
- **Absence**: Médecin absent une certaine période
- **Contrainte**: Contrainte spécifique pour la génération

## Sécurité

- ✓ RLS activée: seuls les admins accèdent
- ✓ Validation côté serveur
- ✓ Vérification du rôle admin à chaque action
- ✓ Paramètres sécurisés (prepared statements)
- ✓ Pas de fuite d'informations

## Limitations Connues

1. **Web Speech API:**
   - Support variable selon les navigateurs
   - Reconnaissance française fiable pour les accents clairs
   - Timeout après ~10 secondes de silence
   - Aucun contrôle local: les données sont traitées localement, pas d'envoi à Google

2. **Performance:**
   - Migration ajoute une table (impact minimal)
   - Index sur created_at pour recherche rapide

## Prochaines Étapes

- Intégration avec le générateur de gardes (lire les notes lors de la génération)
- Affichage des notes pertinentes sur la page de planning
- Export des notes en PDF
- Rappels automatiques pour les absences

## Tests

Pour tester:
```bash
# Créer une note textuelle
# Tester l'enregistrement vocal (si navigateur supporte)
# Vérifier modification/suppression
# Vérifier l'accès non-admin (doit être refusé)
```
