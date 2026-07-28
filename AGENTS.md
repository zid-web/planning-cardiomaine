# AGENTS.md

## Cursor Cloud specific instructions

Next.js 16 (App Router, React 19) + Supabase app ("Cardiomaine Planning", a French
medical shift-scheduling tool). Package manager is **bun** (`bun.lock`). The single
required service is the Next.js dev server; the backend is Supabase.

### Backend Render (IMPORTANT — ne pas confondre)
- Le **vrai** solveur / API est le dépôt séparé **`github.com/zid-web/guard-api-cardiomaine`** (Render `guard-api-cardiomaine.onrender.com`).
- Le dossier `guard-api/` dans **ce** repo (`planning-cardiomaine`) est un **résidu** : uniquement un `README.md` de redirection. **Ne pas** y remettre un miroir `solver.py` / patches / `rules_config.json` — source de confusion. Toute évolution backend = PR / push sur `guard-api-cardiomaine` uniquement.
- Correctifs RYTHMO (créneaux précis + vendredi P/U selon `week_type`) + allowlist `historical_patterns` + `half_days_off` : **déjà fusionnés** dans `guard-api-cardiomaine` (Claude + Cursor). Ne pas les retravailler ici.

### Garde Nuit proposals / preferences
- `generateNightGuardProposals` (`lib/guard-scheduler.ts`) : Mar–Dim (+ Lun si FV vacances). Préférences : Lun→U, Mar→M/W, Mer→S/U/P, Jeu→O/G, Ven→rotation B/G/A/P/Z/H/S (O/W/M exclus). Pas de garde la veille d’un NCT pour le médecin NCT (W/M, calendrier `NCT_DATES_2026`). Miroir soft/hard dans **`guard-api-cardiomaine`** (`NIGHT_GARDE_*` / règles JSON).

### Fixed clinical assignments & remplacant
- Règles fixes centralisées dans `lib/fixed-assignments.ts` (`applyFixedClinicalAssignments`) : **IRM = S** (Lundi matin + Vendredi après-midi), **FV** Garde Nuit Lundi + Coro Jeudi apm, **DAAS** = `Apm - EE2` Lundi, **Rythmo** front = P mardi (matin+apm), U mercredi apm, A lundi/jeudi apm ; le solveur ajoute aussi **vendredi** P matin (semaine impaire) / U am (paire). **Visite** = rotation `U → A → B`. **Si le titulaire est en congés, la contrainte saute** : case libre, pas de réinjection, couverture manuelle (ex. **P** mercredi si U absent) conservée. `getAllVacations` doit échouer proprement (pas `[]` silencieux) pour ne pas écraser Congés/Rythmo.
- **Remplaçant texte libre** : dans la modale d’affectation admin, champ « Remplaçant » → ajoute un libellé dans `cell.value` (badge ambre). Utiliser `isListedDoctor` / `normalizeRemplacantLabel` (`lib/doctor-code.ts`) — hors équité / hors contrôle vacances.

### Vues Aujourd’hui / Semaine
- UI moderne dans `components/today-view.tsx` et `components/week-view.tsx` (montées par `ScheduleApp`).
- **Notes du jour** (onglet Aujourd’hui) : carte cliquable → modale texte → `saveScheduleToDb` via `updateSchedule` sur la ligne `Notes du jour`.
- Toolbar admin : **Journal** = audit `schedule_history` (qui a changé quoi). Boutons outline : forcer `!text-slate-900` + fond blanc (sinon icônes transparentes).
- **Pages admin** (`/protected/admin/users|requests|feedback`) : le layout racine est `overflow-hidden` — chaque page doit scroller avec `h-full overflow-y-auto` (sinon liste tronquée / emails invisibles).
- **Couleurs / modales** : dans `app/globals.css`, les tokens doivent être des couleurs CSS complètes (`hsl(...)`), pas des triplets HSL nus — sinon `bg-card` / `bg-background` → transparent (Notes du jour, Cards). Dialogs/Cards/Textarea : préférer `bg-white text-slate-900` en secours.

