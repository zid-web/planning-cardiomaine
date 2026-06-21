-- Create schedules table to store weekly planning data
CREATE TABLE IF NOT EXISTS schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_key TEXT NOT NULL UNIQUE, -- Format: "2024-W47"
  schedule_data JSONB NOT NULL, -- The full schedule object for that week
  version INTEGER DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_schedules_week_key ON schedules(week_key);
CREATE INDEX IF NOT EXISTS idx_schedules_updated_at ON schedules(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read schedules
CREATE POLICY "Anyone can view schedules" ON schedules
  FOR SELECT
  USING (true);

-- Allow all authenticated users to insert/update schedules
CREATE POLICY "Anyone can modify schedules" ON schedules
  FOR ALL
  USING (true)
  WITH CHECK (true);
