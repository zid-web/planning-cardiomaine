# 🚀 Intégration Solveur OR-Tools - Documentation Complète

## Vue d'ensemble

L'application Planning Cardiomaine intègre maintenant le solveur OR-Tools déployé sur Render (`https://guard-api-cardiomaine.onrender.com`). Ce solveur automatise la génération du planning hebdomadaire en optimisant l'affectation des médecins aux gardes, astreintes et activités selon les contraintes métier.

---

## Architecture

### 1. **Backend Server Action: `app/actions/solver-api-actions.ts`**

Fichier central responsable de :
- **Récupération des données** : Médecins, vacances, équité
- **Construction du payload** : Formatage selon les spécifications du solveur
- **Appel API** : POST vers `/generate-week` avec timeout 65s
- **Transformation** : Conversion des résultats en `ScheduleData`
- **Gestion d'erreurs** : Timeouts, erreurs 4xx/5xx, AbortError

**Fonction principale :**
```typescript
export async function generateWeekWithSolver(
  weekStartDate: string,
  weekendMode: 'CH' | 'ROTATION' = 'ROTATION'
): Promise<SolverResponse>
```

**Mappings d'activités (ACTIVITY_TO_ROW):**
```typescript
'matin' → {
  'ASTREINTE': 'Astreintes ATL Matin',
  'GARDE': 'Garde Matin',
  'CORO': 'Matin - Coro',
}
'am' → {
  'ASTREINTE': 'Astreintes ATL Midi',
  'GARDE': 'Garde Midi',
  'CORO': 'Apm - Coro',
}
'nuit' → {
  'ASTREINTE': 'Astreintes ATL Nuit',
  'GARDE': 'Garde Nuit',
  'NCT': 'Hors site - NCT',
}
'weekend' → {
  'ASTREINTE': 'Garde Matin',
}
```

### 2. **Frontend: `components/schedule-app.tsx`**

**Bouton inline "Générer avec Solveur":**
- Localisation : Barre admin à côté du bouton "Générer le planning"
- Icône : Calendar (lucide-react)
- État : `isGenerating` pour feedback utilisateur
- Comportement :
  1. Calcul du lundi de la semaine courante
  2. Appel `generateWeekWithSolver(weekStartDate, 'ROTATION')`
  3. Gestion des erreurs et warnings
  4. Mise à jour du schedule via `handleGenerationComplete()`

**Code du bouton:**
```tsx
<Button
  variant="outline"
  size="sm"
  onClick={async () => {
    setIsGenerating(true)
    try {
      const weekKey = `${currentDate.getFullYear()}-W${...}`
      const monday = new Date(currentDate)
      const day = monday.getDay()
      const diff = monday.getDate() - day + (day === 0 ? -6 : 1)
      monday.setDate(diff)
      const weekStartDate = monday.toISOString().split('T')[0]
      
      const result = await generateWeekWithSolver(weekStartDate, 'ROTATION')
      if (result.error) {
        toast.error(`Erreur: ${result.error}`)
      } else if (result.schedule) {
        handleGenerationComplete(result.schedule, result.warnings || [])
      }
    } finally {
      setIsGenerating(false)
    }
  }}
  disabled={isGenerating}
>
  {isGenerating ? (
    <>
      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
      Génération...
    </>
  ) : (
    <>
      <Calendar className="h-4 w-4 mr-2" />
      Générer avec Solveur
    </>
  )}
</Button>
```

### 3. **Configuration: `.env.development.local`**

```
NEXT_PUBLIC_SOLVER_API_URL=https://guard-api-cardiomaine.onrender.com
```

---

## Format de Requête API

```json
{
  "week_start_date": "2026-01-19",
  "medecins": [
    {
      "id": "Z",
      "statut": "admin",
      "points_astreinte": 0,
      "points_garde": 0,
      "points_nct": 0,
      "points_weekend": 0
    }
  ],
  "vacations": [
    {
      "doctor_id": "W",
      "start_date": "2026-01-21",
      "end_date": "2026-01-21"
    }
  ],
  "weekend_mode": "ROTATION",
  "semaine_iso_impaire": true,
  "last_nct_doctor": null
}
```

### Statuts des médecins:
- `permanent` - Médecins internes standards (P, Z, B, G, S, O, H, U, A, V, Val, K, R, T)
- `admin` - Administrateurs (M, O, W)
- `astreinte_coro` - Spécialistes astreinte/coro (M, O, W)
- `fv` - Médecin externe FV
- `daas` - Consultations externes (DAAS, D)
- `ch` - Centre Hospitalier

