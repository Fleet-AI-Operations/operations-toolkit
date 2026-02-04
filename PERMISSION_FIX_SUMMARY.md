# Permission Issue Fix - RLS Circular Dependency

## Problem

ADMIN and MANAGER users were getting USER permissions in production due to a **circular dependency in the Row Level Security (RLS) policy** for the `profiles` table.

### Root Cause

The RLS policy for viewing profiles was trying to query the profiles table FROM WITHIN the profiles RLS check:

```sql
CREATE POLICY "Users can view profiles"
  ON public.profiles
  FOR SELECT
  USING (
    (id = (select auth.uid()))
    OR
    -- ❌ CIRCULAR DEPENDENCY: Queries profiles from within profiles RLS policy
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = ANY (ARRAY['MANAGER'::"UserRole", 'ADMIN'::"UserRole"])
    )
  );
```

When Supabase tried to check if a user could read from `profiles`, it needed to determine if they were a MANAGER/ADMIN, which required reading from `profiles`, which triggered RLS again... causing the query to fail or return null.

When the profile query failed, application code defaulted to `'USER'`:

```typescript
const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { role: true }
});
const role = profile?.role || 'USER';  // ❌ Defaults to USER when RLS blocks query
```

## Solution

Created a `SECURITY DEFINER` function that bypasses RLS to check user roles, breaking the circular dependency:

```sql
-- SECURITY DEFINER allows this function to bypass RLS
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

-- Updated policy uses the function instead of direct query
CREATE POLICY "Users can view profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    (id = (select auth.uid()))
    OR
    public.is_manager_or_admin()  -- ✅ Uses SECURITY DEFINER function
  );
```

## Files Changed

### 1. New Migration
- **File**: `supabase/migrations/20260203000003_fix_profile_rls_circular_dependency.sql`
- **Purpose**: Creates `is_manager_or_admin()` function and updates profiles RLS policy
- **Impact**: Fixes permission issues in local development

### 2. Production Setup
- **File**: `supabase/setup.sql`
- **Changes**:
  - Added `is_manager_or_admin()` function
  - Updated profiles RLS policies to use SECURITY DEFINER functions
  - Fixed audit_logs RLS policy (had same circular dependency issue)
- **Impact**: Ensures production deployments work correctly

## Testing

Verified locally that:
1. ✅ Migration applies successfully
2. ✅ RLS policy uses `is_manager_or_admin()` function
3. ✅ Function is correctly defined as `SECURITY DEFINER`
4. ✅ ADMIN users can query their own profile
5. ✅ ADMIN users can query all profiles

## Deployment Instructions

### Local Development
1. Reset database to apply migration:
   ```bash
   npm run dev:reset
   ```

### Production (Vercel + Supabase Cloud)
1. Run the migration SQL in Supabase Dashboard SQL Editor:
   ```sql
   -- Copy contents of supabase/migrations/20260203000003_fix_profile_rls_circular_dependency.sql
   ```

2. Or use Supabase CLI:
   ```bash
   supabase db push
   ```

### Docker
The `supabase/setup.sql` file has been updated, so new Docker deployments will include the fix automatically.

## Impact on Application Code

The existing `|| 'USER'` fallbacks throughout the codebase should now **never trigger** because the RLS policies work correctly. These fallbacks remain in place as defensive programming but should no longer mask permission issues.

Affected files (no changes needed, fallbacks remain for safety):
- `src/hooks/useRoleCheck.ts`
- `src/components/Header.tsx`
- `src/app/layout.tsx`
- `src/app/api/projects/route.ts`
- `src/app/api/ingest/csv/route.ts`
- `src/app/api/ingest/api/route.ts`
- `src/app/api/records/route.ts`
- `src/app/api/records/topbottom-review/route.ts`
- `src/app/api/records/topbottom-review/update/route.ts`
- `src/app/api/analysis/compare/route.ts`

## Related Issues

This fix also resolves the same circular dependency in:
- `audit_logs` table RLS policy (updated in `setup.sql`)
- Any other policies that tried to query `profiles` to check roles

## Prevention

To avoid this issue in the future:
1. **Never query a table from within its own RLS policy** - this creates circular dependencies
2. **Use SECURITY DEFINER functions** for role checks that need to bypass RLS
3. **Test RLS policies** with actual role-based users, not just the postgres superuser
4. **Monitor for `|| 'USER'` fallbacks** being triggered unexpectedly
