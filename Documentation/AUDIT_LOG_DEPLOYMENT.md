# Audit Log System - Production Deployment Guide

This guide covers deploying the audit log system to production (Supabase Cloud + Vercel).

## Prerequisites

- Access to Supabase Dashboard for your production project
- Vercel CLI configured (`vercel login`)
- Database backup (recommended before any schema changes)

## Deployment Steps

### Option 1: Using Supabase CLI (Recommended)

This is the safest approach as it uses the migration file directly.

```bash
# 1. Link to your production project (if not already linked)
supabase link --project-ref your-project-ref

# 2. Push the migration to production
supabase db push

# 3. Verify the migration was applied
supabase db diff
```

The CLI will show you what changes will be applied before executing them.

### Option 2: Using Supabase Dashboard (Manual)

If you prefer manual control or don't have CLI access:

1. **Navigate to SQL Editor**
   - Go to https://app.supabase.com/project/YOUR_PROJECT/sql
   - Click "New Query"

2. **Execute the Migration SQL**
   - Copy the contents of `supabase/migrations/20260201224100_create_audit_logs_table.sql`
   - Paste into the SQL editor
   - Click "Run" to execute

3. **Verify Table Creation**
   - Go to Table Editor
   - Confirm `audit_logs` table exists with all columns
   - Check "Indexes" tab to verify all 5 indexes were created
   - Check "Policies" tab to verify RLS policies are active

### Option 3: For Fresh Production Setup (Docker/New Instances)

If deploying to a new production environment:

1. **Use setup.sql**
   - The `supabase/setup.sql` file now includes audit_logs
   - Run this file to set up all tables including audit logs
   - Execute via Supabase Dashboard SQL Editor

## Post-Deployment Steps

### 1. Verify Database Schema

```sql
-- Check table exists
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'audit_logs'
ORDER BY ordinal_position;

-- Verify indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'audit_logs';

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'audit_logs';

-- Verify policies
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'audit_logs';
```

Expected results:
- 9 columns (id, action, entity_type, entity_id, project_id, user_id, user_email, metadata, created_at)
- 5 performance indexes (plus primary key constraint)
- RLS enabled (rowsecurity = true)
- 2 policies (admin read, authenticated insert)

### 2. Deploy Application Code to Vercel

The application code changes are already committed. Deploy to production:

```bash
# From project root
vercel deploy --prod
```

Or push to your main branch if auto-deploy is configured:

```bash
git push origin main
```

### 3. Verify Prisma Client

Vercel will automatically regenerate Prisma Client during build due to the `postinstall` script in package.json. No manual action needed.

If you encounter issues, you can manually trigger:

```bash
npm run postinstall
```

### 4. Test in Production

After deployment, verify the audit log system is working:

1. **Test API Endpoint**
   ```bash
   curl -X GET https://your-app.vercel.app/api/audit-logs \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

   Should return 401 (unauthorized) or 403 (forbidden) if not admin, which confirms it's working.

2. **Test in Browser**
   - Log in as an admin user
   - Navigate to `/admin/audit-logs`
   - Verify the page loads without errors

3. **Generate Test Audit Logs**
   - Perform actions that trigger audit logs (e.g., create a user)
   - Check `/admin/audit-logs` to see if logs appear
   - Verify timestamps are correct (check timezone settings)

4. **Test Filters and Pagination**
   - Try different filter combinations
   - Navigate through pages if you have 50+ logs
   - Verify metadata displays correctly

## Rollback Procedure

If you need to rollback the audit log system:

### Quick Rollback (Disable Only)

```sql
-- Disable RLS policies (stops audit logging without data loss)
DROP POLICY IF EXISTS "Admins can read all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;
```

### Full Rollback (Remove Table)

```sql
-- Drop the entire table (WARNING: This deletes all audit logs)
DROP TABLE IF EXISTS public.audit_logs CASCADE;
```

Then redeploy the previous application version:

```bash
# Redeploy specific deployment
vercel rollback YOUR_DEPLOYMENT_URL

# Or revert git commit
git revert HEAD
git push origin main
```

## Troubleshooting

### Issue: Migration Fails with "relation already exists"

**Cause**: Table was partially created in a previous attempt

**Solution**:
```sql
-- Check if table exists
SELECT * FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'audit_logs';

-- If it exists but is incomplete, drop and recreate
DROP TABLE IF EXISTS public.audit_logs CASCADE;

