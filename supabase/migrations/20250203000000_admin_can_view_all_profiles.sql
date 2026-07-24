-- Allow admins to read all profiles so the admin "change requests" view can embed
-- the requester's email (change_requests -> profiles(email)).
--
-- A SELECT policy on profiles that itself queries profiles would recurse, so we
-- use a SECURITY DEFINER helper that bypasses RLS to read the caller's role.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin());
