# Configuration du VoiceAndUploadPanel

## Variables d'environnement requises

Ajoutez ces variables à votre fichier `.env.local` ou à la configuration Vercel:

```env
# API Guard (Render backend)
NEXT_PUBLIC_GUARD_API_BASE_URL=https://guard-api-cardiomaine.onrender.com
NEXT_PUBLIC_GUARD_API_KEY=votre_clé_api_here
```

## Architecture de l'intégration

### Composants créés/modifiés:

1. **`components/VoiceAndUploadPanel.tsx`** - Nouveau composant
   - Gère la reconnaissance vocale (Web Speech API)
   - Gère l'upload de PDF avec drag & drop
   - Communique avec l'API Render (`/voice-command` et `/upload-planning-pdf`)

2. **`lib/voice-panel-utils.ts`** - Nouvelles fonctions utilitaires
   - `buildCurrentWeekRequest()` - Construit le payload pour l'API
   - `convertSolverResponseToScheduleData()` - Convertit la réponse en ScheduleData

3. **`components/schedule-app.tsx`** - Modifié
   - Import du composant `VoiceAndUploadPanel`
   - Import des utilitaires `voice-panel-utils`
   - Fonction `buildWeekRequestForVoicePanel` (useMemo)
   - Fonction `handleVoicePanelScheduleUpdate` pour mettre à jour le planning
   - Intégration du composant dans la toolbar (visible pour les admins)

## Flux de fonctionnement

### Voice Command:
```
Utilisateur parle → Web Speech API transcrit
  ↓
Envoie à API Render (`/voice-command`)
  ↓
Claude (Anthropic) interprète la commande
  ↓
Solveur OR-Tools recalcule le planning
  ↓
Réponse retournée au frontend
  ↓
Convertie en ScheduleData
  ↓
Mise à jour du state `fullSchedule`
```

### PDF Upload:
```
Utilisateur upload/drag-drop PDF → FormData
  ↓
Envoie à API Render (`/upload-planning-pdf`)
  ↓
Backend extrait le planning du PDF
  ↓
Réponse retournée au frontend
  ↓
Utilisateur peut pré-remplir ou valider
```

## Utilisation

Le composant `VoiceAndUploadPanel` s'affiche automatiquement:
- **Seulement pour les admins** (vérifie `isAdmin`)
- **Seulement si la clé API est configurée** (vérifie `process.env.NEXT_PUBLIC_GUARD_API_KEY`)
- **Positionnement:** Au-dessus des onglets "Aujourd'hui/Semaine/Global"

## Format de `currentWeekRequest`

```typescript
{
  week_start_date: "2026-01-12",  // YYYY-MM-DD
  week_type: 1,                    // 1=impair, 2=pair
  medecins: [
    { id: "P", statut: "permanent", points_astreinte: 0, ... },
    ...
  ],
  vacations: [
    { doctor_id: "P", start_date: "2026-01-13", end_date: "2026-01-17" },
    ...
  ],
  weekend_mode: "ROTATION",
  last_nct_doctor: null,
  existing_schedule: {
    "Garde Nuit|LUNDI": ["P", "Z"],
    "Astreintes ATL Nuit|MARDI": ["M"],
    ...
  }
}
```

## Endpoint API attendus (Render backend)

### POST /voice-command
```json
{
  "command": "Demain S remplace B en garde de nuit",
  "week_request": { ... },
  "known_doctors": ["P", "Z", "B", ...]
}
```

Réponse:
```json
{
  "assignments": [
    {
      "date": "2026-01-13",
      "day": "MARDI",
      "slot": "nuit",
      "activity": "Garde Nuit",
      "doctors": ["S", "Z"]
    },
    ...
  ],
  "warnings": [...]
}
```

### POST /upload-planning-pdf
- Multipart form data avec file (`form.append('file', file)`)
- Headers: `X-API-Key: <apiKey>`
- Réponse: Même format que `/voice-command`

## Troubleshooting

### Web Speech API non supportée
- Vérifier le navigateur (Chrome/Edge/Safari supportent)
- Vérifier HTTPS en production

### API 401 Unauthorized
- Vérifier `NEXT_PUBLIC_GUARD_API_KEY`
- Vérifier que la clé est correcte sur Render

### Réponse vide de Claude
- Vérifier `ANTHROPIC_API_KEY` sur Render
- Vérifier les médecins dans `known_doctors`

## Tests recommandés

1. **Micro:** "Demain M remplace Z en Garde Nuit"
2. **PDF:** Upload un PDF de planning
3. **Complex:** "Mercredi W et M en Astreinte ATL Matin"