-- Then re-run the migration
```

### Issue: RLS Policies Not Working

**Cause**: RLS may not be enabled or policies may not match user roles

**Solution**:
```sql
-- Verify RLS is enabled
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Check if policies exist
SELECT * FROM pg_policies WHERE tablename = 'audit_logs';

-- Recreate policies if needed (run the policy creation SQL)
```

### Issue: Audit Logs Not Appearing

**Cause**: Application code may not be calling the audit functions

**Checks**:
1. Verify `src/lib/audit.ts` was deployed
2. Check application logs for errors related to audit logging
3. Verify user authentication is working (audit requires authenticated users)
4. Check Vercel logs: `vercel logs YOUR_DEPLOYMENT_URL`

**Debug**:
```sql
-- Check if any logs are being created
SELECT COUNT(*), MAX(created_at)
FROM public.audit_logs;

-- Check recent logs
SELECT * FROM public.audit_logs
ORDER BY created_at DESC
LIMIT 10;
```

### Issue: "Permission denied" Errors

**Cause**: User doesn't have required permissions

**Solution**:
```sql
-- Verify the user's role
SELECT id, email, role
FROM public.profiles
WHERE email = 'user@example.com';

-- Grant admin role if needed
UPDATE public.profiles
SET role = 'ADMIN'
WHERE email = 'user@example.com';
```

## Monitoring & Maintenance

### Performance Monitoring

Monitor query performance on large audit log tables:

```sql
-- Check table size
SELECT
  pg_size_pretty(pg_total_relation_size('audit_logs')) as total_size,
  pg_size_pretty(pg_relation_size('audit_logs')) as table_size,
  pg_size_pretty(pg_indexes_size('audit_logs')) as indexes_size;

-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename = 'audit_logs'
ORDER BY idx_scan DESC;
```

### Data Retention Policy (Optional)

Consider implementing automatic cleanup for old audit logs:

```sql
-- Delete logs older than 1 year (run periodically)
DELETE FROM public.audit_logs
WHERE created_at < NOW() - INTERVAL '1 year';

-- Or archive to a separate table
CREATE TABLE IF NOT EXISTS public.audit_logs_archive (LIKE public.audit_logs INCLUDING ALL);

INSERT INTO public.audit_logs_archive
SELECT * FROM public.audit_logs
WHERE created_at < NOW() - INTERVAL '1 year';

DELETE FROM public.audit_logs
WHERE created_at < NOW() - INTERVAL '1 year';
```

To automate this, create a Supabase Edge Function or use pg_cron if available.

### Recommended Monitoring

Set up alerts for:
- Failed audit log insertions (check application logs)
- Table size growth (if growing too fast, review retention policy)
- Query performance degradation (if index scans decrease)

## Security Considerations

1. **Data Privacy**: Audit logs contain user emails and potentially sensitive metadata
   - Ensure compliance with GDPR/CCPA data retention requirements
   - Consider anonymizing user_email for deleted users

2. **Access Control**: Only admins can view audit logs
   - Regularly review who has ADMIN role
   - Consider logging changes to ADMIN role assignments

3. **Backup**: Audit logs are valuable for security investigations
   - Ensure they're included in your backup strategy
   - Test restore procedures

## Success Checklist

Before marking deployment as complete:

- [ ] Migration applied successfully in production
- [ ] Table visible in Supabase Dashboard
- [ ] All 6 indexes created
- [ ] RLS policies active
- [ ] Application deployed to Vercel
- [ ] No build errors
- [ ] Admin page loads at `/admin/audit-logs`
- [ ] API endpoint returns expected responses
- [ ] Test audit logs are being created
- [ ] Filters and pagination work
- [ ] No console errors in browser
- [ ] Rollback procedure documented and understood

## Support

If you encounter issues not covered in this guide:

1. Check Supabase logs: Project Settings → Logs
2. Check Vercel logs: `vercel logs --follow`
3. Review application logs for audit-related errors
4. Verify environment variables are set correctly
5. Test locally first with `npm run dev:reset` to ensure migrations work

## Related Files

- Migration: `supabase/migrations/20260201224100_create_audit_logs_table.sql`
- Setup Script: `supabase/setup.sql` (includes audit_logs for fresh installs)
- Audit Library: `src/lib/audit.ts`
- API Endpoint: `src/app/api/audit-logs/route.ts`
- Admin UI: `src/app/admin/audit-logs/page.tsx`
- Prisma Schema: `prisma/schema.prisma` (documentation only)
