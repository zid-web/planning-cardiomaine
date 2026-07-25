# AGENTS.md

## Cursor Cloud specific instructions

Next.js 16 (App Router, React 19) + Supabase app ("Cardiomaine Planning", a French
medical shift-scheduling tool). Package manager is **bun** (`bun.lock`). The single
required service is the Next.js dev server; the backend is Supabase.

### Run / build / lint
- Dev server: `bun run dev` → http://localhost:3000 (this is the app; use dev, not `build`/`start`).
- Build: `bun run build` (note: `next.config.js` sets `typescript.ignoreBuildErrors: true`, so TS errors do not fail the build).
- Lint: `bun run lint` works (flat config in `eslint.config.mjs`). It is configured to exit 0 with warnings only; several noisy/pre-existing rules (incl. React Compiler rules from `react-hooks` v6) are set to `warn` on purpose.
- Standard commands are also in `README.md` and `QUICK_REFERENCE.md`.

### Roles & API gotchas
- `profiles.role` defaults to `'admin'` (init migration), so brand-new users are admins. The planning page treats `role === 'admin'` as admin (direct grid editing + change-request approval panel); any other role is a "doctor" who can only submit change requests. To test the doctor flow, set a user's `role` to something else (e.g. `UPDATE profiles SET role='doctor' WHERE ...`).
- `middleware.ts` gates `/api/*` too (only `/`, `/auth/login`, `/auth/sign-up`, `/auth/forgot-password` are public). Unauthenticated requests to API routes redirect to login, so testing `/api/voice-command` or `/api/upload-pdf` with plain `curl` won't hit the handler — use an authenticated session.
- `/api/voice-command` and `/api/upload-pdf` are **proxies** to the Render guard API (`GUARD_API_BASE_URL` or fallback `GUARD_API_URL`, default `https://guard-api-cardiomaine.onrender.com`), optionally with `GUARD_API_KEY` (`x-api-key` header + `x_api_key` query). The voice/PDF panel calls these Next.js routes (not Render directly) to avoid CORS. Render free-tier may cold-start (~60s).
- Voice payload expected by Render (built in `VoiceAndUploadPanel` / `lib/guard-api-mapping.ts`): `{ text, reference_date, known_doctors, current_week_request }` where `current_week_request` matches `/generate-week` (`week_start_date`, `week_type`, `medecins`, …). Response is applied via `parsed_command` (surgical cell update), not the old local `{ operations: [...] }` shape. PDF response uses `raw_extraction.rows` / `mapped_existing_schedule` (keys like `Garde Nuit||LUNDI`). Set `GUARD_API_BASE_URL` + `GUARD_API_KEY` on Vercel when needed.
- Admin change-requests UI lives at **`/protected/admin/requests`** (`app/protected/admin/requests/page.tsx`). Approve/reject is centralized in `app/actions/change-request-actions.ts` (`applyChangeRequest` / `rejectChangeRequest`). The old path `/protected/change-requests` (PR #25) is a thin `redirect()` only — do not reintroduce a full page there.

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
