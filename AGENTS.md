# AGENTS.md

## Cursor Cloud specific instructions

Next.js 16 (App Router, React 19) + Supabase app ("Cardiomaine Planning", a French
medical shift-scheduling tool). Package manager is **bun** (`bun.lock`). The single
required service is the Next.js dev server; the backend is Supabase.

### Run / build / lint
- Dev server: `bun run dev` → http://localhost:3000 (this is the app; use dev, not `build`/`start`).
- Build: `bun run build` (note: `next.config.js` sets `typescript.ignoreBuildErrors: true`, so TS errors do not fail the build).
- Lint: `bun run lint` is currently **broken in the repo** — the `lint` script calls `eslint .` but `eslint` is not a dependency and there is no eslint config. Do not treat lint failures here as caused by your changes.
- Standard commands are also in `README.md` and `QUICK_REFERENCE.md`.

### Supabase backend (important auth caveat)
- Committed `.env` points at a hosted Supabase project. The client (`lib/supabase/client.ts`) hardcodes the same values as a fallback.
- The hosted project has email confirmation ON (`mailer_autoconfirm=false`) and no seeded/test accounts, so you **cannot** self-signup and log in without access to the confirmation email. The documented sample accounts (e.g. `marie@cardiomaine.fr`) do **not** exist in that project.
- All protected pages require login (`middleware.ts` gates everything except `/`, `/auth/login`, `/auth/sign-up`, `/auth/forgot-password`).

### Running a local Supabase for end-to-end testing (no real account needed)
Requires Docker + the Supabase CLI installed in the VM (not part of the update script). To exercise login + the protected planning grid autonomously:
1. Do **not** rely on `supabase/migrations/*` — they are inconsistent with the app code (e.g. the committed `schedules` migration is `user_id`/`full_schedule`-based, but the app uses `week_key`/`schedule_data`; the planning_notes migration references `profiles.role` before `profiles` exists). Use `supabase/local-dev-init.sql` instead, which matches the code (adds `profiles.role` + `profiles.must_change_password`, a `week_key`-based `schedules` table, permissive RLS, and the required role GRANTs).
2. `supabase init` (a committed `supabase/config.toml` already exists), temporarily move `supabase/migrations/*.sql` aside so they don't auto-apply, then `supabase start`.
3. Apply the schema: `docker exec -i supabase_db_<project> psql -U postgres -d postgres < supabase/local-dev-init.sql` (project suffix is usually `workspace`).
4. Create a confirmed user via the admin API (service_role key from `supabase start` output):
   `POST http://127.0.0.1:54321/auth/v1/admin/users` with `{"email":"admin@cardiomaine.fr","password":"Admin123!","email_confirm":true,"user_metadata":{"first_name":"Marie","last_name":"Martin"}}`. The `on_auth_user_created` trigger auto-creates a `profiles` row (default `role='admin'`).
5. Point `.env` `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` at the local stack (`http://127.0.0.1:54321` + the printed anon key) and restart `bun run dev`. Restore `.env` to the hosted values when done.
- Non-obvious gotcha: Supabase REST needs table-level `GRANT`s to `anon`/`authenticated` in addition to RLS; without them PostgREST returns `401 permission denied for table ...`. `supabase/local-dev-init.sql` already includes these grants.

### Known app bug (not an environment issue)
- `app/protected/planning/page.tsx` saves with `supabase.from("schedules").upsert({ week_key, ... })` but does **not** pass `onConflict: "week_key"`. Because `week_key` is UNIQUE (not the PK), only the **first** assignment for a given week persists; later edits to the same week fail with a unique-violation (`23505`) that is swallowed (logged as `Erreur de sauvegarde`). When demonstrating persistence, use a week that has no `schedules` row yet.
