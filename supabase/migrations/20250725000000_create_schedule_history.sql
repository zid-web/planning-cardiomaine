-- G2: audit trail for planning cell changes

CREATE TABLE IF NOT EXISTS public.schedule_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_key TEXT NOT NULL,
  row_key TEXT NOT NULL,
  day_name TEXT NOT NULL,
  old_value TEXT[] NOT NULL DEFAULT '{}',
  new_value TEXT[] NOT NULL DEFAULT '{}',
  changed_by TEXT,
  changed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source TEXT DEFAULT 'ui',
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedule_history_week_at
  ON public.schedule_history (week_key, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_schedule_history_user
  ON public.schedule_history (changed_by_user_id, changed_at DESC);

ALTER TABLE public.schedule_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read schedule_history" ON public.schedule_history;
CREATE POLICY "Admins can read schedule_history"
  ON public.schedule_history FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Authenticated can insert schedule_history" ON public.schedule_history;
CREATE POLICY "Authenticated can insert schedule_history"
  ON public.schedule_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

GRANT SELECT, INSERT ON public.schedule_history TO authenticated;
GRANT ALL ON public.schedule_history TO service_role;
