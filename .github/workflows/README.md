# GitHub Actions Workflows

## Test Suite

The `test.yml` workflow runs the complete test suite on every push and pull request.

### What It Tests

1. **Linting** - Code style and quality checks
2. **Build** - Builds all 5 apps (user, qa, core, fleet, admin) in parallel
3. **Unit Tests** - Vitest tests across all packages
4. **E2E Tests** - Playwright end-to-end tests

### How It Works

1. **Triggers** on push to main, fix/*, feat/* branches and all pull requests
2. **Sets up environment**:
   - Node.js 20
   - pnpm 9 with caching for faster builds
   - Supabase CLI and local instance
   - Playwright browsers
3. **Runs tests** in CI environment with local Supabase
4. **Uploads artifacts**:
   - Playwright HTML report (available for 7 days)
   - Test results and coverage (available for 7 days)

### Environment

The workflow uses a local Supabase instance with standard demo credentials:
- Database: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- Supabase URL: `http://127.0.0.1:54321`
- Uses default Supabase demo JWT keys

No secrets required - all tests run against local Supabase.

### Viewing Test Results

When tests fail:
1. Go to Actions tab in GitHub
2. Click on the failed workflow run
3. Download the "playwright-report" or "test-results" artifacts
4. Unzip and open `index.html` for detailed test results

---

## Preview Database Seeding

The `seed-preview.yml` workflow automatically seeds test users into Supabase preview branch databases.

### How It Works

1. **Triggers** when you open/reopen a PR to main from preview/feature branches
2. **Finds** the preview project reference dynamically using Supabase API
3. **Deploys** database migrations to the preview database
4. **Enables seeding** by setting `app.seed_allowed = 'true'` on the preview database
5. **Seeds** the database with test users (admin, manager, user)
6. **Protects** production - refuses to run on main or production branches

### Setup Requirements

#### 1. GitHub Secrets

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

```
SUPABASE_ACCESS_TOKEN
```
- **What**: Personal access token from Supabase
- **Where to get**:
  1. Go to https://supabase.com/dashboard/account/tokens
  2. Create a new access token
  3. Copy and save as GitHub secret

```
SUPABASE_ORG_ID
```
- **What**: Your Supabase organization ID
- **Where to get**:
  1. Go to https://supabase.com/dashboard/org/_/general
  2. Copy the Organization ID
  3. Save as GitHub secret

```
SUPABASE_MAIN_PROJECT_REF
```
- **What**: Your main Supabase project reference (used to fetch branches)
- **Where to get**:
  1. Go to your main Supabase project settings
  2. Copy the Project Reference (looks like: `urgravakgxllrpsumgtz`)
  3. Save as GitHub secret

#### 2. Supabase Preview Branches

Enable preview branches in your Supabase project:

1. Go to your Supabase project settings
2. Navigate to **Branching** section
3. Enable **Preview Branches**
4. Connect your GitHub repository

### Dynamic Project Reference Lookup

The workflow automatically finds your preview database:

```bash
# 1. Fetches all projects in your organization
GET /v1/organizations/{org_id}/projects

# 2. Fetches branches from your main project
GET /v1/projects/{main_ref}/branches

# 3. Finds the branch matching your Git branch name
jq '.[] | select(.git_branch == "branch-name") | .project_ref'

# 4. Links to the preview project and deploys migrations
supabase link --project-ref {branch_ref}
supabase db push

# 5. Enables seeding for the preview database
POST /v1/projects/{branch_ref}/database/query
{"query": "ALTER DATABASE postgres SET app.seed_allowed = 'true';"}

# 6. Executes seed SQL on the remote database via Management API
POST /v1/projects/{branch_ref}/database/query
```

### Workflow Behavior

The workflow triggers in two ways:

**1. Automatic (PR Events)**
- Triggers when a PR is **opened** or **reopened** targeting `main`
- Seeds the preview database for the PR source branch
- Never runs for PRs from `main` or `production` branches

**2. Manual (Workflow Dispatch)**
- Can be manually triggered from GitHub Actions tab
- Optionally specify a branch name to seed
- Useful for re-seeding or seeding existing branches

| Event | Source Branch | Action |
|-------|---------------|--------|
| PR opened → `main` | `feat/*`, `fix/*`, etc. | ✅ Seeds preview database |
| PR reopened → `main` | Any branch | ✅ Seeds preview database |
| PR from `main` | `main` | 🚫 Blocked (safety check) |
| Manual trigger | Specified branch | ✅ Seeds preview database |

### Test Users Created

After the workflow runs, your preview database will have:

- `admin@test.com` (password: `test`) - ADMIN role
- `manager@test.com` (password: `test`) - MANAGER role
- `user@test.com` (password: `test`) - USER role

### Troubleshooting

**"No preview project found for branch"**
- Ensure preview branches are enabled in Supabase
- Check that the branch name matches the preview project name
- Verify `SUPABASE_ORG_ID` is correct

**"Could not authenticate with Supabase"**
- Verify `SUPABASE_ACCESS_TOKEN` is set correctly
- Check the token hasn't expired
- Ensure the token has proper permissions

**"Refusing to seed main/production branch"**
- This is a safety feature - working as intended
- Seed data should only exist in preview/dev environments

### Manual Triggering

**Option 1: GitHub Actions UI**
1. Go to Actions tab in your repository
2. Select "Seed Preview Database" workflow
3. Click "Run workflow"
4. Optionally enter a branch name (or leave empty for current branch)
5. Click "Run workflow" button

**Option 2: Local Script**
```bash
# Test or manually seed a specific branch
./scripts/test-preview-seed.sh <branch-name>
```

**Option 3: GitHub CLI**
```bash
# Trigger the workflow via gh CLI
gh workflow run seed-preview.yml -f branch_name=feat/my-feature
```

### Disabling Auto-Seeding

If you want to disable automatic seeding:

1. Delete or rename `.github/workflows/seed-preview.yml`
2. Or add this to the workflow file:
   ```yaml
   if: false  # Disable workflow
   ```

### Security Notes

- Seed data contains test credentials (`test` password)
- Only runs in preview/feature branches, never production
- Uses proper GitHub Actions security patterns (env vars, no injection)
- Requires explicit Supabase access token with limited scope

---

## Disabled Workflows

### Database Migration Workflow (REMOVED)

The `migrate.yml` workflow was removed because:

1. **This project uses Supabase for schema management**, not Prisma migrations
2. Prisma is only used for type-safe database access (read-only schema documentation)
3. Automated Prisma migrations conflicted with the Supabase migration strategy
4. Running `prisma migrate deploy` in production caused data loss on 2026-01-30

**Schema Management Strategy**:
- **Local Dev**: Supabase migrations in `supabase/migrations/`
- **Production**: Manual SQL via Supabase Dashboard or CLI
- **Prisma**: Type-safe queries only (never migrations)

See `/CLAUDE.md` for complete migration instructions.
