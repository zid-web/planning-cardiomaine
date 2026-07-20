# 🚀 DIAGNOSTIC DE PRODUCTION - PLANNING PAGE

## État: ✅ LOCAL FONCTIONNE PARFAITEMENT

### ✅ Tests Locaux Réussis

1. **Click sur cellule** ✅
   - Modale s'ouvre correctement
   - Affiche le titre et le jour
   - Grille de sélection visible

2. **Sélection de médecin** ✅
   - Clic sur badge fonctionne
   - Médecin ajouté à la liste

3. **Affichage dynamique** ✅
   - Badge apparaît dans la cellule
   - "Médecins présents" met à jour en temps réel

---

## 🔍 Debug Logs Ajoutés

Les logs suivants ont été ajoutés au code pour diagnostiquer les problèmes en production:

### Dans `handleCellClick()`
```typescript
console.log('🔍 handleCellClick appelé pour', rowKey, day)
console.log('🔍 isCellBlocked résultat:', isCellBlocked(rowKey, day))
```

### useEffect pour selectedCell
```typescript
useEffect(() => {
  console.log('🔍 selectedCell mis à jour:', selectedCell)
  if (selectedCell) {
    console.log('🔍 Schedule data for selected cell:', schedule?.[selectedCell.row]?.[selectedCell.day])
  }
}, [selectedCell, schedule])
```

---

## 📋 Procédure pour Debugger en Production

### Étape 1: Vérifier les logs
1. Aller sur https://[your-production-url]/protected/planning
2. Ouvrir la console (F12)
3. Cliquer sur une cellule
4. Observer les logs:
   - `🔍 handleCellClick appelé pour ...` doit apparaître
   - `🔍 isCellBlocked résultat: false` doit apparaître
   - `🔍 selectedCell mis à jour: {...}` doit apparaître

### Étape 2: Si aucun log n'apparaît
- **Cause probable**: Le gestionnaire de clic n'est pas attaché
- **Vérification**: 
  - Ouvrir l'inspecteur (F12 → Elements)
  - Cliquer sur un badge dans une cellule
  - Vérifier que l'élément `<td>` a `onClick`

### Étape 3: Si le log apparaît mais la modale ne s'ouvre pas
- **Cause probable**: Problème avec le Dialog ou selectedCell
- **Vérification**:
  - Chercher les logs: `🔍 selectedCell mis à jour`
  - Vérifier la Network tab (F12 → Network)
  - Vérifier les erreurs JavaScript (F12 → Console)

### Étape 4: Clear Cache & Redeploy
Si le problème persiste, forcer une réinstallation:
```bash
npm run build
vercel deploy --prod --force
```

---

## 🔧 Causes Possibles en Production

### 1. Version Déployée Non à Jour
- Les logs ont été ajoutés
- Le code source peut ne pas être synchronisé
- **Solution**: Redéployer avec `vercel deploy --prod`

### 2. Cache du Navigateur
- Le JavaScript ancien est en cache
- **Solution**: 
  - Vider le cache (Ctrl+Shift+Del)
  - Ou: Ctrl+F5 (hard refresh)

### 3. Problème de Compilation
- La build peut avoir échoué silencieusement
- **Solution**:
  - Vérifier les logs de build Vercel
  - Vérifier que le fichier `planning/page.tsx` est présent

### 4. Problème d'Import
- Les dépendances peut-être mal importées
- **Solution**:
  - Vérifier que tous les imports sont corrects
  - Vérifier que les composants UI existent

---

## ✅ Code Vérifié

### État selectedCell
- ✅ Déclaré ligne 58
- ✅ Type correct: `{ row: string; day: string } | null`
- ✅ Utilisé dans le rendu de la modale

### Cellules cliquables
- ✅ `onClick={() => !isBlocked && handleCellClick(rowKey, day)}`
- ✅ Propriété `cursor-pointer` quand non bloquée
- ✅ Propriété `cursor-not-allowed` quand bloquée

### Fonction isCellBlocked
- ✅ Vérifie le week-end
- ✅ Vérifie les lignes spécifiques (RÉEDUCATION, PSSL, etc.)
- ✅ Retourne false pour "Astreintes ATL" et "Garde"

### Modale Dialog
- ✅ Rendue conditionnellement: `{selectedCell && <Dialog>...}</Dialog>`
- ✅ Affiche les informations correctes
- ✅ Se ferme au clic sur X ou "Fermer"

---

## 🚀 Prochaines Étapes

1. **En production**: 
   - Ouvrir la console (F12)
   - Cliquer sur une cellule
   - Vérifier les logs `🔍 handleCellClick`

2. **Si rien n'apparaît**:
   - Hard refresh (Ctrl+F5)
   - Vider le cache
   - Redéployer avec `vercel deploy --prod`

3. **Si toujours pas de résultat**:
   - Vérifier les logs de build Vercel
   - Vérifier le code source déployé
   - Comparer avec le code local

---

## 📝 Résumé

- ✅ **Local**: Fonctionne parfaitement
- ✅ **Code**: Vérifié et sans erreur
- ✅ **Logs**: Ajoutés pour le debugging
- 🚀 **Production**: À tester avec les logs

