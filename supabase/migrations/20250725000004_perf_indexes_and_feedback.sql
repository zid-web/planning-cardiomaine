-- Performance indexes + user feedback table

CREATE INDEX IF NOT EXISTS idx_schedules_updated_at
  ON public.schedules (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_doctor_equity_weekly_week
  ON public.doctor_equity_weekly (week_key);

CREATE INDEX IF NOT EXISTS idx_doctor_vacations_doctor_id
  ON public.doctor_vacations (doctor_id);

CREATE INDEX IF NOT EXISTS idx_doctor_vacations_dates
  ON public.doctor_vacations (start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_change_requests_created_at
  ON public.change_requests (created_at DESC);

-- User feedback (tests utilisateurs / bouton Feedback)
CREATE TABLE IF NOT EXISTS public.app_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  rating INTEGER CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  message TEXT NOT NULL,
  page_path TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_feedback_created
  ON public.app_feedback (created_at DESC);

ALTER TABLE public.app_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can insert feedback" ON public.app_feedback;
CREATE POLICY "Authenticated can insert feedback"
  ON public.app_feedback FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read feedback" ON public.app_feedback;
CREATE POLICY "Admins can read feedback"
  ON public.app_feedback FOR SELECT
  USING (public.is_admin());

GRANT SELECT, INSERT ON public.app_feedback TO authenticated;
GRANT ALL ON public.app_feedback TO service_role;
