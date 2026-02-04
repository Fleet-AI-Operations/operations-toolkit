-- Fix circular dependency in profiles RLS policy
-- The policy was trying to query profiles table from within the profiles RLS check,
-- causing infinite recursion and permission failures for ADMIN/MANAGER users.
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
