-- Align profiles with the app code (it reads profiles.doctor_code) and add
-- helpful indexes for the change_requests admin workflow.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS doctor_code TEXT;

CREATE INDEX IF NOT EXISTS idx_change_requests_week_key ON public.change_requests(week_key);
CREATE INDEX IF NOT EXISTS idx_change_requests_status ON public.change_requests(status);
CREATE INDEX IF NOT EXISTS idx_change_requests_requester ON public.change_requests(requester_id);