### Congés (ligne unique absences)
- Une seule ligne UI **Congés** (plus de ligne « Vacances »). `normalizeLeaveSchedule` (`lib/vacation-congés-mapper.ts`) : fusion legacy Vacances→Congés, remplissage depuis `doctor_vacations`, puis **retrait des absents de toutes les autres lignes** (y compris `1/2 journée off Matin/Après-midi`).
- `resolveRowKey` mappe `VACANCES` et `CONGE` → `Congés`. `detectConflict` / `canAssignDoctor` n’appliquent pas le rouge conflit sur la ligne Congés — badges = `DOCTOR_COLORS`.
- Solveur Render : n’émettre que `CONGE` (dans **`guard-api-cardiomaine`**, pas le dossier local).
- Header admin **Congé** → `VacationsModal` : liste complète `doctor_vacations` (filtre médecin) + ajout / modification / suppression (`vacation-actions.ts`). Refresh via `onVacationsUpdated` → `loadVacations` dans `ScheduleApp`.
- `populateCongesRowFromVacations` reconstruit la ligne **Congés** depuis `doctor_vacations` (ajout **et** retrait). Modifier/supprimer des dates se répercute immédiatement sur le planning affiché ; persistance `source: "constraints"` sur les semaines déjà en mémoire (~150 ms).
- **Écriture congés** : `addVacation` / `updateVacation` n’écrivent que `doctor_id` + dates ; le motif `reason` est patché en best-effort (projets Supabase sans colonne → erreur PostgREST « schema cache »). Migration `20250726000000_doctor_vacations_reason_column.sql` pour l’ajouter côté SQL.

### 1/2 journée off après Garde Nuit
- Règle (`lib/half-day-off.ts`) : après Garde Nuit → **apm du lendemain** (sauf **samedi**). Si off **habituel** apm → **matin**. **À chaque modification** de Garde Nuit : reconstruit ½ off matin+apm du lendemain. Dimanche → lundi semaine suivante.
- **½ off habituels** (alignés `rules_config.json` de **guard-api-cardiomaine**) : Lundi matin `R,K` + am `K` ; Mardi am `S` ; Mercredi am `M,W,G,Z,H,B` ; Jeudi am `U,P` ; Vendredi matin `K` + am `O,A,K,R,T`.

### Contraintes structurelles vs « Générer »
- **Toujours injectées** (sans Générer) via `applyStructuralConstraints` (`lib/apply-structural-constraints.ts`) : IRM/FV/DAAS/Rythmo/Visite, ½-off habituelles, récupération garde nuit, Congés + strip absents, NCT calendrier, LFB, **CH**, **ATL←Coro**. Appliqué à l’affichage + persisté (`source: "constraints"`, debounce).
- **Blocages assignation** (`lib/slot-blocking.ts`) : jamais de médecin en congés hors ligne Congés ; ½-off Matin ⇒ pas d’activité matin ; ½-off Apm ⇒ pas d’activité apm ; 1 tâche / créneau matin|apm (sauf **ATL+Coro**, **ETT salle1+salle2**, **EE1+EE2**, et **Garde Matin + I** → Cs/ETT/EE matin autorisés, pas Coro/Rythmo/Rééducation) ; **pas** de cumul Cs PSS+Tessée ; **LFB/CDL** interdits jour de garde + lendemain. **Doublon** : Cs = 2× dans la **même** case → `B²` ; **ETT** et **EE** = les **deux salles** du créneau → `S²` / `G²`. **Interne I** : Garde Matin uniquement ; **S+I** peut aussi rester sur IRM. **CH** : astreintes ATL uniquement — **jamais** Garde Matin/Midi/Nuit. **Garde week-end + remplaçant** : toujours autoriser l’association avec un médecin listé (merge solveur préserve le remplacant). UI : `canAssignDoctor(..., { schedule, day })` + `applySlotBlockingStrips`.
- **Astreintes ATL** :
  - **Lun–Ven Matin/Midi** : même médecin que `Matin - Coro` / `Apm - Coro` (`applyAtlFollowsCoroConstraints` + solveur §5quater).
  - **Nuits + weekend** (cycle 2 sem., `week_type` 1=impaire / 2=paire) : **impaire** = CH Lun/Mar/Ven nuit + weekend ATL entier ; W/O/M = Mer/Jeu nuit. **paire** = W/O/M Lun/Mar/Ven nuit + weekend ATL ; CH = Mer/Jeu nuit. Weekend `ASTREINTE` mappe vers **Astreintes ATL Matin** (pas Garde).
  - **Pas de nuits ATL consécutives Lun–Ven** pour W/O/M (weekend et CH exempts) — solveur §5quinquies ; dérogation = saisie admin / `existing_schedule`.
  - `generateGuardsViaAPI` dérive `week_type` du n° de semaine ISO (ne plus laisser le défaut 1).
