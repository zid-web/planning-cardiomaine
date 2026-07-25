# Plan de tests utilisateurs — Cardiomaine Planning

## Objectif

Recueillir des retours qualitatifs et quantitatifs après mise en production, pour prioriser les itérations (UX, perf, bugs).

## Groupe de test (recommandé)

| Profil | Nombre | Scénarios clés |
|--------|--------|----------------|
| Admin planning (M/Z) | 1–2 | Édition grille, solveur, PDF, historique, demandes, comptes |
| Médecin | 1–2 | Lecture, demande de changement, feedback |

Durée suggérée : **1–2 semaines** d’usage réel + 1 session visio d’observation (30–45 min).

## Scénarios à faire exécuter

1. Se connecter et ouvrir la semaine courante (onglet Planning global).
2. Modifier une cellule (admin) → vérifier après F5.
3. Exporter PDF.
4. (Admin) Lancer « Générer avec Solveur » une fois le matin (après keep-alive) et noter le délai ressenti.
5. (Médecin) Demander un changement depuis une cellule.
6. (Admin) Approuver/rejeter dans `/protected/admin/requests`.
7. Envoyer un feedback via le bouton flottant (bas-droite).

## Collecte des retours

### In-app (livré)

- Bouton **Feedback** (bas-droite) → enregistrement table `app_feedback`.
- Consultation admin : `/protected/admin/feedback`.

### Formulaire externe (optionnel)

Dupliquer ces questions dans Google Forms si besoin d’anonymat :

1. Facilité d’utilisation (1–5)
2. Vitesse de chargement perçue (1–5)
3. Utilité des fonctionnalités principales (1–5)
4. Bugs rencontrés (texte)
5. Amélioration prioritaire (texte)

### Session observée

- Noter hésitations, clics inutiles, temps pour « Demander un changement ».
- Capturer si le cold start solveur est encore perçu malgré le cron.

## Critères de succès (première itération)

- ≥ 80 % des testeurs notent facilité ≥ 3/5
- Aucun bug bloquant login / sauvegarde cellule
- Solveur « ressenti » < 15 s la plupart du temps (après warm)
- Au moins 5 feedbacks in-app collectés

## Itération

1. Exporter / lire `/protected/admin/feedback`
2. Trier : bugs > perf > UX > features
3. Ouvrir issues / PRs ciblées
4. Re-tester avec le même groupe
