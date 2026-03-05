-- Disable statement timeout for this migration — bulk UPDATE on data_records can be slow
SET statement_timeout = 0;

-- ============================================================================
-- Remove Project Concept and Replace with Environment-Based Organization
-- ============================================================================
-- This migration completely removes the Project table and replaces projectId
-- foreign keys with environment TEXT columns across all affected tables.
--
-- Affected tables (8 total):
-- 1. data_records
-- 2. ingest_jobs
-- 3. analytics_jobs
-- 4. audit_logs (projectId nullable)
-- 5. candidate_status
-- 6. rater_groups
-- 7. assignment_batches
-- 8. llm_evaluation_jobs
-- ============================================================================

-- ============================================================================
-- STEP 1: Add environment columns to all affected tables (nullable initially)
-- ============================================================================

-- 1. data_records: Extract from metadata.environment_name or metadata.env_key
ALTER TABLE public.data_records
ADD COLUMN IF NOT EXISTS environment TEXT;

-- 2. ingest_jobs: Copy from associated records or default
ALTER TABLE public.ingest_jobs
ADD COLUMN IF NOT EXISTS environment TEXT;

-- 3. analytics_jobs: Copy from associated project or default
ALTER TABLE public.analytics_jobs
ADD COLUMN IF NOT EXISTS environment TEXT;

-- 4. audit_logs: Copy from project or default
ALTER TABLE public.audit_logs
ADD COLUMN IF NOT EXISTS environment TEXT;

-- 5. candidate_status: Copy from project or default
ALTER TABLE public.candidate_status
ADD COLUMN IF NOT EXISTS environment TEXT;

-- 6. rater_groups: Copy from project or default (skip if table doesn't exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rater_groups') THEN
        ALTER TABLE public.rater_groups ADD COLUMN IF NOT EXISTS environment TEXT;
    END IF;
END $$;