- **« Générer »** = **propositions** `pending` (gardes/astreintes WOM/Coro/…) à valider admin. Lignes : `GENERATOR_PROPOSAL_ROW_KEYS`. **UI** : cases violet + badge `Prop.` (`isSolverProposalCell`) — distinct des fixes/`validated` et des demandes de changement (orange).
- Congés CRUD : **ne pas** `revalidatePath('/protected/planning')` pendant la modale (course / faux positif « message channel closed »). Refresh via `onVacationsUpdated` + `getAllVacations` (`noStore`).
- Do **not** reintroduce `generateWeekWithSolver` / second bouton solveur.
- **Equity / CellData:** `{ value: string[], status, type? }` + row key. Use `lib/equity-tracking.ts`. **Fenêtre glissante 6 mois** pour toutes les catégories (`getCumulativeEquityFromTable` + repli JSON + `getCoroEquity` / `points_coro`) — pas « depuis toujours », pas « mois calendaire » pour CORO. Recalculée à chaque Générer ; pas de changement de schéma DB.

### Run / build / lint
- Dev server: `bun run dev` → http://localhost:3000 (this is the app; use dev, not `build`/`start`).
- Build: `bun run build` (note: `next.config.js` sets `typescript.ignoreBuildErrors: true`, so TS errors do not fail the build).
- Lint: `bun run lint` works (flat config in `eslint.config.mjs`). It is configured to exit 0 with warnings only; several noisy/pre-existing rules (incl. React Compiler rules from `react-hooks` v6) are set to `warn` on purpose.
- Standard commands are also in `README.md` and `QUICK_REFERENCE.md`.
- Roadmap options G1–G7: see `docs/PLAN-OPTIONS-G1-G7.md`. Prefer implementing through `ScheduleApp` + `schedule-actions.ts`; do not rebuild planning in `page.tsx`.
- Production go-live checklist (Vercel env vars, migrations, smoke tests): `docs/PRODUCTION_CHECKLIST.md`. Prefer `console.error`/`warn` only — avoid reintroducing `[v0]` debug `console.log`s.
- Performance / monitoring: `docs/PERFORMANCE.md` (Render keep-alive cron `/api/ping-solver`, SWR on planning, solver cache, Speed Insights). User testing: `docs/USER_TESTING_PLAN.md` + in-app Feedback → `app_feedback` / `/protected/admin/feedback`.
- **Vercel / v0 URLs:** Stable Production alias for keep-alive: `https://v0-recreate-attached-ui-zids-projects-22b662f4.vercel.app/api/ping-solver` (public JSON). Do **not** use old hashed deploy URLs like `…-p2ci9kbnq-…` — they are immutable snapshots and may still redirect to `/auth/login`. Hobby-safe daily cron only in `vercel.json`; use external 5–10 min ping for Render warmth.
- **G1–G3 shipped pattern:** PDF export is **client-side** (`downloadPlanningPdf` / `lib/planning-pdf.ts`) to avoid Vercel **413** on `GET /api/export-planning-pdf` (oversized Supabase auth cookies). The API route remains as fallback. PDF **import** via `/api/upload-pdf` is capped ~4 Mo (Vercel body limit). All week writes go through `saveScheduleToDb` (increments `version`, writes `schedule_history`, syncs `full_schedule` blob). Realtime: `schedules` is in `supabase_realtime` — `ScheduleApp` subscribes for admins and ignores own `updated_by` + the `full_schedule` blob key. After `supabase db reset`, recreate local test users (admin/doctor).
- **G4:** CSV/XLSX import in `VoiceAndUploadPanel` (local parse via `lib/planning-import.ts` → `mapped_existing_schedule`). Sample: `fixtures/sample-planning-import.csv`.
- **G5:** `/protected/admin/users` uses Server Actions + `SUPABASE_SERVICE_ROLE_KEY` (`lib/supabase/admin.ts`). Set that env var on Vercel; never expose it to the client.

