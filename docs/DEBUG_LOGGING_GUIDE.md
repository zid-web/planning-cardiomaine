# 🔍 Guide Complet du Debug Logging - Solveur OR-Tools

## Vue d'ensemble

Le système de génération du planning avec le solveur OR-Tools est maintenant doté d'un système de logging complet et structuré pour faciliter le debug et la résolution de problèmes.

**Deux niveaux de logs:**
- 🟢 **CLIENT** (navigateur) - Visible dans F12 → Console
- 🔵 **SERVER** (serveur) - Visible dans le terminal (npm run dev) ou logs Vercel

---

## 🟢 Logs CLIENT (Browser Console)

### Où voir les logs?
1. Ouvrir l'application
2. Appuyer sur **F12** (DevTools)
3. Aller dans l'onglet **Console**
4. Cliquer sur le bouton "Générer avec Solveur"

### Messages visibles

```
🟢 [CLIENT] Clic sur le bouton Solveur !
```
→ **Le bouton a été cliqué** - Point de départ du flux

```
🟢 [CLIENT] Appel de generateWeekWithSolver pour 2026-01-19
```
→ **L'action serveur a été appelée** - Semaine/date calculée correctement

```
🟢 [CLIENT] Réponse reçue : { schedule: {...}, warnings: [...], error: null }
```
→ **Le serveur a répondu** - Inspection complète du résultat:
- `schedule`: Le planning généré (objet vide = erreur)
- `warnings`: Liste des alertes (array vide = pas d'alertes)
- `error`: Null si succès, message si erreur

### Exemple de flux normal

```
🟢 [CLIENT] Clic sur le bouton Solveur !
🟢 [CLIENT] Appel de generateWeekWithSolver pour 2026-01-19
🟢 [CLIENT] Réponse reçue : {
  schedule: {
    "Astreintes ATL Nuit": {
      "LUNDI": { value: ["Z"], status: "pending", request: null },
      ...
    }
  },
  warnings: ["W: Trop d'astreintes cette semaine"],
  error: null
}
```

### Exemple d'erreur CLIENT

```
🟢 [CLIENT] Clic sur le bouton Solveur !
🟢 [CLIENT] Appel de generateWeekWithSolver pour 2026-01-19
🔴 [CLIENT] Erreur catch : Error: API error (500): Internal Server Error
```

---

## 🔵 Logs SERVER (Terminal / Vercel Logs)

### Où voir les logs?

**En développement local (npm run dev):**
```bash
npm run dev
# → Les logs apparaissent directement dans le terminal
```

**En production (Vercel):**
1. Aller sur https://vercel.com
2. Sélectionner le projet "planning-cardiomaine"
3. Cliquer sur le dernier déploiement
4. Aller dans l'onglet "Functions" ou "Logs"
5. Filtrer par "generateWeekWithSolver"

### Messages visibles

```
🔵 [SERVER] generateWeekWithSolver appelée pour 2026-01-19
```
→ **La fonction a démarré** - Date reçue correctement

```
🔵 [SERVER] Payload construit, appel à l'API Render...
```
→ **Les données ont été rassemblées** - Médecins, vacances, etc. prêts

```
🔵 [SERVER] Statut de la réponse Render : 200
```
→ **L'API Render a répondu avec succès** - HTTP 200 OK

```
🔵 [SERVER] Réponse reçue, 47 assignations.
```
→ **Le solveur a retourné les résultats** - Nombre d'assignations générées

### Exemple de flux normal (terminal)

```
🔵 [SERVER] generateWeekWithSolver appelée pour 2026-01-19
🔵 [SERVER] Payload construit, appel à l'API Render...
🔵 [SERVER] Statut de la réponse Render : 200
🔵 [SERVER] Réponse reçue, 47 assignations.
```

### Exemple d'erreur SERVER

```
🔵 [SERVER] generateWeekWithSolver appelée pour 2026-01-19
🔵 [SERVER] Payload construit, appel à l'API Render...
🔴 [SERVER] Erreur API Render : 500 - Internal Server Error
```

ou

```
🔵 [SERVER] generateWeekWithSolver appelée pour 2026-01-19
🔵 [SERVER] Payload construit, appel à l'API Render...
🔴 [SERVER] Erreur dans generateWeekWithSolver : Error: fetch timeout
```

---

## 🔧 Troubleshooting avec les Logs

### Problème: "Le bouton ne répond pas"

**À vérifier:**
1. ✓ Console du navigateur (F12) affiche-t-elle le log CLIENT?
   - **OUI** → Le clic est détecté, le problème vient du serveur (voir logs SERVER)
   - **NON** → Le bouton n'est pas bien connecté - vérifier l'implémentation du onClick

### Problème: "Erreur lors de la génération" (toast)

**À vérifier:**
1. ✓ Console CLIENT affiche: `🟢 [CLIENT] Appel de generateWeekWithSolver`?
   - **OUI** → Le serveur a été appelé
   - **NON** → Problème de conversion de date dans le calcul du lundi

2. ✓ Logs SERVER affichent-ils `🔵 [SERVER] generateWeekWithSolver appelée`?
   - **OUI** → La fonction serveur a démarré
   - **NON** → Problème de communication réseau ou déploiement échoué

3. ✓ Logs SERVER affichent-ils `🔵 [SERVER] Statut de la réponse Render`?
   - **OUI 200** → L'API Render a répondu, problème de parsing
   - **OUI 5xx** → L'API Render a une erreur interne
   - **NON** → Timeout ou erreur réseau

### Problème: "Timeout (65 secondes)"

**À vérifier:**
1. Logs SERVER montrent: `🔴 [SERVER] Erreur dans generateWeekWithSolver : Error: fetch timeout`?
   - **OUI** → L'API Render est lente (plan gratuit redémarre peut-être)
   - Solution: Attendre quelques secondes et réessayer

2. Console CLIENT affiche: `🟢 [CLIENT] Réponse reçue` après 65s?
   - **OUI** → Le timeout est bien géré côté client
   - **NON** → Le navigateur s'est fermé ou rechargé

---

## 📊 Flow Complet Visible dans les Logs

```
NAVIGATEUR (Console F12)
│
├─ 🟢 [CLIENT] Clic sur le bouton Solveur !
│
└─ [Appel réseau vers /app/actions/solver-api-actions.ts]
   │
   ├─ SERVEUR (Terminal / Vercel Logs)
   │ │
   │ ├─ 🔵 [SERVER] generateWeekWithSolver appelée pour 2026-01-19
   │ ├─ 🔵 [SERVER] Payload construit, appel à l'API Render...
   │ │
   │ └─ [Appel réseau vers https://guard-api-cardiomaine.onrender.com/generate-week]
   │    │
   │    ├─ API RENDER
   │    │ (Traitement du solveur OR-Tools)
   │    │
   │    └─ Réponse avec assignations
   │
   │ ├─ 🔵 [SERVER] Statut de la réponse Render : 200
   │ ├─ 🔵 [SERVER] Réponse reçue, 47 assignations.
   │ └─ [Retour du résultat au client]
   │
   └─ NAVIGATEUR (Console F12)
      │
      ├─ 🟢 [CLIENT] Appel de generateWeekWithSolver pour 2026-01-19
      ├─ 🟢 [CLIENT] Réponse reçue : { schedule: {...}, warnings: [...] }
      └─ [Mise à jour du planning dans l'UI]
```

---

## 🎯 Tips de Debug

### Copier les logs pour analyse
```javascript
// Dans la console, copier tout le flux:
copy(JSON.stringify(result, null, 2))
// Puis coller dans un éditeur ou partager avec support
```

### Filtrer les logs dans Vercel
```
Sélectionner: "generateWeekWithSolver"
Chercher: "🔵" ou "🔴" pour les logs importants
```

### Tester l'API Render directement
```bash
curl -X POST https://guard-api-cardiomaine.onrender.com/generate-week \
  -H "Content-Type: application/json" \
  -d '{
    "week_start_date": "2026-01-19",
    "medecins": [...],
    "vacations": [],
    "weekend_mode": "ROTATION"
  }'
```

---

## ✅ Checklist de Debug

Pour diagnostiquer un problème de génération:

- [ ] 🟢 Console CLIENT affiche "Clic sur le bouton"?
- [ ] 🟢 Console CLIENT affiche "Appel de generateWeekWithSolver"?
- [ ] 🔵 Logs SERVER affichent "generateWeekWithSolver appelée"?
- [ ] 🔵 Logs SERVER affichent "Payload construit"?
- [ ] 🔵 Logs SERVER affichent "Statut de la réponse Render"?
- [ ] 🟢 Console CLIENT affiche "Réponse reçue"?
- [ ] L'objet `result` contient `schedule` (pas null)?
- [ ] Les warnings affichent correctement?

Si toutes les cases sont cochées → La génération fonctionne normalement
Si une case est vide → Voir la section Troubleshooting correspondante

---

**Documentation complète pour le debug du solveur OR-Tools.** 🚀
