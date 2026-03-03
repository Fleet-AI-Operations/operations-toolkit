ALTER TABLE public.bug_reports
  ADD COLUMN IF NOT EXISTS linear_issue_id TEXT,
  ADD COLUMN IF NOT EXISTS linear_issue_url TEXT;
