-- Enable RLS on Prisma-managed tables
-- This is required by Supabase best practices even though we use Prisma for data access
-- These tables are accessed server-side via Prisma, not via Supabase PostgREST
--
-- Note: Other tables (bonus_windows, audit_logs, bug_reports, likert_scores, cross_encoder_cache)
-- already have RLS enabled with appropriate policies from previous migrations

-- Function to conditionally enable RLS and create policy if table exists
DO $$
DECLARE
  tbl_name text;
  table_names text[] := ARRAY[
    'system_settings',
    'analytics_jobs',
    'projects',
    'data_records',
    'ingest_jobs',
    'candidate_status',
    'rater_groups',
    'rater_group_members',
    'assignment_batches',
    'assignment_records',
    'llm_model_configs',
    'llm_evaluation_jobs',
    '_prisma_migrations'
  ];
BEGIN
  FOREACH tbl_name IN ARRAY table_names
  LOOP
    -- Check if table exists
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = tbl_name
    ) THEN
      -- Enable RLS
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl_name);

      -- Create restrictive policy (only if it doesn't exist)
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = tbl_name
        AND policyname = tbl_name || '_service_role_only'
      ) THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR ALL USING (false)',
          tbl_name || '_service_role_only',
          tbl_name
        );
      END IF;

      RAISE NOTICE 'Enabled RLS and created policy for table: %', tbl_name;
    ELSE
      RAISE NOTICE 'Skipping table (does not exist): %', tbl_name;
    END IF;
  END LOOP;
END $$;
