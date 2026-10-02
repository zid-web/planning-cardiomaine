-- Temps réel : congés et paramètres (calendrier NCT) visibles instantanément
-- sur toutes les sessions (app installée Android / iOS comprise).
-- Safe : n'altère pas la publication supabase_realtime, ajoute seulement les tables manquantes.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'doctor_vacations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.doctor_vacations;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
  END IF;
END $$;
