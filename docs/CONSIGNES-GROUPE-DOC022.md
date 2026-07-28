# Consignes groupe Cardiomaine (DOC022)

Source : PDF scanné « fonctionnement / répartition des tâches » (7 pages), OCR Cursor 2026-07-28.  
Fichier agent : uploads `DOC022_*.pdf`. Encodage machine : `lib/group-clinical-rules.ts`.

## Identités (code planning → médecin)

| Code | Médecin |
|------|---------|
| A | Amirault |
| H | Bachelet |
| W | Ben Amara |
| B | Braun |
| O | Bros |
| T | Cloitre |
| Z | Denizet |
| K | Dericbourg |
| U | Kabalu |
| V | Lefebvre |
| P | Poret |
| R | Rousseau |
| G | Terrien |
| S | Saint André |
| M | Zid |

## Déjà couvert (aligné DOC022 ↔ code actuel)

- **½-off** mercredi apm M/W/G/Z/H/B ; mardi apm S ; jeudi apm U/P ; vendredi apm O/A/… ; récupération après garde nuit
- **IRM** S lundi matin + vendredi apm
- **Visite** rotation U → A → B (1 semaine / 3)
- **CORO** W/M/O/FV ; **Rythmo** A/U/P ; **NCT** M/W ; **Rééducation** Z/B/S/G/H (+R/K mercredi)
- **DAAS** Apm EE2 lundi ; **FV** garde nuit lundi + coro jeudi apm

## Ajouté depuis DOC022 (cette itération)

Créneaux fixes injectés via `applyFixedClinicalAssignments` :

| Ligne | Jour | Médecin | Motif DOC022 |
|-------|------|---------|--------------|
| Matin - ETT salle 1 | Lundi | P | ECHO1 réservé Poret |
| Apm - ETT salle 1 | Mercredi | S | Écho enfants Saint André |
| Matin - EE2 | Lundi | V | EE2 matin Lefebvre |
| Matin - EE2 | Vendredi | O | EE2 matin Bros |
| Hors site - Scinti | Lun / Mer | T | Scinti Cloitre |
| Hors site - Scinti | Mardi | R | Scinti Rousseau |

Éligibilités cliniques (`clinical_eligibility`) envoyées en `rules_override` à `/generate-week` pour guider le solveur / Claude.

## Soft / hors génération forcée (sites externes)

- La Ferté Bernard ~1 jeudi/mois : H, U, G, S  
- Pôle santé Sarthe Loir ~2 jeudis/mois : B, Z  
- CH Château-du-Loir mardi matin : O (parfois V)  
- NCT+ : calendrier M/W  

Ces fréquences restent soft (historique / calendrier NCT) — pas forcées chaque semaine.

## Backend

Patch optionnel : `patches/guard-api-rules-doc022.patch` / JSON `patches/rules_config-doc022-addon.json`  
à merger dans `guard-api-cardiomaine` `rules_config.json` + consommation de `doc022_fixed_slots` / `clinical_eligibility` si absente.

## Hors scope solveur planning

Durées de rdv cs (20/30 min), plages horaires cabinet précises (8h30–11h30…) : logique **agenda patient**, pas grille hebdo gardes/vacations.
