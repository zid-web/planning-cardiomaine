-- Ensure change_requests.requester_id → profiles(id) exists (needed for
-- PostgREST embeds). Safe if already present. Also keep admin SELECT on profiles
-- so the dashboard can resolve requester emails without embeds.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'change_requests_requester_id_fkey'
      AND conrelid = 'public.change_requests'::regclass
  ) THEN
    -- Drop orphaned rows that would block the FK
    DELETE FROM public.change_requests cr
    WHERE cr.requester_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = cr.requester_id);

    ALTER TABLE public.change_requests
      ADD CONSTRAINT change_requests_requester_id_fkey
      FOREIGN KEY (requester_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Admin can read all profiles (requester emails on the dashboard)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin());
