-- Add status and assignment fields to bug_reports
ALTER TABLE public.bug_reports
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING' NOT NULL,
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS assigned_to_email TEXT;

-- Add index for status queries
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON public.bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_assigned_to ON public.bug_reports(assigned_to);

-- Add check constraint for valid statuses
ALTER TABLE public.bug_reports
ADD CONSTRAINT bug_reports_status_check
CHECK (status IN ('PENDING', 'IN_PROGRESS', 'RESOLVED'));

-- Policy: Admins can update bug reports
CREATE POLICY "Admins can update bug reports"
  ON public.bug_reports
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMIN'
    )
  );
