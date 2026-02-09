# Vercel Multi-App Setup Guide

This guide explains how to deploy all 5 apps to Vercel with correct configurations.

## 🎯 Architecture

Each app is a separate Vercel project with its own configuration:

```
Repository: operations-toolkit
├── apps/user/vercel.json     → Vercel Project: "operations-user"
├── apps/qa/vercel.json        → Vercel Project: "operations-qa"
├── apps/core/vercel.json      → Vercel Project: "operations-core"
├── apps/fleet/vercel.json     → Vercel Project: "operations-fleet"
└── apps/admin/vercel.json     → Vercel Project: "operations-admin"
```

## 📝 Setup Steps

### Step 1: Create Vercel Projects

Create 5 separate Vercel projects, one for each app:

#### Via Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Click **Add New** → **Project**
3. Import your repository: `operations-toolkit`
4. **Configure the project**:

**For User App**:
- **Project Name**: `operations-user`
- **Root Directory**: `apps/user`
- **Framework Preset**: Next.js
- Click **Deploy**

**For QA App**:
- **Project Name**: `operations-qa`
- **Root Directory**: `apps/qa`
- **Framework Preset**: Next.js
- Click **Deploy**

**For Core App**:
- **Project Name**: `operations-core`
- **Root Directory**: `apps/core`
- **Framework Preset**: Next.js
- Click **Deploy**

**For Fleet App**:
- **Project Name**: `operations-fleet`
- **Root Directory**: `apps/fleet`
- **Framework Preset**: Next.js
- Click **Deploy**

**For Admin App**:
- **Project Name**: `operations-admin`
- **Root Directory**: `apps/admin`
- **Framework Preset**: Next.js
- Click **Deploy**

### Step 2: Verify Build Commands

Each project should automatically use its local `vercel.json`:

| App | Build Command | Output Directory |
|-----|---------------|------------------|
| User | `cd ../.. && pnpm turbo run build --filter=@repo/user-app` | `.next` |
| QA | `cd ../.. && pnpm turbo run build --filter=@repo/qa-app` | `.next` |
| Core | `cd ../.. && pnpm turbo run build --filter=@repo/core-app` | `.next` |
| Fleet | `cd ../.. && pnpm turbo run build --filter=@repo/fleet-app` | `.next` |
| Admin | `cd ../.. && pnpm turbo run build --filter=@repo/admin-app` | `.next` |

### Step 3: Configure Environment Variables

For **each project**, add these environment variables in the Vercel Dashboard:

1. Go to **Settings** → **Environment Variables**
2. Add shared variables (database, Supabase, etc.):

```bash
# Database
DATABASE_URL=your-database-url

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# AI Configuration (if needed)
AI_HOST=your-ai-host
LLM_MODEL=your-model
EMBEDDING_MODEL=your-embedding-model
OPENROUTER_API_KEY=your-api-key
```

3. Add cross-app navigation URLs (replace with actual URLs):

```bash
NEXT_PUBLIC_USER_APP_URL=https://operations-user.vercel.app
NEXT_PUBLIC_QA_APP_URL=https://operations-qa.vercel.app
NEXT_PUBLIC_CORE_APP_URL=https://operations-core.vercel.app
NEXT_PUBLIC_FLEET_APP_URL=https://operations-fleet.vercel.app
NEXT_PUBLIC_ADMIN_APP_URL=https://operations-admin.vercel.app
```

**Important**: Add these to **all 5 projects**

### Step 4: Redeploy

After adding environment variables, redeploy each app:

1. Go to **Deployments** tab
2. Click **Redeploy** on latest deployment
3. Repeat for all 5 projects

## ✅ Verification Checklist

- [ ] 5 separate Vercel projects created
- [ ] Each project has correct Root Directory set (`apps/{app-name}`)
- [ ] Each project builds its own app (check build logs)
- [ ] All environment variables added to all projects
- [ ] All apps successfully deployed
- [ ] AppSwitcher works (can navigate between apps)
- [ ] No console warnings about missing environment variables

## 🐛 Troubleshooting

### Issue: All apps building the same app

**Symptom**: Build logs show `pnpm turbo run build --filter=@repo/fleet-app` for all apps

**Cause**: Root `vercel.json` being used instead of app-specific configs

**Solution**:
1. Ensure each Vercel project has **Root Directory** set to `apps/{app-name}`
2. Each app directory has its own `vercel.json`
3. The root `vercel.json` is removed or backed up

### Issue: Build fails with "output not found"

**Symptom**: Error about `.next` directory not found

**Cause**: Root directory not set correctly

**Solution**:
1. Check Vercel project settings
2. **Root Directory** should be `apps/{app-name}`
3. **Output Directory** should be `.next` (relative to root directory)

### Issue: Packages not found during build

**Symptom**: Build fails with "Cannot find module '@repo/ui'"

**Cause**: Install command not running from repository root

**Solution**:
- Verify `installCommand` in `vercel.json` is `cd ../.. && pnpm install`
- This ensures pnpm installs all workspace dependencies

## 📊 Expected Build Output

Each app should show its own build:

**User App**:
```
Running "cd ../.. && pnpm turbo run build --filter=@repo/user-app"
@repo/user-app:build: ✓ Compiled successfully
```

**QA App**:
```
Running "cd ../.. && pnpm turbo run build --filter=@repo/qa-app"
@repo/qa-app:build: ✓ Compiled successfully
```

**Core App**:
```
Running "cd ../.. && pnpm turbo run build --filter=@repo/core-app"
@repo/core-app:build: ✓ Compiled successfully
```

**Fleet App**:
```
Running "cd ../.. && pnpm turbo run build --filter=@repo/fleet-app"
@repo/fleet-app:build: ✓ Compiled successfully
```

**Admin App**:
```
Running "cd ../.. && pnpm turbo run build --filter=@repo/admin-app"
@repo/admin-app:build: ✓ Compiled successfully
```

## 🔄 Continuous Deployment

With this setup:
- Push to `main` branch triggers deployment of all 5 apps
- Each app deploys independently
- Changes to shared packages (`@repo/*`) rebuild all apps
- Changes to one app only rebuild that app (Turborepo caching)

## 📚 Related Documentation

- [Vercel Monorepo Guide](https://vercel.com/docs/concepts/monorepos)
- [Turborepo with Vercel](https://turbo.build/repo/docs/handbook/deploying-with-docker)
- [Environment Setup](./VERCEL_ENVIRONMENT_SETUP.md)
- [AppSwitcher Configuration](./packages/ui/src/components/AppSwitcher.tsx)

---

**Last Updated**: February 2026
**Architecture**: Turborepo multi-app monorepo
