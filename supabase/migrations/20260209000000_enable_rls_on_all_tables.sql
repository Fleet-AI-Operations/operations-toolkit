-- Enable RLS on Prisma-managed tables
-- This is required by Supabase best practices even though we use Prisma for data access
-- These tables are accessed server-side via Prisma, not via Supabase PostgREST
--
-- Note: Other tables (bonus_windows, audit_logs, bug_reports, likert_scores, cross_encoder_cache)
-- already have RLS enabled with appropriate policies from previous migrations

-- Enable RLS on all tables
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingest_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rater_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rater_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_model_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_evaluation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;

-- Create restrictive RLS policies (deny all by default)
-- Since we use Prisma with service role credentials, these policies won't affect our app
-- They only protect against accidental PostgREST API access

-- System Settings: Only service role can access
CREATE POLICY "system_settings_service_role_only" ON public.system_settings
  FOR ALL USING (false);

-- Analytics Jobs: Only service role can access
CREATE POLICY "analytics_jobs_service_role_only" ON public.analytics_jobs
  FOR ALL USING (false);

-- Projects: Only service role can access
CREATE POLICY "projects_service_role_only" ON public.projects
  FOR ALL USING (false);

-- Data Records: Only service role can access
CREATE POLICY "data_records_service_role_only" ON public.data_records
  FOR ALL USING (false);

-- Ingest Jobs: Only service role can access
CREATE POLICY "ingest_jobs_service_role_only" ON public.ingest_jobs
  FOR ALL USING (false);

-- Candidate Status: Only service role can access
CREATE POLICY "candidate_status_service_role_only" ON public.candidate_status
  FOR ALL USING (false);

-- Rater Groups: Only service role can access
CREATE POLICY "rater_groups_service_role_only" ON public.rater_groups
  FOR ALL USING (false);

-- Rater Group Members: Only service role can access
CREATE POLICY "rater_group_members_service_role_only" ON public.rater_group_members
  FOR ALL USING (false);

-- Assignment Batches: Only service role can access
CREATE POLICY "assignment_batches_service_role_only" ON public.assignment_batches
  FOR ALL USING (false);

-- Assignment Records: Only service role can access
CREATE POLICY "assignment_records_service_role_only" ON public.assignment_records
  FOR ALL USING (false);

-- LLM Model Configs: Only service role can access
CREATE POLICY "llm_model_configs_service_role_only" ON public.llm_model_configs
  FOR ALL USING (false);

-- LLM Evaluation Jobs: Only service role can access
CREATE POLICY "llm_evaluation_jobs_service_role_only" ON public.llm_evaluation_jobs
  FOR ALL USING (false);

-- Prisma Migrations: Only service role can access
CREATE POLICY "prisma_migrations_service_role_only" ON public._prisma_migrations
  FOR ALL USING (false);
