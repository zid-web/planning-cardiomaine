-- Allow service_role / postgres to update profiles.role (admin API + migrations)

CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text;
BEGIN
  BEGIN
    jwt_role := coalesce(
      nullif(current_setting('request.jwt.claim.role', true), ''),
      nullif(current_setting('request.jwt.claims', true)::json ->> 'role', '')
    );
  EXCEPTION WHEN OTHERS THEN
    jwt_role := null;
  END;

  -- Admin Auth API (service_role) and SQL superuser contexts
  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Seul un admin peut changer le rôle';
  END IF;

  RETURN NEW;
END;
$$;
