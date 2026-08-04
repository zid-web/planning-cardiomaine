-- Migration 003: Table guard_picks (Choix de gardes WE/Fériés)
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS guard_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_code TEXT NOT NULL,
  doctor_id UUID REFERENCES auth.users(id),
  semester INTEGER NOT NULL CHECK (semester IN (1, 2)),
  year INTEGER NOT NULL,
  date TEXT NOT NULL,            -- YYYY-MM-DD
  day_type TEXT NOT NULL,        -- 'samedi' | 'dimanche' | 'ferie'
  guard_type TEXT NOT NULL,      -- 'Garde Matin' | 'Garde Nuit'
  is_wom_combo BOOLEAN DEFAULT FALSE,  -- Semaine combo M/O/W
  wom_role TEXT,                 -- 'garde_sam' | 'atl_sat' | 'atl_sun' | null
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason TEXT,
  admin_note TEXT,
  validated_by TEXT,
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prevent duplicate picks per doctor/date/guard_type
CREATE UNIQUE INDEX IF NOT EXISTS guard_picks_unique_slot
  ON guard_picks (doctor_code, date, guard_type);

-- RLS
ALTER TABLE guard_picks ENABLE ROW LEVEL SECURITY;

-- Users can manage their own picks
CREATE POLICY "Users manage own picks"
  ON guard_picks FOR ALL
  USING (auth.uid() = doctor_id);

-- Admins (service role) can see all picks
CREATE POLICY "Service role full access"
  ON guard_picks FOR ALL
  USING (TRUE);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_guard_picks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER guard_picks_updated_at
  BEFORE UPDATE ON guard_picks
  FOR EACH ROW EXECUTE FUNCTION update_guard_picks_updated_at();
