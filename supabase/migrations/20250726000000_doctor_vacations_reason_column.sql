-- Production tables created before init_schema may lack optional columns.
-- PostgREST then rejects inserts/updates that reference them ("schema cache").
ALTER TABLE public.doctor_vacations
  ADD COLUMN IF NOT EXISTS reason TEXT;

ALTER TABLE public.doctor_vacations
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', now());

ALTER TABLE public.doctor_vacations
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', now());
