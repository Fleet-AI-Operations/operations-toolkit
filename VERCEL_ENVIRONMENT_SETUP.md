# Vercel Environment Setup for Multi-App Deployment

This guide explains how to configure environment variables in Vercel for proper cross-app navigation in production.

## 🎯 Problem

The AppSwitcher component needs to know the production URLs of all apps to redirect users correctly. In development, it uses `localhost:3001`, `localhost:3002`, etc. In production, you need to configure environment variables with the actual production URLs.

## 🔧 Required Environment Variables

Each app deployment needs to know the URLs of **all other apps** for the AppSwitcher to work.

### Environment Variable Format

```bash
NEXT_PUBLIC_USER_APP_URL=https://your-user-app-url.vercel.app
NEXT_PUBLIC_QA_APP_URL=https://your-qa-app-url.vercel.app
NEXT_PUBLIC_CORE_APP_URL=https://your-core-app-url.vercel.app
NEXT_PUBLIC_FLEET_APP_URL=https://your-fleet-app-url.vercel.app
NEXT_PUBLIC_ADMIN_APP_URL=https://your-admin-app-url.vercel.app
```

**Important**:
- These must be `NEXT_PUBLIC_*` to be accessible in the browser
- Use the actual production URLs from your Vercel deployments
- All apps need all URLs configured

## 📝 Step-by-Step Setup

### Step 1: Deploy All Apps to Vercel

First, deploy each app and note their production URLs:

```bash
# Deploy user app
cd apps/user
vercel --prod
# Note the URL: https://operations-user.vercel.app

# Deploy qa app
cd apps/qa
vercel --prod
# Note the URL: https://operations-qa.vercel.app

# Deploy core app
cd apps/core
vercel --prod
# Note the URL: https://operations-core.vercel.app

# Deploy fleet app
cd apps/fleet
vercel --prod
# Note the URL: https://operations-fleet.vercel.app

# Deploy admin app
cd apps/admin
vercel --prod
# Note the URL: https://operations-admin.vercel.app
```

### Step 2: Configure Environment Variables in Vercel Dashboard

For **each app's Vercel project**, add all environment variables:

#### Via Vercel Dashboard UI

1. Go to https://vercel.com/dashboard
2. Select your project (e.g., "operations-user")
3. Go to **Settings** → **Environment Variables**
4. Add each variable:

```
Variable Name: NEXT_PUBLIC_USER_APP_URL
Value: https://operations-user.vercel.app
Environment: Production

Variable Name: NEXT_PUBLIC_QA_APP_URL
Value: https://operations-qa.vercel.app
Environment: Production

Variable Name: NEXT_PUBLIC_CORE_APP_URL
Value: https://operations-core.vercel.app
Environment: Production

Variable Name: NEXT_PUBLIC_FLEET_APP_URL
Value: https://operations-fleet.vercel.app
Environment: Production

Variable Name: NEXT_PUBLIC_ADMIN_APP_URL
Value: https://operations-admin.vercel.app
Environment: Production
```

5. **Repeat for all 5 app projects**

#### Via Vercel CLI

Alternatively, use the CLI:

```bash
# For user app
cd apps/user
vercel env add NEXT_PUBLIC_USER_APP_URL production
# Enter: https://operations-user.vercel.app
vercel env add NEXT_PUBLIC_QA_APP_URL production
# Enter: https://operations-qa.vercel.app
# ... repeat for all apps

# Repeat for all other apps (qa, core, fleet, admin)
```

### Step 3: Redeploy All Apps

After adding environment variables, redeploy each app to pick up the new variables:

```bash
cd apps/user && vercel --prod
cd apps/qa && vercel --prod
cd apps/core && vercel --prod
cd apps/fleet && vercel --prod
cd apps/admin && vercel --prod
```

Or trigger redeployment via Vercel Dashboard:
- Go to **Deployments** tab
- Click **Redeploy** on the latest production deployment

## ✅ Verification

After setup, verify the AppSwitcher works:

1. Log into any app (e.g., Fleet app)
2. Open browser console (F12)
3. Check for warnings about missing environment variables
4. Click the AppSwitcher dropdown
5. Click a different app (e.g., "QA")
6. Should redirect to correct app URL

