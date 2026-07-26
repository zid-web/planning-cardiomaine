# AGENTS.md

## Cursor Cloud specific instructions

Next.js 16 (App Router, React 19) + Supabase app ("Cardiomaine Planning", a French
medical shift-scheduling tool). Package manager is **bun** (`bun.lock`). The single
required service is the Next.js dev server; the backend is Supabase.

### Garde Nuit proposals / preferences
- `generateNightGuardProposals` (`lib/guard-scheduler.ts`) : Mar–Dim (+ Lun si FV vacances). Préférences : Lun→U, Mar→M/W, Mer→S/U/P, Jeu→O/G, Ven→rotation B/G/A/P/Z/H/S (O/W/M exclus). Pas de garde la veille d’un NCT pour le médecin NCT (W/M, calendrier `NCT_DATES_2026`). Miroir soft/hard dans `guard-api/solver.py` (`NIGHT_GARDE_*`).

### Fixed clinical assignments & remplacant
- Règles fixes centralisées dans `lib/fixed-assignments.ts` (`applyFixedClinicalAssignments`) : **IRM = S** (Lundi + Vendredi), **FV** Garde Nuit Lundi + Coro Jeudi apm, **DAAS** = `Apm - EE2` Lundi, **Rythmo A** Lundi/Jeudi apm, **Visite** = rotation `U → A → B`. Hors vacances (FV inclus). Appliqué via `generateWeekSchedule(weekKey, vacations)` ; `clearFixedAssigneesOnVacation` retire les initiales fixes si congés.
- **Remplaçant texte libre** : dans la modale d’affectation admin, champ « Remplaçant » → ajoute un libellé dans `cell.value` (badge ambre). Utiliser `isListedDoctor` / `normalizeRemplacantLabel` (`lib/doctor-code.ts`) — hors équité / hors contrôle vacances.

### Vues Aujourd’hui / Semaine
- UI moderne dans `components/today-view.tsx` et `components/week-view.tsx` (montées par `ScheduleApp`).
- **Notes du jour** (onglet Aujourd’hui) : carte cliquable → modale texte → `saveScheduleToDb` via `updateSchedule` sur la ligne `Notes du jour`.
- Toolbar admin : **Journal** = audit `schedule_history` (qui a changé quoi) ; **Pré-remplir** = propositions Cs/ETT/EE depuis semaines passées (ex-« Historique+ », icône `Wand2`). Pas redondants. Boutons outline : forcer `!text-slate-900` + fond blanc (sinon icônes transparentes).
- **Dialogs shadcn** : `DialogContent` doit utiliser `bg-white text-slate-900` (pas `bg-background`) — les tokens CSS HSL sans `hsl()` sont invalides en Tailwind v4 → modale transparente / texte illisible (Pré-remplir, Stats, etc.).

### Congés (ligne unique absences)
- Une seule ligne UI **Congés** (plus de ligne « Vacances »). `normalizeLeaveSchedule` (`lib/vacation-congés-mapper.ts`) : fusion legacy Vacances→Congés, remplissage depuis `doctor_vacations`, puis **retrait des absents de toutes les autres lignes** (y compris `1/2 journée off Matin/Après-midi`).
- `resolveRowKey` mappe `VACANCES` et `CONGE` → `Congés`. `detectConflict` / `canAssignDoctor` n’appliquent pas le rouge conflit sur la ligne Congés — badges = `DOCTOR_COLORS`.
- Solveur Render : n’émettre que `CONGE` (déployer `guard-api/solver.py`).
- Header admin **Congé** → `VacationsModal` : liste complète `doctor_vacations` (filtre médecin) + ajout / modification / suppression (`vacation-actions.ts`). Refresh via `onVacationsUpdated` → `loadVacations` dans `ScheduleApp`.
- **Écriture congés** : `addVacation` / `updateVacation` n’écrivent que `doctor_id` + dates ; le motif `reason` est patché en best-effort (projets Supabase sans colonne → erreur PostgREST « schema cache »). Migration `20250726000000_doctor_vacations_reason_column.sql` pour l’ajouter côté SQL.

### 1/2 journée off après Garde Nuit
- Règle (`lib/half-day-off.ts`) : après Garde Nuit → **apm du lendemain** (tous les jours sauf **samedi**). Si ce créneau est déjà l’off **habituel** du médecin → **matin** du lendemain. Dimanche précédent → lundi via `previous_sunday_guard_doctor`.
- Appliqué à l’édition UI (`placeNightGuardRecoveryOff`), après « Générer » (`applyNightGuardRecoveryOffs`), et dans `guard-api/solver.py` (contrainte + `DEMI_JOURNEE_LIBRE`). Offs habituels = `HABITUAL_HALF_DAYS_OFF` (seed `generateWeekSchedule`).