-- 7. assignment_batches: Copy from project or default (skip if table doesn't exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'assignment_batches') THEN
        ALTER TABLE public.assignment_batches ADD COLUMN IF NOT EXISTS environment TEXT;
    END IF;
END $$;

-- 8. llm_evaluation_jobs: Copy from project or default (skip if table doesn't exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'llm_evaluation_jobs') THEN
        ALTER TABLE public.llm_evaluation_jobs ADD COLUMN IF NOT EXISTS environment TEXT;
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Migrate existing data to populate environment columns
-- ============================================================================

-- 1. data_records: Extract from metadata (try environment_name first, then env_key)
UPDATE public.data_records
SET environment = COALESCE(
    metadata->>'environment_name',
    metadata->>'env_key',
    'default'
);

-- 2. ingest_jobs: Get environment from most common environment in associated records
-- If no records exist for the job, use 'default'
UPDATE public.ingest_jobs ij
SET environment = COALESCE(
    (
        SELECT COALESCE(dr.metadata->>'environment_name', dr.metadata->>'env_key', 'default')
        FROM public.data_records dr
        WHERE dr."ingestJobId" = ij.id
        LIMIT 1
    ),
    'default'
);

-- 3. analytics_jobs: Get environment from project name or default
UPDATE public.analytics_jobs aj
SET environment = COALESCE(
    (
        SELECT LOWER(REGEXP_REPLACE(p.name, '[^a-zA-Z0-9]', '-', 'g'))
        FROM public.projects p
        WHERE p.id = aj."projectId"
    ),
    'default'
);

-- 4. audit_logs: Get environment from project name or NULL (keep nullable for non-project logs)
UPDATE public.audit_logs al
SET environment = CASE
    WHEN al.project_id IS NOT NULL THEN
        COALESCE(
            (
                SELECT LOWER(REGEXP_REPLACE(p.name, '[^a-zA-Z0-9]', '-', 'g'))
                FROM public.projects p
                WHERE p.id = al.project_id
            ),
            'default'
        )
    ELSE NULL
END;

-- 5. candidate_status: Get environment from project name
UPDATE public.candidate_status cs
SET environment = COALESCE(
    (
        SELECT LOWER(REGEXP_REPLACE(p.name, '[^a-zA-Z0-9]', '-', 'g'))
        FROM public.projects p
        WHERE p.id = cs."projectId"
    ),
    'default'
);

-- 6. rater_groups: Get environment from project name (skip if table doesn't exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rater_groups') THEN
        UPDATE public.rater_groups rg
        SET environment = COALESCE(
            (
                SELECT LOWER(REGEXP_REPLACE(p.name, '[^a-zA-Z0-9]', '-', 'g'))
                FROM public.projects p
                WHERE p.id = rg.project_id
            ),
            'default'
        );
    END IF;
END $$;

-- 7. assignment_batches: Get environment from project name (skip if table doesn't exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'assignment_batches') THEN
        UPDATE public.assignment_batches ab
        SET environment = COALESCE(
            (
                SELECT LOWER(REGEXP_REPLACE(p.name, '[^a-zA-Z0-9]', '-', 'g'))
                FROM public.projects p
                WHERE p.id = ab.project_id
            ),
            'default'
        );
    END IF;
END $$;

-- 8. llm_evaluation_jobs: Get environment from project name (skip if table doesn't exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'llm_evaluation_jobs') THEN
        UPDATE public.llm_evaluation_jobs lej
        SET environment = COALESCE(
            (
                SELECT LOWER(REGEXP_REPLACE(p.name, '[^a-zA-Z0-9]', '-', 'g'))
                FROM public.projects p
                WHERE p.id = lej.project_id
            ),
            'default'
        );
    END IF;
END $$;

-- ============================================================================
-- STEP 3: Make environment columns NOT NULL (except audit_logs)
-- ============================================================================

-- All tables except audit_logs (which can have NULL for non-project logs)
ALTER TABLE public.data_records
ALTER COLUMN environment SET NOT NULL;

ALTER TABLE public.ingest_jobs
ALTER COLUMN environment SET NOT NULL;

ALTER TABLE public.analytics_jobs
ALTER COLUMN environment SET NOT NULL;

-- audit_logs stays nullable for non-project entries

ALTER TABLE public.candidate_status
ALTER COLUMN environment SET NOT NULL;

-- Set NOT NULL for tables that exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rater_groups') THEN
        ALTER TABLE public.rater_groups ALTER COLUMN environment SET NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'assignment_batches') THEN
        ALTER TABLE public.assignment_batches ALTER COLUMN environment SET NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'llm_evaluation_jobs') THEN
        ALTER TABLE public.llm_evaluation_jobs ALTER COLUMN environment SET NOT NULL;
    END IF;
END $$;

-- ============================================================================
-- STEP 4: Add indexes on environment columns for query performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_data_records_environment
ON public.data_records (environment);

CREATE INDEX IF NOT EXISTS idx_ingest_jobs_environment
ON public.ingest_jobs (environment);

CREATE INDEX IF NOT EXISTS idx_analytics_jobs_environment
ON public.analytics_jobs (environment);

CREATE INDEX IF NOT EXISTS idx_audit_logs_environment
ON public.audit_logs (environment)
WHERE environment IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_candidate_status_environment
ON public.candidate_status (environment);

-- Create indexes for tables that exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rater_groups') THEN
        CREATE INDEX IF NOT EXISTS idx_rater_groups_environment ON public.rater_groups (environment);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'assignment_batches') THEN
        CREATE INDEX IF NOT EXISTS idx_assignment_batches_environment ON public.assignment_batches (environment);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'llm_evaluation_jobs') THEN
        CREATE INDEX IF NOT EXISTS idx_llm_evaluation_jobs_environment ON public.llm_evaluation_jobs (environment);
    END IF;
END $$;

-- ============================================================================
-- STEP 5: Drop foreign key constraints for projectId
-- ============================================================================

-- data_records
ALTER TABLE public.data_records
DROP CONSTRAINT IF EXISTS data_records_projectId_fkey;

-- ingest_jobs
ALTER TABLE public.ingest_jobs
DROP CONSTRAINT IF EXISTS ingest_jobs_projectId_fkey;

-- analytics_jobs
ALTER TABLE public.analytics_jobs
DROP CONSTRAINT IF EXISTS analytics_jobs_projectId_fkey;

-- candidate_status
ALTER TABLE public.candidate_status
DROP CONSTRAINT IF EXISTS candidate_status_projectId_fkey;

