-- Add indexes for foreign keys to improve JOIN and query performance
-- These were flagged by Supabase's performance linter

-- Analytics Jobs - projectId foreign key
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'analytics_jobs'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_analytics_jobs_project_id
        ON public.analytics_jobs("projectId");
    END IF;
END $$;

-- Assignment Batches - createdById foreign key
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'assignment_batches'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_assignment_batches_created_by
        ON public.assignment_batches("createdById");
    END IF;
END $$;

-- Bonus Windows - created_by foreign key
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'bonus_windows'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_bonus_windows_created_by
        ON public.bonus_windows(created_by);
    END IF;
END $$;

-- Data Records - projectId foreign key
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'data_records'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_data_records_project_id
        ON public.data_records("projectId");
    END IF;
END $$;

-- Ingest Jobs - projectId foreign key
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'ingest_jobs'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_ingest_jobs_project_id
        ON public.ingest_jobs("projectId");
    END IF;
END $$;
