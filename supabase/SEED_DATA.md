# Seed Data Documentation

This document describes the test users that are automatically created in development and preview environments.

## Overview

The `supabase/seed.sql` file creates test users with known credentials for each role in the system. This makes it easy to test different permission levels without manually creating users.

## Test Users

All test users use the same password: **`test`**

| Email | Password | Role | Description |
|-------|----------|------|-------------|
| `admin@test.com` | `test` | ADMIN | Full system access, can manage users, settings, and all features |
| `manager@test.com` | `test` | MANAGER | Access to operational tools, ingestion, analytics, and leaderboards |
| `user@test.com` | `test` | USER | Basic access to view and create records |

## Usage

### Local Development

Seed data is automatically applied when you run:

```bash
npm run dev:reset
```

This will:
1. Reset the database
2. Apply all migrations
3. Run the seed.sql file to create test users

### Manual Seeding

If you need to re-run just the seed data:

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres < supabase/seed.sql
```

### Supabase Preview Branches

**Important:** Seed data does NOT automatically run in Supabase preview branch databases.

Preview branches automatically run:
- ✅ Migrations from `supabase/migrations/`
- ❌ Seed files (`seed.sql`) - only run with `supabase db reset` locally

**To enable seed data in preview branches:**

1. **Manual Method**: Run seed file in preview branch:
   ```bash
   supabase db remote commit --project-ref <preview-ref> --file supabase/seed.sql
   ```

2. **Automated Method**: Use the GitHub Actions workflow at `.github/workflows/seed-preview.yml`
   - Automatically seeds preview databases when branches are pushed
   - Includes safety checks to prevent seeding production
   - Requires `SUPABASE_ACCESS_TOKEN` secret in GitHub

### Login

Navigate to http://localhost:3000/auth/login and use any of the test credentials above.

## Security Notes

⚠️ **IMPORTANT**: These credentials are for **development and preview environments only**.

### Protection Layers

This seed data has **three layers of protection** against running in production:

1. **Supabase Config**: `seed.sql` only runs with `supabase db reset` command (local dev only)
2. **Cloud Hosting**: Supabase Cloud projects don't auto-run seed files
3. **Opt-In Safety Check**: The seed file requires explicit permission to run (blocks by default)

### How It's Protected

The seed file uses an **opt-in approach** that blocks seeding by default:
- Requires `app.seed_allowed = 'true'` setting to run
- Databases must explicitly allow seeding (safer than opt-out)
- Warns if running on a non-standard database name
- Refuses to run unless explicitly enabled

### Setting Environment Variables

To **enable seed data** in development/preview environments:

```sql
-- Run this in your dev/preview database
ALTER DATABASE postgres SET app.seed_allowed = 'true';
```

**Production databases** are protected by default - seeding is blocked unless you explicitly enable it. No additional configuration needed for production protection.

### Production Best Practices

- Never manually run seed.sql in production
- Production user creation should always go through the proper admin UI
- Production databases are protected by default (opt-in required for seeding)
- Never set `app.seed_allowed = 'true'` in production databases
- Test credentials should never exist in production

## Modifying Seed Data

To add more test users, edit `supabase/seed.sql` and follow the existing pattern:

1. Add a new UUID (use the pattern: `00000000-0000-0000-0000-00000000000X`)
2. Insert into `auth.users` with hashed password
3. Insert into `public.profiles` with desired role
4. Add the email to the cleanup section at the top

## Testing Different Roles

Use these users to test:

- **ADMIN**: User management, system settings, AI configuration, all features
- **MANAGER**: Ingestion, bonus windows, activity tracking, leaderboards, project management
- **USER**: Record viewing, creating records, basic features

## Troubleshooting

If seed users aren't created:

1. Check the database reset output for errors
2. Verify pgcrypto extension is enabled
3. Check that the trigger `on_auth_user_created` exists
4. Manually verify users: `SELECT email, role FROM public.profiles;`
