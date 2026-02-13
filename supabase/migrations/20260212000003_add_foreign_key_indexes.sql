-- Add indexes for foreign keys to improve JOIN and query performance
-- These were flagged by Supabase's performance linter
-- Note: Some indexes may already exist from Prisma schema

-- Analytics Jobs - projectId foreign key (already exists as idx_analytics_jobs_project)
-- CREATE INDEX IF NOT EXISTS idx_analytics_jobs_project_id
-- ON public.analytics_jobs("projectId");

-- Assignment Batches - created_by_id foreign key (table doesn't exist in current schema)
-- CREATE INDEX IF NOT EXISTS idx_assignment_batches_created_by
-- ON public.assignment_batches(created_by_id);

-- Bonus Windows - created_by foreign key
CREATE INDEX IF NOT EXISTS idx_bonus_windows_created_by
ON public.bonus_windows(created_by);

-- Data Records - projectId foreign key (already exists as idx_data_records_project)
-- CREATE INDEX IF NOT EXISTS idx_data_records_project_id
-- ON public.data_records("projectId");

-- Ingest Jobs - projectId foreign key (already exists as idx_ingest_jobs_project)
-- CREATE INDEX IF NOT EXISTS idx_ingest_jobs_project_id
-- ON public.ingest_jobs("projectId");
