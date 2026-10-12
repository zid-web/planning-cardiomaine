# Règles et contraintes de l'application — condensé

Légende : **S** = envoyée au solveur dans `app_rules` (`lib/solver-rules.ts`) et appliquée par lui
(`app_rules.py`) ; **A** = appliquée par l'appli après le solveur (`lib/clinical-priority.ts`,
`lib/apply-structural-constraints.ts`, `lib/slot-blocking.ts`) — garantie finale.

## Disponibilité
- Congés, vacations, congrès : aucune affectation (S+A).
- Jour férié : tout fermé sauf Astreintes ATL et Gardes (S souple + A).
- Salle de coro / activités en maintenance : créneaux fermés (S via `room_maintenance` / `activity_maintenance`).
- NCT : ouverte uniquement aux dates du calendrier NCT (S+A).

## Gardes et astreintes
- Jamais deux nuits consécutives pour un médecin, y compris dimanche → lundi (S+A).
- Après une garde de nuit : demi-journée off le lendemain, pas de Coro / ATL / Rythmo (S+A).
- Vendredi nuit : tout le monde sauf O, W, M (B, G, A, P, Z, H, S, U), à égalité sur 26 semaines (S+A). L'interne I : Garde Matin uniquement (S+A).
- Préférences par jour (lun U, mar G/B/M/W, mer S/P (à égalité ; S cumule garde et ETT pédiatrique), jeu O/G) (S).
- Week-end : remplaçant seul possible sans médecin associé (A) ; roulement CH / W-O-M (solveur).

## Coronarographistes M, O, W
- Si les trois sont présents un jour : **chacun une seule vacation** (Coro matin, Coro après-midi ou nuit) (S souple `coro_one_each_per_day` + A).
- Coro d'abord pour M/O/W (S+A) ; jeudi après-midi : FV. ATL Matin/Midi suit Coro.
- O : jamais d'ETT (S+A).

## Échographies, consultations, Stress
- Groupe écho H, Z, G, B, S : ETT / Stress / Rééduc avant les Cs (S+A) ; Cs remplies par les médecins sans tâche principale.
- Stress : un médecin au plus une fois par semaine, rotation, si assez de médecins disponibles (S+A).
- Pré-op : un médecin différent chaque jour (S+A).
- Cs PSS exclu pour U/B/S ; Cs Tessée selon éligibilités DOC022 (S via `rules_override`).

## Entrées PSS
- Lundi, mardi : médecin de Garde Midi + un autre médecin ; mercredi → vendredi : Garde Midi seul (S+A).

## EE et infirmières
- Seuls O, V, DAAS occupent EE sans infirmière (Val / Véro) (S+A).
- Un seul médecin par infirmière, identique sur EE1 et EE2 (S+A).

## Hors site
- Cases librement modifiables ; propositions seulement les jours habituels : CDL mardi, LFB/PSSL jeudi, IRM lundi/vendredi, Scinti lundi–mercredi (S+A). Cases grisées hors jours d'affectation.

## Saisies de l'admin
- Cases validées conservées, cases vidées volontairement non remplies (S+A).
