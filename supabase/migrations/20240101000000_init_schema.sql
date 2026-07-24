-- Local dev consolidated schema (matches application code, not committed prod migrations).
-- This file is used only for local Supabase development and is intentionally not committed.

-- profiles ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'admin',
  must_change_password BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', now()) NOT NULL
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data ->> 'first_name', ''),
    COALESCE(new.raw_user_meta_data ->> 'last_name', '')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- schedules (schema matches app code: week_key based) -----------------------
CREATE TABLE IF NOT EXISTS public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_key TEXT NOT NULL UNIQUE,
  schedule_data JSONB NOT NULL,
  version INTEGER DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_schedules_week_key ON public.schedules(week_key);
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedules_read" ON public.schedules FOR SELECT USING (true);
CREATE POLICY "schedules_write" ON public.schedules FOR ALL USING (true) WITH CHECK (true);

-- doctor_vacations ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.doctor_vacations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', now()) NOT NULL,
  UNIQUE(doctor_id, start_date, end_date)
);
ALTER TABLE public.doctor_vacations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vac_read" ON public.doctor_vacations FOR SELECT USING (true);
CREATE POLICY "vac_write" ON public.doctor_vacations FOR ALL USING (true) WITH CHECK (true);

-- planning_notes ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.planning_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  category TEXT CHECK (category IN ('absence', 'contrainte', 'note_generale')) DEFAULT 'note_generale',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.planning_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notes_admin_all" ON public.planning_notes FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- doctors -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.doctors (
  id TEXT PRIMARY KEY,
  nom TEXT,
  statut TEXT,
  actif BOOLEAN DEFAULT true
);
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doctors_read" ON public.doctors FOR SELECT USING (true);
CREATE POLICY "doctors_write" ON public.doctors FOR ALL USING (true) WITH CHECK (true);

-- settings ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_read" ON public.settings FOR SELECT USING (true);
CREATE POLICY "settings_write" ON public.settings FOR ALL USING (true) WITH CHECK (true);

-- congres -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.congres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id TEXT,
  start_date DATE,
  end_date DATE,
  type TEXT
);
ALTER TABLE public.congres ENABLE ROW LEVEL SECURITY;
CREATE POLICY "congres_read" ON public.congres FOR SELECT USING (true);
CREATE POLICY "congres_write" ON public.congres FOR ALL USING (true) WITH CHECK (true);

-- equity tables -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.doctor_equity_weekly (
  doctor_id TEXT NOT NULL,
  week_key TEXT NOT NULL,
  astreinte_count INTEGER NOT NULL DEFAULT 0,
  garde_count INTEGER NOT NULL DEFAULT 0,
  nct_count INTEGER NOT NULL DEFAULT 0,
  weekend_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  PRIMARY KEY (doctor_id, week_key)
);
ALTER TABLE public.doctor_equity_weekly ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eqw_read" ON public.doctor_equity_weekly FOR SELECT USING (true);
CREATE POLICY "eqw_write" ON public.doctor_equity_weekly FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.doctor_equity_weights (
  doctor_id TEXT PRIMARY KEY,
  poids_equite_pct INTEGER NOT NULL DEFAULT 100 CHECK (poids_equite_pct > 0),
  note TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);
ALTER TABLE public.doctor_equity_weights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eqwt_read" ON public.doctor_equity_weights FOR SELECT USING (true);
CREATE POLICY "eqwt_write" ON public.doctor_equity_weights FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.doctor_equity_totals (
  doctor_id TEXT PRIMARY KEY,
  astreinte_count INTEGER NOT NULL DEFAULT 0,
  garde_count INTEGER NOT NULL DEFAULT 0,
  nct_count INTEGER NOT NULL DEFAULT 0,
  weekend_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);
ALTER TABLE public.doctor_equity_totals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eqt_read" ON public.doctor_equity_totals FOR SELECT USING (true);
CREATE POLICY "eqt_write" ON public.doctor_equity_totals FOR ALL USING (true) WITH CHECK (true);

-- Role grants (Supabase REST needs table privileges in addition to RLS) --------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;