**If you see console warnings**:
```
AppSwitcher: NEXT_PUBLIC_QA_APP_URL not set. Cross-app navigation will not work correctly.
```
→ The environment variable is missing or the app wasn't redeployed after adding it.

## 🌐 Custom Domains

If using custom domains instead of Vercel default URLs:

```bash
# Example with custom domains
NEXT_PUBLIC_USER_APP_URL=https://user.operations.company.com
NEXT_PUBLIC_QA_APP_URL=https://qa.operations.company.com
NEXT_PUBLIC_CORE_APP_URL=https://core.operations.company.com
NEXT_PUBLIC_FLEET_APP_URL=https://fleet.operations.company.com
NEXT_PUBLIC_ADMIN_APP_URL=https://admin.operations.company.com
```

Remember to:
1. Set up custom domains in Vercel for each app
2. Update environment variables with custom domain URLs
3. Redeploy all apps

## 🔒 Security Considerations

These environment variables are **public** (they're in the browser), so:
- ✅ Safe: Production URLs of your apps
- ❌ Never: API keys, secrets, or sensitive data

For sensitive configuration, use server-side environment variables without the `NEXT_PUBLIC_` prefix.

## 🐛 Troubleshooting

### Issue: Clicking app switcher does nothing or reloads current app

**Cause**: Environment variables not set

**Solution**:
1. Check Vercel environment variables in dashboard
2. Verify all `NEXT_PUBLIC_*_APP_URL` variables are set
3. Redeploy the app

### Issue: Redirects to wrong URL

**Cause**: Environment variable has incorrect URL

**Solution**:
1. Check the URL value in Vercel dashboard
2. Update to correct production URL
3. Redeploy the app

### Issue: Works in preview but not production

**Cause**: Environment variables only set for Preview or Development

**Solution**:
1. In Vercel dashboard, ensure variables are set for **Production** environment
2. Redeploy to production

### Issue: Console shows 404 errors when switching apps

**Cause**: Target app not deployed or URL incorrect

**Solution**:
1. Verify all apps are deployed to production
2. Check URLs are accessible in browser
3. Update environment variables if URLs changed

## 📋 Checklist

Use this checklist when setting up a new Vercel deployment:

- [ ] Deploy all 5 apps to Vercel production
- [ ] Note all production URLs
- [ ] For **User App** project, add all 5 `NEXT_PUBLIC_*_APP_URL` variables
- [ ] For **QA App** project, add all 5 `NEXT_PUBLIC_*_APP_URL` variables
- [ ] For **Core App** project, add all 5 `NEXT_PUBLIC_*_APP_URL` variables
- [ ] For **Fleet App** project, add all 5 `NEXT_PUBLIC_*_APP_URL` variables
- [ ] For **Admin App** project, add all 5 `NEXT_PUBLIC_*_APP_URL` variables
- [ ] Redeploy all apps to pick up new environment variables
- [ ] Test AppSwitcher in production (switch between apps)
- [ ] Check browser console for warnings
- [ ] Verify all redirects work correctly

## 🎨 Alternative: Disable AppSwitcher in Production

If you don't want cross-app navigation in production, you can disable the AppSwitcher:

```typescript
// In each app's layout or where AppSwitcher is used
const isProd = process.env.NODE_ENV === 'production';
const hasRequiredEnvVars = !!(
  process.env.NEXT_PUBLIC_USER_APP_URL &&
  process.env.NEXT_PUBLIC_QA_APP_URL &&
  process.env.NEXT_PUBLIC_CORE_APP_URL &&
  process.env.NEXT_PUBLIC_FLEET_APP_URL &&
  process.env.NEXT_PUBLIC_ADMIN_APP_URL
);

// Only show AppSwitcher if all URLs are configured
{(!isProd || hasRequiredEnvVars) && (
  <AppSwitcher currentApp="fleet" userRole={role} />
)}
```

## 📚 Related Documentation

- [Vercel Environment Variables Docs](https://vercel.com/docs/concepts/projects/environment-variables)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [AppSwitcher Component](./packages/ui/src/components/AppSwitcher.tsx)
- [Turborepo Deployment Guide](./DEPLOYMENT_OPTIONS.md)

---

**Last Updated**: February 2026
**Applies To**: Multi-app turborepo architecture
