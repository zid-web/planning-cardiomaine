-- Script d'initialisation et de réparation automatique des profils médecins pour test (Initial 'Y')

-- 1. Attribuer l'initiale de test 'Y' à l'utilisateur de test (id: 73e9a3b6-8b6d-4c38-b1eb-206a9df14317 / email: test-medecin@test.com)
UPDATE public.profiles
SET doctor_code = 'Y', role = 'user'
WHERE id = '73e9a3b6-8b6d-4c38-b1eb-206a9df14317' OR email = 'test-medecin@test.com';

-- 2. Configurer les rôles
-- Médecin M (admin)
UPDATE public.profiles
SET role = 'admin'
WHERE doctor_code = 'M' OR email LIKE '%admin%';

-- 3. Octroyer les droits sur les tables Supabase
GRANT ALL ON TABLE public.schedules TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.change_requests TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.schedule_history TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.private_notes TO anon, authenticated, service_role;

-- 4. Activer et ré-appliquer les politiques RLS permissives sur toutes les tables principales
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "schedules_allow_all" ON public.schedules;
CREATE POLICY "schedules_allow_all" ON public.schedules FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE public.change_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "change_requests_allow_all" ON public.change_requests;
CREATE POLICY "change_requests_allow_all" ON public.change_requests FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE public.schedule_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "schedule_history_allow_all" ON public.schedule_history;
CREATE POLICY "schedule_history_allow_all" ON public.schedule_history FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE public.private_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "private_notes_allow_all" ON public.private_notes;
CREATE POLICY "private_notes_allow_all" ON public.private_notes FOR ALL TO public USING (true) WITH CHECK (true);
