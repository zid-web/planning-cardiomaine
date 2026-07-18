-- Create planning_notes table for storing admin planning notes and instructions
CREATE TABLE IF NOT EXISTS public.planning_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  category TEXT CHECK (category IN ('absence', 'contrainte', 'note_generale')) DEFAULT 'note_generale',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.planning_notes ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins (from profiles table with role='admin') can view, create, update, delete
CREATE POLICY "Admins can manage planning notes" ON public.planning_notes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create index on created_at for efficient sorting
CREATE INDEX planning_notes_created_at_idx ON public.planning_notes(created_at DESC);

-- Create index on created_by for efficient filtering
CREATE INDEX planning_notes_created_by_idx ON public.planning_notes(created_by);
