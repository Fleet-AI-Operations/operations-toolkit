-- Enable RLS on Prisma-managed tables
-- This is required by Supabase best practices even though we use Prisma for data access
-- These tables are accessed server-side via Prisma, not via Supabase PostgREST
--
-- Note: Other tables (bonus_windows, audit_logs, bug_reports, likert_scores, cross_encoder_cache)
-- already have RLS enabled with appropriate policies from previous migrations

-- Function to conditionally enable RLS and create policy if table exists
DO $$
DECLARE
  table_name text;
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
  FOREACH table_name IN ARRAY table_names
  LOOP
    -- Check if table exists
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = table_name
    ) THEN
      -- Enable RLS
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);

      -- Create restrictive policy (only if it doesn't exist)
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = table_name
        AND policyname = table_name || '_service_role_only'
      ) THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR ALL USING (false)',
          table_name || '_service_role_only',
          table_name
        );
      END IF;

      RAISE NOTICE 'Enabled RLS and created policy for table: %', table_name;
    ELSE
      RAISE NOTICE 'Skipping table (does not exist): %', table_name;
    END IF;
  END LOOP;
END $$;
