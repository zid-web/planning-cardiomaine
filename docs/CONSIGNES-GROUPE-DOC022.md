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
- **Visite** rotation U → A → B (1 semaine / 3) — **désignable** avant Générer (`visite_doctor`)
- **LFB** jeudi rotation **H → S → G** (1/3) — **désignable** (`lfb_doctor`) ; ancien pool B/Z/A abandonné
- **PSSL** : B jeudi / Z mardi — cases à cocher avant Générer (`pssl_b_active` / `pssl_z_active`)
- **CORO** W/M/O/FV ; **ATL** M/O/W/CH + **FV Midi jeudi seulement** (= Coro) ; **Rythmo** A/U/P (calendrier impair/pair — voir ci-dessous) ; **NCT** M/W ; **Rééducation** Z/B/S/G/H (+R/K mercredi)
- **DAAS** Apm EE2 lundi ; **FV** garde nuit lundi + coro jeudi apm

### Rythmo (parité semaine ISO)

| | Impaire | Paire |
|--|---------|-------|
| A | Lun + Jeu apm | Lun + Jeu apm |
| P | Mar matin + apm | Mar matin + apm |
| U | Mer apm + **Ven apm** | Mer **matin + apm** |
| Ven matin | — | Alternance **U / P** (parmi les semaines paires) |

### Weekend Garde / ATL

- Sam Garde Matin = Ven Garde Nuit (+ associé Sam Midi/Nuit)
- Sam Garde Midi = Nuit (un médecin) ; Dim Garde Matin = Midi = Nuit (un médecin)
- Sam/Dim ATL Matin = Midi = Nuit (un médecin / jour)
- Lun–Ven ATL Matin/Midi = Coro matin/apm

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

- **Éligibilités cliniques** (`clinical_eligibility`) : **W n’est pas éligible au Stress** (EDS).

## Soft / hors génération forcée (sites externes)

- La Ferté Bernard ~1 jeudi/mois : H, U, G, S  
- Pôle santé Sarthe Loir ~2 jeudis/mois : B, Z  
- CH Château-du-Loir mardi matin : O (parfois V)  
- NCT+ : calendrier M/W  

Ces fréquences restent soft (historique / calendrier NCT) — pas forcées chaque semaine.

## Backend

Patches à appliquer sur `guard-api-cardiomaine` (Cursor ne peut pas y pusher) :

1. `patches/guard-api-astreinte-coronarographistes.patch` — ATL pool = M/O/W/CH (FV ATL = jeudi Midi via front / Coro, pas vars globales)
1b. `patches/guard-api-atl-coro-slot-exclusivity.patch` — exclusivité créneau : ne pas compter ASTREINTE+CORO pour M/O/W  
2. `patches/guard-api-weekend-garde-atl-rythmo.patch` — couplages weekend Garde/ATL + calendrier Rythmo impair/pair  

Sans ces patches, le front applique déjà les règles à l’affichage / après Générer.

## Hors scope solveur planning

Durées de rdv cs (20/30 min), plages horaires cabinet précises (8h30–11h30…) : logique **agenda patient**, pas grille hebdo gardes/vacations.
