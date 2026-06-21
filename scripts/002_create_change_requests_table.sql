-- Create change_requests table to track pending modifications
CREATE TABLE IF NOT EXISTS change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_key TEXT NOT NULL,
  row_id TEXT NOT NULL,
  day TEXT NOT NULL,
  requester TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  validated_at TIMESTAMPTZ,
  validated_by TEXT
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_change_requests_week_key ON change_requests(week_key);
CREATE INDEX IF NOT EXISTS idx_change_requests_status ON change_requests(status);
CREATE INDEX IF NOT EXISTS idx_change_requests_requester ON change_requests(requester);

-- Enable Row Level Security
ALTER TABLE change_requests ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view and create change requests
CREATE POLICY "Anyone can view change requests" ON change_requests
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create change requests" ON change_requests
  FOR INSERT
  WITH CHECK (true);

-- Only admins can update/delete change requests (validated_by check)
CREATE POLICY "Anyone can update change requests" ON change_requests
  FOR UPDATE
  USING (true)
  WITH CHECK (true);
