-- Fix circular dependency in RLS policies
-- Multiple policies were querying the profiles table from within their RLS checks,
-- causing potential circular dependencies and permission failures for ADMIN/MANAGER users.
--
-- Solution: Create SECURITY DEFINER functions that bypass RLS for role checks

-- ============================================================================
-- HELPER FUNCTIONS (SECURITY DEFINER bypasses RLS)
-- ============================================================================

-- Check if current user is MANAGER or ADMIN
-- SECURITY DEFINER allows this function to bypass RLS and read profiles directly
CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = ANY (ARRAY['MANAGER'::"UserRole", 'ADMIN'::"UserRole"])
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PROFILES TABLE - FIX RLS POLICY
-- ============================================================================

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;

-- Recreate with no circular dependency
-- Users can view their own profile OR are a manager/admin (via SECURITY DEFINER function)
CREATE POLICY "Users can view profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    -- User viewing their own profile
    (id = (select auth.uid()))
    OR
    -- User is a manager or admin (SECURITY DEFINER function bypasses RLS)
    public.is_manager_or_admin()
  );

-- ============================================================================
-- BUG_REPORTS TABLE - FIX RLS POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view bug reports" ON public.bug_reports;
DROP POLICY IF EXISTS "Admins can update bug reports" ON public.bug_reports;

-- Recreate SELECT policy with SECURITY DEFINER function
CREATE POLICY "Users can view bug reports"
  ON public.bug_reports
  FOR SELECT
  TO authenticated
  USING (
    -- User viewing their own bug report
    (user_id = (select auth.uid()))
    OR
    -- User is a manager or admin (SECURITY DEFINER function bypasses RLS)
    public.is_manager_or_admin()
  );

-- Recreate UPDATE policy with SECURITY DEFINER function
CREATE POLICY "Admins can update bug reports"
  ON public.bug_reports
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- BONUS_WINDOWS TABLE - FIX RLS POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Managers and Admins can view all bonus windows" ON public.bonus_windows;
DROP POLICY IF EXISTS "Managers and Admins can create bonus windows" ON public.bonus_windows;
DROP POLICY IF EXISTS "Managers and Admins can update bonus windows" ON public.bonus_windows;
DROP POLICY IF EXISTS "Managers and Admins can delete bonus windows" ON public.bonus_windows;

-- Recreate all policies with SECURITY DEFINER function
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

-- ============================================================================
-- AUDIT_LOGS TABLE - FIX RLS POLICY
-- ============================================================================

-- Drop existing policy
DROP POLICY IF EXISTS "Admins can read all audit logs" ON public.audit_logs;

-- Recreate with SECURITY DEFINER function
CREATE POLICY "Admins can read all audit logs"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin());