### Contraintes structurelles vs « Générer »
- **Toujours injectées** (sans Générer) via `applyStructuralConstraints` (`lib/apply-structural-constraints.ts`) : IRM/FV/DAAS/Rythmo/Visite, ½-off habituelles, récupération garde nuit, Congés + strip absents, NCT calendrier, LFB, **CH**, **ATL←Coro**. Appliqué à l’affichage + persisté (`source: "constraints"`, debounce).
- **Astreintes ATL** :
  - **Lun–Ven Matin/Midi** : même médecin que `Matin - Coro` / `Apm - Coro` (`applyAtlFollowsCoroConstraints` + solveur §5quater).
  - **Nuits + weekend** (cycle 2 sem., `week_type` 1=impaire / 2=paire) : **impaire** = CH Lun/Mar/Ven nuit + weekend ATL entier ; W/O/M = Mer/Jeu nuit. **paire** = W/O/M Lun/Mar/Ven nuit + weekend ATL ; CH = Mer/Jeu nuit.
  - **Pas de nuits ATL consécutives Lun–Ven** pour W/O/M (weekend et CH exempts) — solveur §5quinquies ; dérogation = saisie admin / `existing_schedule`.
  - `generateGuardsViaAPI` dérive `week_type` du n° de semaine ISO (ne plus laisser le défaut 1).
- **« Générer »** = **propositions** `pending` (gardes/astreintes WOM/Coro/…) à valider admin. Lignes : `GENERATOR_PROPOSAL_ROW_KEYS`.
- Congés CRUD : **ne pas** `revalidatePath('/protected/planning')` pendant la modale (course / faux positif « message channel closed »). Refresh via `onVacationsUpdated` + `getAllVacations` (`noStore`).
- Do **not** reintroduce `generateWeekWithSolver` / second bouton solveur.
- **Equity / CellData:** `{ value: string[], status, type? }` + row key. Use `lib/equity-tracking.ts`.

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
- Admin change-requests UI lives at **`/protected/admin/requests`** (`app/protected/admin/requests/page.tsx`): filters (status / date range / requester / requested doctor), pagination (20/page, `count: 'exact'` + `range`), full history (all statuses), detail modal with reject comment, and **Supabase Realtime** (`INSERT` on `change_requests` → toast + badge + list refresh). Migration `20250204000000_enable_realtime_change_requests.sql` adds the table to `supabase_realtime` (do not drop that publication). Approve/reject stays in `app/actions/change-request-actions.ts`. The old path `/protected/change-requests` is a thin `redirect()` only — do not reintroduce a full page there.
- Route protection lives in root **`proxy.ts`** (Next.js 16; replaces `middleware.ts`). It uses Supabase SSR `getUser()` (not a raw cookie name check). Public: `/`, `/auth/login`, `/auth/sign-up`, `/auth/forgot-password`. Unauthenticated `/api/*` redirects to login — use a session for voice/PDF proxies.
- `/api/voice-command` and `/api/upload-pdf` are **proxies** to the Render guard API (`GUARD_API_BASE_URL` or fallback `GUARD_API_URL`, default `https://guard-api-cardiomaine.onrender.com`), optionally with `GUARD_API_KEY` (`x-api-key` header + `x_api_key` query). **PDF upload** goes **direct browser → Render** (`lib/pdf-upload-client.ts`) to avoid Vercel **504** on multi-page Claude Vision (1–3 min); `/api/upload-pdf` is fallback only (`maxDuration = 60`). Voice still uses the Next proxy. Prefer the stable Production alias, not preview `…-dpl_…` / hashed URLs.
- Voice payload expected by Render (built in `VoiceAndUploadPanel` / `lib/guard-api-mapping.ts`): `{ text, reference_date, known_doctors, current_week_request }` where `current_week_request` matches `/generate-week` (`week_start_date`, `week_type`, `medecins`, …). Response is applied via `parsed_command` (surgical cell update), not the old local `{ operations: [...] }` shape. PDF response uses `raw_extraction.rows` / `mapped_existing_schedule` (keys like `Garde Nuit||LUNDI`). Set `GUARD_API_BASE_URL` + `GUARD_API_KEY` on Vercel when needed.
- **NCT dictée / saisie :** `resolveRowKey` mappe **toute** combinaison `*/NCT` → `Hors site - NCT` (Claude renvoie souvent `matin/NCT`). Une liste multi-dates (`2026-09-10 → M`) est détectée localement (`lib/nct-command.ts`) et appliquée sur les semaines concernées sans passer par Render. Déployer aussi `guard-api/voice_command.py` sur Render.
- **Import historique multi-semaines :** PDF avec `weeks[]` → `HistoryImportDialog` (review admin) → `commitHistoryImport` (`lib/history-import.ts` + `app/actions/import-history-actions.ts`). Ne remplit que cellules vides, ignore OCR `confidence: low`. **Pré-remplir** (ex-Historique+) : `PatternFillDialog` / `lib/pattern-analysis.ts` propose Cs/ETT/EE/hors site (hors solveur + hors Rythmo) en `pending` après confirmation.
- **« Générer » / vacations matin–soir :** (1) solveur → Coro/gardes/astreintes (`resolveRowKey` + `mergeSolverWeekIntoExisting`) ; (2) **Cs/ETT/EE/Stress** remplis automatiquement via `fillClinicalVacationsFromPatterns` (même fréquence que Pré-remplir, cellules vides en `pending`). Le solveur Render doit forcer **CORO matin + am** Lundi–Vendredi (`guard-api/solver.py` §5ter) — déployer `guard-api/` sur Render. Pré-remplir reste dispo pour revue manuelle / ex-æquo.
- **PDF « JSON malformé »** : root cause is Claude Vision truncation/`json.loads` in **`guard-api-cardiomaine`** (`pdf_upload.py`), not the Next.js proxy. Fixed sources to copy/deploy live in `guard-api/` (+ `patches/fix-pdf-json-extraction.patch`). Cursor bot cannot push that repo — a human must merge onto Render’s deploy branch.

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
