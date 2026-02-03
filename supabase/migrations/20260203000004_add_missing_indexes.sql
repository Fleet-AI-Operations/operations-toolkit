-- Add missing index for foreign key that Supabase linter identified
-- This improves query performance when filtering/joining on ownerId

-- Add index for projects.ownerId foreign key
CREATE INDEX IF NOT EXISTS idx_projects_owner ON public.projects("ownerId");

-- Note: The following indexes already exist in init_schema.sql but are mentioned
-- by the linter. They may show as "unused" in fresh dev environments with no query traffic:
-- - idx_analytics_jobs_project (analytics_jobs.projectId)
-- - idx_data_records_project (data_records.projectId)
-- - idx_ingest_jobs_project (ingest_jobs.projectId)
--
-- Unused index warnings are INFO-level and expected in local dev environments
-- with minimal data and query traffic. They should be evaluated in production
-- based on actual query patterns and performance metrics.
