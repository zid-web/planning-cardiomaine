# Checklist de Déploiement - Gestion des Vacances

## ✅ Avant le déploiement

### 1. Configuration Supabase

- [ ] Ouvrir le dashboard Supabase
- [ ] Sélectionner le projet `planning-cardiomaine`
- [ ] Aller dans SQL Editor
- [ ] Créer une New Query
- [ ] Copier le contenu de `vacations.sql`
- [ ] Exécuter la requête (Run button)
- [ ] Vérifier le message de succès "✓ SUCCESS"

### 2. Vérification du code

- [ ] S'assurer que le code est compilé sans erreurs (`npm run build`)
- [ ] Vérifier que tous les imports sont corrects
- [ ] Vérifier que les fichiers créés existent:
  - [ ] `lib/vacation-utils.ts`
  - [ ] `lib/vacation-converter.ts`
  - [ ] `app/actions/vacation-actions.ts`
  - [ ] `app/actions/guard-generation-actions.ts`
  - [ ] `components/vacations-modal.tsx`
  - [ ] `components/vacations-button.tsx`
  - [ ] `components/vacations-badge.tsx`

### 3. Tests locaux

- [ ] Lancer le serveur de développement (`npm run dev`)
- [ ] Ouvrir l'application (http://localhost:3000)
- [ ] Se connecter comme administrateur
- [ ] Cliquer sur le bouton "✈️ Vacances"
- [ ] Vérifier que la modale s'ouvre correctement
- [ ] Ajouter une vacation test:
  - [ ] Remplir dates
  - [ ] Ajouter raison
  - [ ] Cliquer "Ajouter les vacances"
  - [ ] Vérifier que la vacation apparaît dans la liste
- [ ] Tester la suppression:
  - [ ] Cliquer "Supprimer"
  - [ ] Confirmer la suppression
  - [ ] Vérifier que la vacation disparaît
- [ ] Générer les gardes:
  - [ ] Ajouter une vacation pour un médecin
  - [ ] Cliquer "Générer Gardes Nuit"
  - [ ] Vérifier que le médecin en vacation n'est pas assigné
  - [ ] Vérifier que les gardes sont générées pour les autres

### 4. Tests de validation

- [ ] Tenter d'ajouter une vacation sans dates
  - [ ] Vérifier le message d'erreur
- [ ] Tenter d'ajouter une vacation avec fin < début
  - [ ] Vérifier le message d'erreur
- [ ] Ajouter deux vacations qui se chevauchent
  - [ ] Vérifier qu'une erreur de UNIQUE constraint apparaît
- [ ] Charger la page et vérifier que les vacations persistent

### 5. Tests de performance

- [ ] Ajouter 10+ vacations
- [ ] Générer les gardes
- [ ] Vérifier que la génération est rapide (< 5s)
- [ ] Vérifier qu'il n'y a pas de fuites mémoire

## 🚀 Déploiement

### 1. Commit et push

```bash
git add .
git commit -m "feat: Add comprehensive vacation management system

- Create doctor_vacations table with RLS
- Add vacation CRUD operations
- Integrate vacations into guard generation algorithm
- Create UI components (modal, button, badge)
- Automatic exclusion of doctors on vacation
- Maintain guard distribution fairness"

git push origin v0/ouassim34-8666-4f590a10
```

### 2. Vérifications finales avant merge

- [ ] Code review approuvé
- [ ] Tests passent
- [ ] Build réussit
- [ ] Aucune warning TypeScript

### 3. Déploiement Vercel

- [ ] Créer une Pull Request depuis GitHub
- [ ] Attendre le build Vercel
- [ ] Vérifier le preview URL
- [ ] Tester sur le preview
- [ ] Merger la PR
- [ ] Vérifier que le déploiement prod est réussi

## ✅ Après le déploiement

### 1. Vérification en production

- [ ] Ouvrir l'application de production
- [ ] Se connecter comme administrateur
- [ ] Tester le bouton "✈️ Vacances"
- [ ] Ajouter une vacation
- [ ] Générer les gardes
- [ ] Vérifier que tout fonctionne

### 2. Documentation et formation

- [ ] Lire le `VACATIONS_GUIDE.md`
- [ ] Former les administrateurs
- [ ] Créer un tutoriel vidéo (optionnel)
- [ ] Ajouter le guide dans la documentation générale

### 3. Monitoring

- [ ] Configurer des logs dans Sentry/Vercel
- [ ] Surveiller les erreurs potentielles
- [ ] Recueillir les retours des utilisateurs

## 📋 Fichiers à archiver/documenter

- [ ] `VACATIONS_GUIDE.md` - Guide utilisateur (à partager)
- [ ] `VACATIONS_IMPLEMENTATION_SUMMARY.md` - Résumé technique (à archiver)
- [ ] `vacations.sql` - Script SQL (à sauvegarder)
- [ ] Cette checklist - `VACATIONS_DEPLOYMENT_CHECKLIST.md`

## 🔄 Rollback plan

Si quelque chose ne fonctionne pas:

1. Identifier le problème en lisant les logs
2. Options:
   - **Bug simple:** Fix et redéployer
   - **Problème DB:** Vérifier les RLS policies
   - **Régression:** Revert le commit et redéployer

Commandes de rollback:
```bash
# Revert le dernier commit
git revert HEAD
git push

# Ou forcer un revert sur main
git revert --no-commit <commit-hash>
git commit -m "Revert vacation feature"
git push
```

## 📞 Support

En cas de problème:
1. Consulter `VACATIONS_GUIDE.md`
2. Vérifier les logs Vercel/Supabase
3. Vérifier que la table `doctor_vacations` existe
4. Vérifier les RLS policies
5. Contacter le développeur

## ✅ Checklist complétée

- [ ] Tous les éléments ci-dessus sont cochés
- [ ] Prêt pour le déploiement en production
- [ ] Date du déploiement: _______________
- [ ] Personne responsable: _______________
- [ ] Numéro de version: _______________

---

**Dernier déploiement:** _______________  
**Statut:** ☐ En cours ☐ Réussi ☐ Échoué  
**Notes:** _________________________________
