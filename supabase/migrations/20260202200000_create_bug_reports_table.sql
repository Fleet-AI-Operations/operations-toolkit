-- Create bug_reports table
CREATE TABLE IF NOT EXISTS public.bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT NOT NULL,
  page_url TEXT NOT NULL,
  user_agent TEXT,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_bug_reports_user_id ON public.bug_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_created_at ON public.bug_reports(created_at DESC);

-- Enable RLS
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- Policy: Users can create bug reports
CREATE POLICY "Users can create bug reports"
  ON public.bug_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Admins can view all bug reports
CREATE POLICY "Admins can view all bug reports"
  ON public.bug_reports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMIN'
    )
  );

-- Policy: Users can view their own bug reports
CREATE POLICY "Users can view own bug reports"
  ON public.bug_reports
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