---

## Format de Réponse API

```json
{
  "assignments": [
    {
      "date": "2026-01-19",
      "day_name": "LUNDI",
      "slot": "matin",
      "activity": "ASTREINTE",
      "doctor": "Z"
    }
  ],
  "warnings": [
    "W: Trop d'astreintes cette semaine",
    "M: Pas de NCT possible cette semaine (vacances)"
  ]
}
```

---

## Flux d'Utilisation

```
1. Admin clique "Générer avec Solveur"
   ↓
2. Calcul de lundi et paramètres de semaine
   ↓
3. Récupération des données (médecins, vacances)
   ↓
4. Construction du payload
   ↓
5. Appel API POST (timeout 65s)
   ↓
6. Transformation des assignations
   ↓
7. Fusion avec le schedule existant
   ↓
8. Affichage des warnings (si présents)
   ↓
9. Toast de succès
```

---

## Gestion des Erreurs

| Erreur | Comportement |
|--------|-------------|
| **Timeout (65s)** | Toast: "Timeout: l'API a pris trop de temps (65s). Le serveur Render redémarre peut-être. Veuillez réessayer." |
| **Erreur 4xx/5xx** | Toast: "API error (status): message" |
| **AbortError** | Gestion spécifique du timeout avec message utilisateur |
| **Parse error** | Toast: "Erreur inconnue" |
| **Réseau** | Toast: "Erreur lors de la génération" |

---

## Affichage des Warnings

Quand des warnings sont présents, ils s'affichent dans une boîte d'alerte jaune sous la barre d'outils :

```tsx
{generatedScheduleWarnings.length > 0 && (
  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
    <p className="font-semibold text-yellow-900 mb-2">Alertes de génération:</p>
    <ul className="text-sm text-yellow-800 list-disc list-inside">
      {generatedScheduleWarnings.map((warning, i) => (
        <li key={i}>{warning}</li>
      ))}
    </ul>
  </div>
)}
```

---

## Debug & Troubleshooting

### La génération ne fonctionne pas

1. **Vérifier la console du navigateur (F12)** pour les erreurs réseau
2. **Vérifier que l'API est accessible** : `https://guard-api-cardiomaine.onrender.com/health`
   - Doit retourner un statut 200 ou 404, pas d'erreur DNS
3. **Vérifier l'URL de l'API** dans `.env.development.local`
4. **Logs serveur** :
   - Tous les appels incluent des logs `console.log('[solver-api] ...')`
   - Ouvrir F12 → Console pour voir les détails

### Le solveur retourne un timeout

- L'API Render redémarre probablement (plan gratuit)
- Attendre quelques secondes et réessayer
- Si le problème persiste, contacter support Render

### Les assignations ne correspondent pas à mes attentes

1. **Vérifier le mapping `ACTIVITY_TO_ROW`** dans `solver-api-actions.ts`
   - Les noms de lignes doivent correspondre exactement à ceux du planning
2. **Vérifier les statuts des médecins** dans `DOCTOR_METADATA`
   - Les externes (DAAS, D) ne doivent pas être assignés
3. **Vérifier les vacances** sont bien enregistrées
4. **Vérifier la parité de la semaine ISO** (impaire/paire détermine le mode)

---

## Fichiers impactés

- ✅ `app/actions/solver-api-actions.ts` - Backend principal
- ✅ `components/schedule-app.tsx` - Intégration UI + bouton
- ✅ `.env.development.local` - Configuration URL API
- ✅ `lib/types.ts` - Types CellData/ScheduleData
- ✅ `lib/constants.ts` - Metadata et statuts des médecins

---

## Production Status

✅ **Déployé et actif**
- URL: https://v0-recreate-attached-p2ci9kbnq-zids-projects-22b662f4.vercel.app
- Tous les logs en place pour debug
- Gestion robuste des timeouts (65s)
- Warnings affichés de manière professionnelle

---

## Notes de sécurité

⚠️ **L'URL de l'API est en dur dans `solver-api-actions.ts`**
- À terme, la migrer dans une variable d'environnement côté serveur (non-publique)
- Actuellement: URL publique OK (pas de données sensibles)

⚠️ **Le solveur a accès à:**
- Liste complète des médecins
- Toutes les vacances enregistrées
- Statuts et contraintes

Aucune donnée personnelle sensible n'est exposée.

---

**Documentation complète et à jour. Prêt pour la production.** 🚀
