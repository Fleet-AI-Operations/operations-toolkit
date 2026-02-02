# Troubleshooting Guide

Common issues, error messages, and their solutions for the Operations Tools.

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Installation & Setup](#installation--setup)
- [Database Issues](#database-issues)
- [Authentication Problems](#authentication-problems)
- [Ingestion Errors](#ingestion-errors)
- [AI Service Issues](#ai-service-issues)
- [Performance Problems](#performance-problems)
- [Testing Issues](#testing-issues)
- [Deployment Problems](#deployment-problems)
- [Getting Help](#getting-help)

---

## Quick Diagnostics

### Health Check

Visit the status endpoint to check system health:

```bash
curl http://localhost:3000/api/status
```

Expected response:
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Check Logs

```bash
# Development server logs
npm run dev

# Supabase logs
supabase status
supabase logs

# Database logs
supabase logs db
```

---

## Installation & Setup

### Problem: `npm install` Fails

**Error**: `ERESOLVE unable to resolve dependency tree`

**Solution**:
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall
npm install
```

---

### Problem: Prisma Client Not Generated

**Error**: `Cannot find module '@prisma/client'`

**Solution**:
```bash
# Generate Prisma Client
npm run postinstall

# Or manually
npx prisma generate
```

---

### Problem: Supabase Won't Start

**Error**: `Error starting Supabase services`

**Symptoms**:
- Port 54322 already in use
- Docker not running
- Supabase CLI not installed

**Solutions**:

**Check if ports are in use**:
```bash
lsof -i :54322  # PostgreSQL
lsof -i :54321  # Supabase API
lsof -i :54323  # Studio
```

**Stop conflicting services**:
```bash
# Stop existing Supabase
supabase stop

# Kill process on port
kill -9 $(lsof -t -i:54322)
```

**Install/Update Supabase CLI**:
```bash
# macOS
brew install supabase/tap/supabase
brew upgrade supabase

# Other OS
https://supabase.com/docs/guides/cli
```

**Ensure Docker is running**:
```bash
docker --version
docker ps
```

---

### Problem: Environment Variables Not Loading

**Error**: `Database connection string not found`

**Solution**:

1. **Check file exists**:
   ```bash
   ls -la .env.local .env.test
   ```

2. **Verify format** (no quotes around values):
   ```bash
   DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
   # NOT: DATABASE_URL="postgresql://..."
   ```

3. **Restart dev server**:
   ```bash
   # Stop server (Ctrl+C)
   npm run dev
   ```

---

## Database Issues

### Problem: Connection Refused

**Error**: `Error: connect ECONNREFUSED 127.0.0.1:54322`

**Cause**: Database not running

**Solution**:
```bash
# Start Supabase
npm run dev:supabase

# Verify it's running
supabase status
```

Expected output:
```
API URL: http://127.0.0.1:54321
DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio URL: http://localhost:54323
```

---

### Problem: Migration Errors

**Error**: `Migration failed: relation "xyz" does not exist`

**Solution**:

```bash
# Reset database and rerun all migrations
npm run dev:reset

# If that doesn't work, stop and restart Supabase
supabase stop
supabase start
```

---

### Problem: Prisma Client Out of Sync

**Error**: `The table does not exist in the current database`

**Cause**: Prisma schema doesn't match database

**Solution**:
```bash
# Pull schema from database
npx prisma db pull

# Generate client
npm run postinstall

# If issues persist, reset and regenerate
npm run dev:reset
npm run postinstall
```

---

### Problem: Database Timeout

**Error**: `Error: Query timed out after 10000ms`

**Causes**:
- Large dataset query without pagination
- Missing index on queried column
- Database under heavy load

**Solutions**:

**Add pagination**:
```typescript
// Bad: Loads all records
const records = await prisma.dataRecord.findMany();

// Good: Paginated
const records = await prisma.dataRecord.findMany({
  take: 20,
  skip: offset
});
```

**Check for missing indexes**:
```sql
-- View table indexes
SELECT * FROM pg_indexes WHERE tablename = 'data_records';
```

**Increase timeout** (temporary):
```typescript
const records = await prisma.dataRecord.findMany({
  // ... query
}, {
  timeout: 30000 // 30 seconds
});
```

---

## Authentication Problems

### Problem: Can't Log In

**Error**: `Invalid login credentials`

**Solutions**:

1. **Verify user exists**:
   ```bash
   # Open Supabase Studio
   npm run dev:studio

   # Navigate to Authentication → Users
   # Check if user email exists
   ```

2. **Check auth configuration**:
   ```bash
   # Verify SUPABASE_* env vars are set
   cat .env.local | grep SUPABASE
   ```

3. **Reset password** (admin only):
   - Use Admin → User Management page
   - Click "Reset Password" for the user

---

### Problem: Session Expires Immediately

**Symptoms**:
- Log in successful but immediately logged out
- Every page refresh logs you out

**Cause**: Cookie configuration issue

**Solutions**:

1. **Check browser cookies**:
   - Open DevTools → Application → Cookies
   - Look for `sb-*` cookies
   - Clear all site cookies and try again

2. **Verify middleware**:
   ```bash
   # Check src/middleware.ts exists and is valid
   cat src/middleware.ts
   ```

3. **Check Supabase client config**:
   ```bash
   # Verify server.ts creates client correctly
   cat src/lib/supabase/server.ts
   ```

---

### Problem: "Insufficient Permissions" Error

**Error**: `403 Forbidden - Insufficient permissions`

**Cause**: User role doesn't have access to requested resource

**Solution**:

1. **Check your role**:
   - Click your email in top-right
   - View profile dropdown
   - See current role (USER, MANAGER, ADMIN)

2. **Request role upgrade** (contact admin):
   - USER → Can read data, generate analyses
   - MANAGER → USER + Time tracking & bonus windows
   - ADMIN → MANAGER + User management, settings

3. **Admin can update roles**:
   - Navigate to Admin → User Management
   - Find user and change role

---

## Ingestion Errors

### Problem: CSV Upload Fails

**Error**: `Invalid CSV format`

**Common Causes**:

1. **Missing required columns**:
   ```csv
   # Bad: Missing 'content' or 'rating'
   task_id,description

   # Good: Has both content and rating
   task_id,content,rating
   task-1,The task content,top 10
   ```

2. **Malformed CSV**:
   ```csv
   # Bad: Unclosed quote
   task-1,"Content with "quote,top 10

   # Good: Properly escaped
   task-1,"Content with ""quote""",top 10
   ```

3. **Wrong encoding**:
   - Ensure file is UTF-8 encoded
   - Convert if needed: `iconv -f LATIN1 -t UTF-8 file.csv > file_utf8.csv`

---

### Problem: Records Stuck in "Waiting for AI"

**Status**: `QUEUED_FOR_VEC`

**Cause**: AI service not processing embeddings

**Solutions**:

1. **Check AI service**:
   ```bash
   # LM Studio: Ensure server is running on port 1234
   curl http://localhost:1234/v1/models

   # OpenRouter: Check API key
   curl https://openrouter.ai/api/v1/models \
     -H "Authorization: Bearer $OPENROUTER_API_KEY"
   ```

2. **Restart vectorization**:
   - Cancel current job: Click "Stop Ingest"
   - Re-upload CSV with "Generate Embeddings" checked

3. **Check logs**:
   ```bash
   # Look for AI service errors
   npm run dev  # Check console output
   ```

---

### Problem: Duplicate Records Skipped

**Status**: Job shows high `skippedCount`

**Cause**: Records with duplicate IDs already exist

**This is normal behavior** to prevent duplicates.

**To view skip details**:
1. Check ingestion job status
2. View `skippedDetails` field
3. See breakdown: `{"Duplicate ID": 150}`

**If you need to re-ingest**:
1. Delete existing records first (Admin only)
2. Or use different task_id/feedback_id values

---

### Problem: Ingestion Very Slow

**Symptoms**:
- Phase 1 (PROCESSING) slow
- Phase 2 (VECTORIZING) very slow

**Solutions**:

**Phase 1 slow (data loading)**:
- Check database connection speed
- Reduce batch size if large dataset
- Ensure no other heavy queries running

**Phase 2 slow (vectorization)**:
- **LM Studio**: Enable GPU acceleration
  - Settings → Hardware → Use GPU
  - Restart LM Studio
- **OpenRouter**: Normal, cloud API rate limits apply
- **Check model size**: Smaller models = faster embeddings

---

## AI Service Issues

### Problem: LM Studio Not Responding

**Error**: `AI service unavailable` or `fetch failed`

**Solutions**:

1. **Verify LM Studio is running**:
   ```bash
   # Check if port 1234 is listening
   lsof -i :1234

   # Test endpoint
   curl http://localhost:1234/v1/models
   ```

2. **Check model loaded**:
   - Open LM Studio
   - Ensure both LLM and Embedding models are loaded
   - Start server (play button)

3. **Verify environment config**:
   ```bash
   # Check .env.local
   cat .env.local | grep AI

   # Should have:
   AI_HOST=http://localhost:1234/v1
   LLM_MODEL=llama-3.1-8b
   EMBEDDING_MODEL=nomic-embed-text
   ```

---

### Problem: OpenRouter Quota Exceeded

**Error**: `Insufficient credits` or `402 Payment Required`

**Solution**:

1. **Check balance**:
   - Visit https://openrouter.ai/credits
   - Or check dashboard header (Admin only)

2. **Add credits**:
   - Purchase at https://openrouter.ai/credits
   - Minimum: $5

3. **Switch to LM Studio** (free):
   ```bash
   # Update .env.local
   AI_PROVIDER=lmstudio
   AI_HOST=http://localhost:1234/v1
   ```

---

### Problem: "Last token is not SEP" Warning

**Warning**: `[Embeddings] last token is not SEP`

**Cause**: Empty or malformed input to embedding model

**Solution**: This is automatically handled by the code. No action needed.

**Why it happens**:
- CSV has rows with empty content
- Code sanitizes input to prevent this
- Warning is logged but doesn't break functionality

---

## Performance Problems

### Problem: Dashboard Slow to Load

**Symptoms**:
- Long wait for data to appear
- UI freezes during loading

**Solutions**:

1. **Check record count**:
   ```sql
   -- Count records per project
   SELECT projectId, COUNT(*)
   FROM data_records
   GROUP BY projectId;
   ```

2. **Add pagination** (if > 1000 records):
   - Records page already has pagination
   - Increase `limit` parameter if needed

3. **Optimize embeddings**:
   - Large embedding arrays slow JSON serialization
   - Consider excluding embeddings from list views:
     ```typescript
     select: {
       id: true,
       content: true,
       // embedding: true  // Exclude this
     }
     ```

---

### Problem: Alignment Generation Slow

**Symptoms**:
- "Generate Alignment Score" takes > 30 seconds
- Sometimes times out

**Causes**:
- Large guidelines PDF
- Complex LLM prompt
- Slow AI model

**Solutions**:

1. **Use faster model**:
   - LM Studio: Try smaller model (7B vs 70B)
   - OpenRouter: Try faster model (GPT-3.5 vs GPT-4)

2. **Optimize guidelines PDF**:
   - Keep PDF under 50 pages
   - Remove images/graphics (text only)
   - Ensure good OCR quality

3. **Enable GPU** (LM Studio):
   - Settings → Hardware → Use GPU
   - Requires NVIDIA GPU with CUDA

---

## Testing Issues

### Problem: Tests Fail with "Database not found"

**Error**: `PrismaClientKnownRequestError: Database not found`

**Solution**:

```bash
# Ensure Supabase is running
npm run dev:supabase

# Verify .env.test points to correct database
cat .env.test | grep DATABASE_URL

# Should be:
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres

# Run tests again
npm test
```

---

### Problem: E2E Tests Fail with "Browser not installed"

**Error**: `Executable doesn't exist at .../chrome-headless-shell`

**Solution**:

```bash
# Install Playwright browsers
npx playwright install

# Or install specific browser
npx playwright install chromium
```

---

### Problem: Tests Pass Locally but Fail in CI

**Common Causes**:

1. **Environment variables missing**:
   - Add secrets to CI (GitHub Actions, etc.)
   - Ensure `.env.test` is committed to git

2. **Database not running**:
   - CI needs Supabase or PostgreSQL service
   - Add database service to CI config

3. **Timing issues**:
   - Increase timeouts in CI
   - Add explicit waits in E2E tests

---

## Deployment Problems

### Problem: Vercel Deployment Fails

**Error**: `Build failed` or `Module not found`

**Solutions**:

1. **Check environment variables**:
   - Vercel Dashboard → Project → Settings → Environment Variables
   - Ensure all required vars from `.env.example` are set

2. **Verify build command**:
   ```json
   // vercel.json or package.json
   {
     "scripts": {
       "build": "npx prisma generate && next build"
     }
   }
   ```

3. **Check function size**:
   - Vercel has 50MB limit for serverless functions
   - Large node_modules can exceed this
   - Use `output: 'standalone'` in next.config.js

---

### Problem: Database Connection Fails in Production

**Error**: `Can't reach database server`

**Solutions**:

1. **Verify connection string**:
   - Vercel env vars → Check `DATABASE_URL`
   - Should be Supabase Cloud URL (not localhost)

2. **Check Supabase Cloud project**:
   - Ensure project is running (not paused)
   - Check IP restrictions (if any)

3. **Test connection**:
   ```bash
   # From your local machine
   psql "postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"
   ```

---

### Problem: Authentication Breaks After Deployment

**Symptoms**:
- Can't log in on deployed site
- Session doesn't persist

**Solutions**:

1. **Update Supabase Auth URLs**:
   - Supabase Dashboard → Authentication → URL Configuration
   - Add production URL: `https://your-app.vercel.app`

2. **Verify environment variables**:
   ```bash
   # Ensure these match your Supabase Cloud project
   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJhbG...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
   ```

---

## Getting Help

### Before Asking for Help

1. **Check logs**:
   ```bash
   # Development
   npm run dev  # Console output

   # Production (Vercel)
   vercel logs <deployment-url>
   ```

2. **Try in incognito/private mode**:
   - Rules out browser cache/cookies issues

3. **Check browser console**:
   - F12 → Console tab
   - Look for red errors
   - Copy full error message

4. **Verify versions**:
   ```bash
   node --version  # Should be 18+
   npm --version
   npx supabase --version
   ```

### Reporting Issues

Include this information:

1. **Environment**:
   - OS (Mac/Windows/Linux)
   - Node version
   - Local dev or production?

2. **Steps to reproduce**:
   - What did you do?
   - What happened?
   - What did you expect?

3. **Error messages**:
   - Full error text (not screenshot)
   - Browser console errors
   - Server logs

4. **What you tried**:
   - List troubleshooting steps already attempted

### Community Resources

- **Documentation**: `/Documentation` folder
- **GitHub Issues**: Report bugs and feature requests
- **API Reference**: `Documentation/Reference/API_REFERENCE.md`
- **Database Schema**: `Documentation/Reference/DATABASE_SCHEMA.md`

---

## Advanced Debugging

### Enable Prisma Query Logging

```typescript
// prisma.config.ts
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
```

### Enable Verbose AI Logging

Already enabled in `src/lib/ai.ts`. Check console for:
```
[Embeddings] Provider config: ...
[Embeddings] Requesting 10 embeddings...
[Embeddings] Received 10/10 valid embeddings
```

### Database Query Performance

```sql
-- Show slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
WHERE mean_time > 1000  -- Queries taking > 1 second
ORDER BY mean_time DESC
LIMIT 20;
```

### Memory Profiling

```bash
# Check Node.js memory usage
node --max-old-space-size=4096 node_modules/.bin/next dev

# Monitor during operation
node --inspect node_modules/.bin/next dev
# Then open chrome://inspect
```

---

*This guide is continuously updated. If you encounter an issue not listed here, please report it so we can add it!*
