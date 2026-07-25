-- Enable Supabase Realtime for admin live notifications on new change requests.
-- Safe: do NOT drop/recreate the supabase_realtime publication (would wipe other tables).

ALTER TABLE public.change_requests REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'change_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.change_requests;
  END IF;
END $$;
