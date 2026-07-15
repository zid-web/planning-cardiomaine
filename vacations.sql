-- Créer la table doctor_vacations pour la gestion des vacances
CREATE TABLE IF NOT EXISTS public.doctor_vacations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, now()) NOT NULL,
  UNIQUE(doctor_id, start_date, end_date)
);

-- Activer Row Level Security
ALTER TABLE public.doctor_vacations ENABLE ROW LEVEL SECURITY;

-- Créer les politiques RLS
CREATE POLICY "Anyone can read vacations" ON public.doctor_vacations
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert vacations" ON public.doctor_vacations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can update vacations" ON public.doctor_vacations
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete vacations" ON public.doctor_vacations
  FOR DELETE USING (true);

-- Index de performance
CREATE INDEX IF NOT EXISTS idx_doctor_vacations_doctor_id ON public.doctor_vacations(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_vacations_dates ON public.doctor_vacations(start_date, end_date);
