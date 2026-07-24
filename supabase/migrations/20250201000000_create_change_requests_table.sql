CREATE TABLE IF NOT EXISTS public.change_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_key TEXT NOT NULL,
  day_name TEXT NOT NULL,
  row_key TEXT NOT NULL,
  slot TEXT, -- optionnel (matin, am, nuit)
  current_doctor TEXT, -- médecin actuellement assigné
  requested_doctor TEXT NOT NULL, -- médecin demandé
  reason TEXT, -- justification libre
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE public.change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own requests"
  ON public.change_requests FOR SELECT
  USING (auth.uid() = requester_id);

CREATE POLICY "Admins can view all requests"
  ON public.change_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can insert their own requests"
  ON public.change_requests FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Admins can update requests"
  ON public.change_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete requests"
  ON public.change_requests FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Table privileges (Supabase REST needs these in addition to RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.change_requests TO anon, authenticated, service_role;