-- Drop foreign keys for tables that exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rater_groups') THEN
        ALTER TABLE public.rater_groups DROP CONSTRAINT IF EXISTS rater_groups_project_id_fkey;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'assignment_batches') THEN
        ALTER TABLE public.assignment_batches DROP CONSTRAINT IF EXISTS assignment_batches_project_id_fkey;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'llm_evaluation_jobs') THEN
        ALTER TABLE public.llm_evaluation_jobs DROP CONSTRAINT IF EXISTS llm_evaluation_jobs_projectId_fkey;
    END IF;
END $$;

-- ============================================================================
-- STEP 6: Drop projectId columns from all tables
-- ============================================================================

-- Drop indexes first to avoid conflicts
DROP INDEX IF EXISTS public.idx_data_records_project;
DROP INDEX IF EXISTS public.idx_ingest_jobs_project;
DROP INDEX IF EXISTS public.idx_analytics_jobs_project;
DROP INDEX IF EXISTS public.idx_audit_logs_project;
DROP INDEX IF EXISTS public.idx_candidate_status_project;
DROP INDEX IF EXISTS public.idx_data_records_project_type;

-- Now drop the columns
ALTER TABLE public.data_records
DROP COLUMN IF EXISTS "projectId";

ALTER TABLE public.ingest_jobs
DROP COLUMN IF EXISTS "projectId";

ALTER TABLE public.analytics_jobs
DROP COLUMN IF EXISTS "projectId";

ALTER TABLE public.audit_logs
DROP COLUMN IF EXISTS project_id;

ALTER TABLE public.candidate_status
DROP COLUMN IF EXISTS "projectId";

-- Drop columns for tables that exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rater_groups') THEN
        ALTER TABLE public.rater_groups DROP COLUMN IF EXISTS project_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'assignment_batches') THEN
        ALTER TABLE public.assignment_batches DROP COLUMN IF EXISTS project_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'llm_evaluation_jobs') THEN
        ALTER TABLE public.llm_evaluation_jobs DROP COLUMN IF EXISTS project_id;
    END IF;
END $$;

-- ============================================================================
-- STEP 7: Drop unique constraints that reference projectId
-- ============================================================================

-- candidate_status has unique(userId, projectId)
ALTER TABLE public.candidate_status
DROP CONSTRAINT IF EXISTS candidate_status_userId_projectId_key;

-- rater_groups has unique(projectId, name) - we'll recreate with environment
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rater_groups') THEN
        ALTER TABLE public.rater_groups DROP CONSTRAINT IF EXISTS rater_groups_project_id_name_key;
    END IF;
END $$;

-- ============================================================================
-- STEP 8: Add new unique constraints using environment
-- ============================================================================

-- candidate_status: unique per user per environment
ALTER TABLE public.candidate_status
ADD CONSTRAINT candidate_status_userId_environment_key
UNIQUE ("userId", environment);

-- rater_groups: unique name per environment
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rater_groups') THEN
        ALTER TABLE public.rater_groups
        ADD CONSTRAINT rater_groups_environment_name_key
        UNIQUE (environment, name);
    END IF;
END $$;

-- ============================================================================
-- STEP 9: Drop the projects table
-- ============================================================================

DROP TABLE IF EXISTS public.projects CASCADE;

-- ============================================================================
-- STEP 10: Update table statistics
-- ============================================================================

ANALYZE public.data_records;
ANALYZE public.ingest_jobs;
ANALYZE public.analytics_jobs;
ANALYZE public.audit_logs;
ANALYZE public.candidate_status;

-- Analyze tables that exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rater_groups') THEN
        ANALYZE public.rater_groups;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'assignment_batches') THEN
        ANALYZE public.assignment_batches;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'llm_evaluation_jobs') THEN
        ANALYZE public.llm_evaluation_jobs;
    END IF;
END $$;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- The Project table has been removed and all projectId references have been
-- replaced with environment TEXT columns. Existing data has been migrated
-- by extracting environment from metadata fields or project names.
--
-- Next steps:
-- 1. Update Prisma schema to remove Project model and add environment fields
-- 2. Regenerate Prisma Client: npm run postinstall
-- 3. Update application code to use environment instead of projectId
-- ============================================================================
