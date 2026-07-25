-- G3: Realtime sync of planning rows between connected admins.
-- Safe: do NOT drop/recreate the supabase_realtime publication.

ALTER TABLE public.schedules REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'schedules'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.schedules;
  END IF;
END $$;