### Roles & API gotchas
- `/protected/planning` is a thin loader that renders **`ScheduleApp`** (`components/schedule-app.tsx`). Do not reintroduce a full planning implementation in `app/protected/planning/page.tsx`. Change requests, voice/PDF panel, solver persistence, and grid editing live in `ScheduleApp`. Guard generation sends `previous_sunday_guard_doctor` via `getLastSundayGuardDoctor` in `app/actions/guard-api-actions.ts`.
- `profiles.role` defaults to `'admin'` (init migration), so brand-new users are admins. The planning page treats `role === 'admin'` as admin (direct grid editing + change-request approval panel); any other role is a "doctor" who can only submit change requests. To test the doctor flow, set a user's `role` to something else (e.g. `UPDATE profiles SET role='doctor' WHERE ...`).
- **Admin hors planning (Lucie = L)** : `luciecardiomaine@gmail.com` → `profiles.role=admin` + `doctor_code=L`. **Pas** dans `DOCTORS` (aucune tâche médicale). Édition grille des autres médecins OK. Saisies auto-`validated` via `adminEditsAreValidated` (`lib/staff-admin.ts`). Créer/maj : `bun scripts/ensure-staff-admins.ts` (service role) ou `/protected/admin/users`.
- Admin change-requests UI lives at **`/protected/admin/requests`** (`app/protected/admin/requests/page.tsx`): filters (status / date range / requester / requested doctor), pagination (20/page, `count: 'exact'` + `range`), full history (all statuses), detail modal with reject comment, and **Supabase Realtime** (`INSERT` on `change_requests` → toast + badge + list refresh). Migration `20250204000000_enable_realtime_change_requests.sql` adds the table to `supabase_realtime` (do not drop that publication). Approve/reject stays in `app/actions/change-request-actions.ts`. The old path `/protected/change-requests` is a thin `redirect()` only — do not reintroduce a full page there. **Emails demandeurs** : chargés via requête `profiles` séparée (pas d’embed `profiles(email)` — 400 PostgREST si FK absente en prod).
- Route protection lives in root **`proxy.ts`** (Next.js 16; replaces `middleware.ts`). It uses Supabase SSR `getUser()` (not a raw cookie name check). Public: `/`, `/auth/login`, `/auth/sign-up`, `/auth/forgot-password`. Unauthenticated `/api/*` redirects to login — use a session for voice/PDF proxies.
- `/api/voice-command` and `/api/upload-pdf` are **proxies** to the Render guard API (`GUARD_API_BASE_URL` or fallback `GUARD_API_URL`, default `https://guard-api-cardiomaine.onrender.com`), optionally with `GUARD_API_KEY` (`x-api-key` header + `x_api_key` query). **PDF upload** goes **direct browser → Render** (`lib/pdf-upload-client.ts`) to avoid Vercel **504** on multi-page Claude Vision (1–3 min); `/api/upload-pdf` is fallback only (`maxDuration = 60`). Voice still uses the Next proxy. Prefer the stable Production alias, not preview `…-dpl_…` / hashed URLs.
- Voice payload expected by Render (built in `VoiceAndUploadPanel` / `lib/guard-api-mapping.ts`): `{ text, reference_date, known_doctors, current_week_request }` where `current_week_request` matches `/generate-week` (`week_start_date`, `week_type`, `medecins`, …). Response is applied via `parsed_command` (surgical cell update), not the old local `{ operations: [...] }` shape. PDF response uses `raw_extraction.rows` / `mapped_existing_schedule` (keys like `Garde Nuit||LUNDI`). Set `GUARD_API_BASE_URL` + `GUARD_API_KEY` on Vercel when needed.
- **Voice `doctor_in=null` :** Claude renvoie parfois `doctor_in: null` → ValidationError Pydantic sur Render (`ParsedCommand.doctor_in`). Correctif backend : patch `patches/guard-api-voice-doctor-in-null.patch` à appliquer sur **`guard-api-cardiomaine`** (`voice_command.py` — normalise depuis `doctor_out`, message clair). Côté front : repli `lib/voice-local-parse.ts` dans `VoiceAndUploadPanel` si l’erreur Pydantic remonte, pour quand même appliquer les consignes simples.
- **Voice mic (Web Speech) :** helpers in `lib/speech-recognition.ts`. Requires **Chrome/Edge + HTTPS** (or localhost) + micro autorisé. Le panneau demande `getUserMedia` avant `SpeechRecognition.start()`, affiche les erreurs (`not-allowed`, etc.), écoute en `continuous`, et garde le textarea visible pendant la dictée. Saisie manuelle + **Appliquer** reste le fallback. Après apply : si `parsed_command` ne modifie rien, fallback `mergeAssignmentsIntoSchedule(..., { proposalRowsOnly: false })` ; date hors semaine affichée → écriture sur la bonne `week_key`.
- **NCT dictée / saisie :** `resolveRowKey` mappe **toute** combinaison `*/NCT` → `Hors site - NCT` (Claude renvoie souvent `matin/NCT`). Une liste multi-dates (`2026-09-10 → M`) est détectée localement (`lib/nct-command.ts`) et appliquée sur les semaines concernées sans passer par Render. Évolutions prompt voice = **`guard-api-cardiomaine`** uniquement.
- **Import historique multi-semaines :** PDF avec `weeks[]` → `HistoryImportDialog` (review admin) → `commitHistoryImport` (`lib/history-import.ts` + `app/actions/import-history-actions.ts`). Ne remplit que cellules vides, ignore OCR `confidence: low`.
- **« Générer » (une seule passe) :** `generateGuardsViaAPI` calcule `historical_patterns` via `buildHistoricalPatternsPayload` (`lib/pattern-analysis.ts`, **allowlist** Cs/ETT/EE/Stress — `isSolverHistoricalRowKey`). Le solveur **`guard-api-cardiomaine`** applique la même allowlist + Rythmo précis (`rythmo_slots`, vendredi P/U) et émet aussi les hors site via `HORSSITE::*`. Côté front, `resolveRowKey` mappe les activités `HIST`/`HORSSITE` (suffixes `Cs PSS`, `CDL`, …) vers les row keys ; `GENERATOR_PROPOSAL_ROW_KEYS` inclut Cs/ETT/EE/Stress + hors site (sauf NCT calendrier) → cellules **pending** / violet « Prop. » à valider. NCT / Rythmo fixe / ½-off restent structurels `validated`.
- **PDF « JSON malformé »** : root cause dans **`guard-api-cardiomaine`** (`pdf_upload.py` / `llm_json.py`), pas le proxy Next. Corriger uniquement dans ce dépôt.

