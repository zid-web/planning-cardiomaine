-- Sécurité (audit du 06/11/2026). À exécuter une fois (Supabase → SQL Editor ou migration).
-- Idempotent : peut être relancé sans effet de bord.

-- 1. CRITIQUE — un utilisateur connecté pouvait modifier son propre `role` (→ admin) et son
--    `doctor_code` (→ se faire passer pour un autre médecin) via l'API Supabase publique.
--    Seules les colonnes qu'un utilisateur modifie réellement restent modifiables ; le rôle,
--    l'initiale et l'e-mail ne changent plus que par les actions admin (clé service_role).
revoke insert, update, delete, truncate on public.profiles from anon, authenticated;
grant update (first_name, last_name, must_change_password, updated_at) on public.profiles to authenticated;

-- 2. Lectures ouvertes à TOUT internet (rôle anon, clé publique) → réservées aux connectés.
drop policy if exists "Anyone can view history" on public.schedule_history;
create policy "Authenticated can view history" on public.schedule_history
  for select to authenticated using (true);

drop policy if exists "change_requests_select" on public.change_requests;
create policy "change_requests_select" on public.change_requests
  for select to authenticated using (true);

drop policy if exists "change_requests_history_select" on public.change_requests_history;
create policy "change_requests_history_select" on public.change_requests_history
  for select to authenticated using (true);
-- L'archivage passe par la clé service_role (non soumise aux policies) : plus d'insertion publique.
drop policy if exists "change_requests_history_insert" on public.change_requests_history;

drop policy if exists "doctors_read" on public.doctors;
create policy "doctors_read" on public.doctors for select to authenticated using (true);

drop policy if exists "congres_read" on public.congres;
create policy "congres_read" on public.congres for select to authenticated using (true);

-- 3. Écritures ouvertes à tout utilisateur connecté → admins uniquement.
drop policy if exists "doctors_write_authenticated" on public.doctors;
create policy "doctors_write_admin" on public.doctors
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "congres_write_authenticated" on public.congres;
create policy "congres_write_admin" on public.congres
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- guard_picks : chacun gère ses propres choix, l'admin tous.
drop policy if exists "guard_picks_insert" on public.guard_picks;
drop policy if exists "guard_picks_update" on public.guard_picks;
drop policy if exists "guard_picks_delete" on public.guard_picks;
drop policy if exists "Users manage own picks" on public.guard_picks;
create policy "guard_picks_write_own_or_admin" on public.guard_picks
  for all to authenticated
  using (auth.uid() = doctor_id or public.is_admin())
  with check (auth.uid() = doctor_id or public.is_admin());

-- 4. Liste des comptes autorisés (e-mails, rôles) : lisible par les admins seulement.
drop policy if exists "authorized_users_select_authenticated" on public.authorized_users;
create policy "authorized_users_select_admin" on public.authorized_users
  for select to authenticated using (public.is_admin());
