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
1. `supabase start` (a committed `supabase/config.toml` already exists). Migrations in `supabase/migrations/` are now aligned with the app code — `20240101000000_init_schema.sql` creates the `profiles` (with `role` + `must_change_password`), `week_key`-based `schedules`, `doctor_vacations`, `planning_notes`, `doctors`, `settings`, `congres`, and equity tables, with permissive RLS and the required role GRANTs. Use `supabase db reset` to re-apply from scratch.
2. Create a confirmed user via the admin API (service_role key from `supabase start` output):
   `POST http://127.0.0.1:54321/auth/v1/admin/users` with `{"email":"admin@cardiomaine.fr","password":"Admin123!","email_confirm":true,"user_metadata":{"first_name":"Marie","last_name":"Martin"}}`. The `on_auth_user_created` trigger auto-creates a `profiles` row (default `role='admin'`). Note: `supabase db reset` wipes auth users, so recreate this user afterwards.
3. Point `.env` `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` at the local stack (`http://127.0.0.1:54321` + the printed anon key) and restart `bun run dev`. Restore `.env` to the hosted values when done.
- Non-obvious gotcha: Supabase REST needs table-level `GRANT`s to `anon`/`authenticated` in addition to RLS; without them PostgREST returns `401 permission denied for table ...`. The init migration already includes these grants.
- Note: the hosted Supabase project (the default `.env` target) may still have the older/inconsistent schema; these migrations describe the schema the code expects.
