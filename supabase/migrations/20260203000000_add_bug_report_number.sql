-- Add report_number column with auto-incrementing sequence
CREATE SEQUENCE IF NOT EXISTS public.bug_reports_number_seq;

ALTER TABLE public.bug_reports
ADD COLUMN IF NOT EXISTS report_number INTEGER DEFAULT nextval('public.bug_reports_number_seq') NOT NULL;

-- Create unique index on report_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_bug_reports_report_number ON public.bug_reports(report_number);

-- Set the sequence to start from the current max + 1 (if there are existing records)
SELECT setval('public.bug_reports_number_seq', COALESCE((SELECT MAX(report_number) FROM public.bug_reports), 0) + 1, false);
