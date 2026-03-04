-- ============================================================================
-- Fix mutable search_path on update_meetings_updated_at (FLEOTK-12)
--
-- The update_meetings_updated_at function was created in
-- 20260227000002_create_meetings_table.sql — after the previous security-fix
-- migration (20260226000001_fix_security_warnings.sql) had already run.
-- This migration applies the same search_path hardening to it.
-- ============================================================================
ALTER FUNCTION public.update_meetings_updated_at() SET search_path = '';