### Supabase backend (important auth caveat)
- Committed `.env` points at a hosted Supabase project. The client (`lib/supabase/client.ts`) hardcodes the same values as a fallback.
- The hosted project has email confirmation ON (`mailer_autoconfirm=false`) and no seeded/test accounts, so you **cannot** self-signup and log in without access to the confirmation email. The documented sample accounts (e.g. `marie@cardiomaine.fr`) do **not** exist in that project.
- All protected pages require login (`proxy.ts` gates everything except `/`, `/auth/login`, `/auth/sign-up`, `/auth/forgot-password`).

### Running a local Supabase for end-to-end testing (no real account needed)
Requires Docker + the Supabase CLI installed in the VM (not part of the update script). To exercise login + the protected planning grid autonomously:
1. `supabase start` (a committed `supabase/config.toml` already exists). Migrations in `supabase/migrations/` are now aligned with the app code — `20240101000000_init_schema.sql` creates the `profiles` (with `role` + `must_change_password`), `week_key`-based `schedules`, `doctor_vacations`, `planning_notes`, `doctors`, `settings`, `congres`, and equity tables, with permissive RLS and the required role GRANTs. Use `supabase db reset` to re-apply from scratch.
2. Create a confirmed user via the admin API (service_role key from `supabase start` output):
   `POST http://127.0.0.1:54321/auth/v1/admin/users` with `{"email":"admin@cardiomaine.fr","password":"Admin123!","email_confirm":true,"user_metadata":{"first_name":"Marie","last_name":"Martin"}}`. The `on_auth_user_created` trigger auto-creates a `profiles` row (default `role='admin'`). Note: `supabase db reset` wipes auth users, so recreate this user afterwards.
3. Point `.env` `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` at the local stack (`http://127.0.0.1:54321` + the printed anon key) and restart `bun run dev`. Restore `.env` to the hosted values when done.
- Non-obvious gotcha: Supabase REST needs table-level `GRANT`s to `anon`/`authenticated` in addition to RLS; without them PostgREST returns `401 permission denied for table ...`. The init migration already includes these grants.
- Note: the hosted Supabase project (the default `.env` target) may still have the older/inconsistent schema; these migrations describe the schema the code expects.
### Supabase service role key (local vs hébergé)

- En **local**, utilisez la clé `service_role` générée par `supabase status` (copiez la clé dans `.env.local`).
- En **hébergé** (Supabase en production), utilisez la clé `service_role` du projet hébergé (disponible dans Settings → API).
- Ne pas confondre les deux clés : elles ne sont pas interchangeables.
