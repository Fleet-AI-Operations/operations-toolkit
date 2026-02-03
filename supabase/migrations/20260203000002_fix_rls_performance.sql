-- Fix RLS performance issues identified by Supabase linter
-- 1. Wrap auth.uid() calls in subqueries to prevent re-evaluation per row
-- 2. Combine multiple permissive policies into single policies
-- 3. Maintain proper access control: USERS see own data, MANAGERS/ADMINS see all
-- 4. Add WITH CHECK clauses to UPDATE policies for completeness
-- 5. Optimize is_admin() helper function

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Helper function to check if user is admin
-- SECURITY DEFINER allows this function to bypass RLS, preventing infinite recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND role = 'ADMIN'::"UserRole"
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Helper function to check if user is manager or admin
-- SECURITY DEFINER allows this function to bypass RLS, preventing infinite recursion
CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND role = ANY (ARRAY['MANAGER'::"UserRole", 'ADMIN'::"UserRole"])
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "All users can view profiles" ON public.profiles;

-- Combined SELECT policy (fixes multiple permissive policies warning)
-- Users can view their own profile, managers/admins can view all
-- Uses helper function to avoid infinite recursion
CREATE POLICY "Users can view profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    -- User viewing their own profile
    (id = (select auth.uid()))
    OR
    -- User is a manager or admin (can view all profiles)
    -- Use SECURITY DEFINER function to bypass RLS and prevent recursion
    public.is_manager_or_admin()
  );

-- Separate policies for INSERT, UPDATE, DELETE (admin only)
CREATE POLICY "Admins can insert profiles"
  ON public.profiles
  FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update profiles"
  ON public.profiles
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete profiles"
  ON public.profiles
  FOR DELETE
  USING (public.is_admin());

-- ============================================================================
-- AUDIT_LOGS TABLE
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can read all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;

-- Recreate SELECT policy using helper function
CREATE POLICY "Admins can read all audit logs"
  ON public.audit_logs
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Allow all authenticated users to insert audit logs
CREATE POLICY "Authenticated users can insert audit logs"
  ON public.audit_logs
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- BUG_REPORTS TABLE
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view all bug reports" ON public.bug_reports;
DROP POLICY IF EXISTS "Users can view own bug reports" ON public.bug_reports;
DROP POLICY IF EXISTS "Users can create bug reports" ON public.bug_reports;
DROP POLICY IF EXISTS "Admins can update bug reports" ON public.bug_reports;
DROP POLICY IF EXISTS "Users can view bug reports" ON public.bug_reports;
DROP POLICY IF EXISTS "All users can view bug reports" ON public.bug_reports;

-- Combined SELECT policy (fixes multiple permissive policies warning)
-- Users can view their own bug reports, managers/admins can view all
-- Uses helper function to avoid potential recursion issues
CREATE POLICY "Users can view bug reports"
  ON public.bug_reports
  FOR SELECT
  TO authenticated
  USING (
    -- User viewing their own bug report
    (user_id = (select auth.uid()))
    OR
    -- User is a manager or admin (can view all bug reports)
    public.is_manager_or_admin()
  );

-- Allow all authenticated users to create bug reports
CREATE POLICY "Users can create bug reports"
  ON public.bug_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Recreate update policy using helper function with WITH CHECK clause
CREATE POLICY "Admins can update bug reports"
  ON public.bug_reports
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- LIKERT_SCORES TABLE
-- ============================================================================

-- Drop existing UPDATE policy
-- Note: Application only uses INSERT and SELECT operations on likert_scores
-- No UPDATE policy is needed, removing it eliminates unnecessary security exposure
DROP POLICY IF EXISTS "Users can update own likert scores" ON public.likert_scores;
DROP POLICY IF EXISTS "Users can update any likert scores" ON public.likert_scores;

-- ============================================================================
-- BONUS_WINDOWS TABLE (if it exists)
-- ============================================================================

-- Only update bonus_windows policies if the table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'bonus_windows'
  ) THEN
    -- Drop existing policies
    DROP POLICY IF EXISTS "Managers and Admins can view all bonus windows" ON public.bonus_windows;
    DROP POLICY IF EXISTS "Managers and Admins can create bonus windows" ON public.bonus_windows;
    DROP POLICY IF EXISTS "Managers and Admins can update bonus windows" ON public.bonus_windows;
    DROP POLICY IF EXISTS "Managers and Admins can delete bonus windows" ON public.bonus_windows;

    -- Recreate with helper function to avoid recursion
    CREATE POLICY "Managers and Admins can view all bonus windows"
      ON public.bonus_windows
      FOR SELECT
      TO authenticated
      USING (public.is_manager_or_admin());

    CREATE POLICY "Managers and Admins can create bonus windows"
      ON public.bonus_windows
      FOR INSERT
      TO authenticated
      WITH CHECK (public.is_manager_or_admin());

    CREATE POLICY "Managers and Admins can update bonus windows"
      ON public.bonus_windows
      FOR UPDATE
      TO authenticated
      USING (public.is_manager_or_admin())
      WITH CHECK (public.is_manager_or_admin());

    CREATE POLICY "Managers and Admins can delete bonus windows"
      ON public.bonus_windows
      FOR DELETE
      TO authenticated
      USING (public.is_manager_or_admin());
  END IF;
END $$;
