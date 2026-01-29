# Automated Database Migrations

## Overview

The project uses GitHub Actions to deploy database migrations automatically to Supabase when changes are merged to the `main` branch.

## How It Works

### Workflow

**Workflow:** `.github/workflows/migrate.yml`

1. **Local Development** - Create migrations on your machine
2. **Commit & Push** - Migration files go into git
3. **GitHub Action** - Automatically deploys when merged to main

## Local Development (Step-by-Step)

### 1. Make Schema Changes

Edit `prisma/schema.prisma`:
```prisma
model User {
  id    Int    @id @default(autoincrement())
  name  String // ← Added new field
}
```

### 2. Create Migration (REQUIRED) - This is critical you must run this before committing schema changes

```bash
npx prisma migrate dev --name add_user_name_field
```

This will:
- Create migration in `prisma/migrations/[timestamp]_add_user_name_field/`
- Apply to your local database
- Regenerate Prisma Client

### 3. Stage and Commit Changes

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add user name field"
```

**Important**: Always commit BOTH:
- ✅ `prisma/schema.prisma` (the schema)
- ✅ `prisma/migrations/` (the migration folder)

### 4. Push

```bash
git push origin your-branch
```

## Automated Production Deployment

When your PR is merged to `main`:

1. The GitHub Action (`.github/workflows/migrate.yml`) is triggered automatically
2. It runs `npx prisma migrate deploy` against the production database
3. Migrations are applied in order and their status is verified

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
  - Automatic on push to `main` when Prisma files change
  - Manual trigger via GitHub UI (workflow_dispatch)
  
- **Steps**:
  1. Checkout code
  2. Setup Node.js 20 with npm cache
  3. Install dependencies
  4. Deploy migrations using `DATABASE_URL` from secrets
  5. Verify migration status

## Manual Trigger

You can manually trigger the migration workflow:

1. Go to **Actions** tab in GitHub
2. Select **Database Migration** workflow
3. Click **Run workflow**
4. Select branch (usually `main`)
5. Click **Run workflow**

## Safety Features

- **Path filters**: Only runs when Prisma schema or migration files change
- **Verification step**: Confirms migration status after deployment
- **npm ci**: Uses clean install to ensure consistent dependencies
- **Node caching**: Speeds up workflow execution

## Troubleshooting

### Migration fails in CI

1. Check the Actions tab for error details
2. Verify `DATABASE_URL` secret is set correctly
3. Ensure migrations work locally first
4. Check Supabase connection settings

### Migration conflict

If you see "migration conflict" errors:

1. Pull latest changes from `main`
2. Reset your migration:
   ```bash
   rm -rf prisma/migrations/[your-migration-folder]
   npx prisma migrate dev --name your_migration_name
   ```
3. Test locally and push again

### Manual rollback

If you need to rollback a migration:

1. Connect to your Supabase database
2. Manually run the down migration or restore from backup
3. Update the `_prisma_migrations` table if needed

⚠️ **Note**: Prisma doesn't have built-in rollback. Plan migrations carefully and test thoroughly.

## Best Practices

1. **Always run `npx prisma migrate dev`** before committing schema changes
2. **Use descriptive migration names** (e.g., `add_user_role_column`)
3. **Review generated SQL** in `prisma/migrations/[timestamp]_[name]/migration.sql`
4. **Never edit applied migrations** - create new ones instead
5. **Coordinate with team** on schema changes to avoid conflicts
6. **Backup before major changes** - use Supabase's backup features
7. **Keep migrations small** - easier to review and rollback if needed
8. **Test locally first** - ensure migrations work before pushing

## Related Documentation

- [Prisma Migrate Documentation](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Supabase Connection Strings](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
