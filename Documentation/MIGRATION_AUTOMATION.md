# Automated Database Migrations

## Overview

The project uses GitHub Actions to apply Prisma migrations to Supabase when changes are merged to the `main` branch.

## How It Works

### Workflow

**Workflow:** `.github/workflows/migrate.yml`

1. **Local Development** - Edit the Prisma schema
2. **Commit & Push** - Schema changes go into git
3. **GitHub Action** - Applies migrations to Supabase using `prisma migrate deploy`

## Local Development (Step-by-Step)

### 1. Make Schema Changes

Edit `prisma/schema.prisma`:
```prisma
model User {
  id    Int    @id @default(autoincrement())
  name  String // ← Added new field
}
```

### 2. Generate a Migration

Use your local database (Docker) to create a migration:

```bash
npx prisma migrate dev --name add_user_name
```

This generates a migration file in `prisma/migrations/`.

### 3. Commit Changes

```bash
git add prisma/schema.prisma
git commit -m "feat: add user name field"
```

**Important**: Commit both schema + migration files:
- ✅ `prisma/schema.prisma`
- ✅ `prisma/migrations/**`

### 4. Push

```bash
git push origin your-branch
```

## Automated Production Deployment

When your PR is merged to `main`:

1. The GitHub Action (`.github/workflows/migrate.yml`) is triggered automatically
2. It runs `npx prisma migrate deploy` against the production database
3. The migration is applied and verified

The workflow includes a 5-minute timeout to prevent hanging.

### Step 1: Navigate to Repository Settings

1. Go to your GitHub repository: `https://github.com/Fleet-AI-Operations/percentage-tool`
2. Click on **Settings** tab
3. In the left sidebar, click **Secrets and variables** → **Actions**

### Step 2: Create the DATABASE_URL Secret

1. Click the green **New repository secret** button
2. In the **Name** field, enter: `DATABASE_URL`
3. In the **Secret** field, paste your Supabase database connection string
   - You can find this in Supabase: Project Settings → Database → Connection string (choose "Connection pooling" or "URI" format)
   - Example format: `postgresql://user:password@host:port/database`
4. Click **Add secret** to save

The workflow will now have access to the `DATABASE_URL` secret when it runs migrations.

## Workflow File

The workflow is defined in `.github/workflows/migrate.yml` and includes:

- **Triggers**: 
  - Automatic on push to `main` when Prisma schema changes
  - Manual trigger via GitHub UI (workflow_dispatch)
  
- **Steps**:
  1. Checkout code
  2. Setup Node.js 20 with npm cache
  3. Install dependencies
  4. Apply migrations using `prisma migrate deploy` with `DATABASE_URL` from secrets
  5. Verify completion
  
- **Timeout**: 5 minutes to prevent workflow hanging

## Manual Trigger

You can manually trigger the migration workflow:

1. Go to **Actions** tab in GitHub
2. Select **Database Migration** workflow
3. Click **Run workflow**
4. Select branch (usually `main`)
5. Click **Run workflow**

## Safety Features

- **Path filters**: Only runs when Prisma schema changes
- **Verification step**: Confirms schema sync completion
- **npm ci**: Uses clean install to ensure consistent dependencies
- **Node caching**: Speeds up workflow execution
- **Timeout protection**: Automatically cancels after 5 minutes if hung

## Troubleshooting

### Workflow fails in CI

1. Check the Actions tab for error details
2. Verify `DATABASE_URL` secret is set correctly
3. Check Supabase connection settings
4. Ensure the timeout hasn't been exceeded

### Schema conflicts

If you have schema conflicts:

1. Pull latest changes from `main`
2. Review and merge schema changes
3. Test locally if possible and push again

## Best Practices

1. **Use migrations** (`migrate dev`) to generate change history
2. **Commit schema + migrations** together
3. **Use descriptive commit messages** (e.g., `add user role column`)
4. **Review schema changes carefully** before committing
5. **Coordinate with team** on schema changes to avoid conflicts
6. **Backup before major changes** - use Supabase's backup features
7. **Keep changes small** - easier to review and rollback if needed
8. **Test in development first** - ensure schema changes work as expected

## Notes

- This workflow uses Prisma migrations (`migrate dev` + `migrate deploy`)
- Migration history is tracked in `prisma/migrations/`
- The database schema is updated incrementally with each migration
- Data loss protection: Review destructive changes before committing

## Related Documentation

- [Prisma Migrate Documentation](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Supabase Connection Strings](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
