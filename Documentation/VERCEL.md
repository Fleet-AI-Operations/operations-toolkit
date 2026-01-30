# Vercel Deployment Guide

This guide covers how to deploy the Operations Tools to Vercel.

## ⚠️ Important Note on AI Models

When deploying to Vercel, **use OpenRouter** (cloud-based AI) instead of local LM Studio:

1. **LM Studio (localhost)**: Cannot be accessed from Vercel's servers
2. **OpenRouter (Recommended)**: Cloud-based, works perfectly with Vercel
3. **Serverless Limits**: Long-running ingestion jobs may exceed Vercel's timeout (10-60s on Hobby/Pro). For massive datasets, consider Vercel Pro or Enterprise.

---

## 1. Database Setup (Supabase or Vercel Postgres)

For production deployments, **Supabase** is highly recommended as it pairs perfectly with Vercel and provides a robust Postgres database.

### Option A: Supabase (Recommended)

1. Create a project at [supabase.com](https://supabase.com).
2. Go to **Project Settings > API** to get your Project URL and Publishable Key.
3. Go to **Project Settings > Database** to get your Connection Pooling string (Transaction Pooler with port 6543).
4. Add these to your Vercel Environment Variables (see below).

### Option B: Vercel Postgres

1. Go to your Vercel Project Dashboard.
2. Select the **Storage** tab and click **Create Database** -> **Postgres**.
3. Follow the instructions to connect it to your project.

## 2. Environment Variables

In your Vercel Project Settings, add the following Environment Variables:

| Variable | Description |
| :--- | :--- |
| `DATABASE_URL` | Your Postgres Transaction Pooler connection string (use port 6543 for Vercel). |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Your Supabase Publishable Key (format: `sb_publishable_...`). |
| `SUPABASE_SERVICE_ROLE_KEY` | **CRITICAL**: Used by server actions for password reset and user management. Never prefix with NEXT_PUBLIC. |
| `OPENROUTER_API_KEY` | Your OpenRouter API key (required for Vercel). |
| `OPENROUTER_LLM_MODEL` | The LLM model name (e.g., `anthropic/claude-3.5-sonnet`). |
| `OPENROUTER_EMBEDDING_MODEL` | The embedding model name (e.g., `openai/text-embedding-3-small`). |

### ⚠️ Client-Side Environment Variable Rules

Next.js 15 strictly bundles environment variables for the browser. To ensure your deployment works:

1. **Always use the `NEXT_PUBLIC_` prefix** for variables used in client components.
2. **Use Static Property Access**: Access variables as `process.env.NEXT_PUBLIC_NAME`. Do **not** use dynamic access like `process.env[name]` or destructuring, as the Next.js compiler will skip them during the bundling phase, resulting in `undefined` at runtime.

## 3. Analytics & Speed Insights

The project is pre-configured with Vercel Analytics and Speed Insights.

- **Analytics**: Tracks distinct visitors, page views, and geographic usage.
- **Speed Insights**: Monitors Real Experience Score (Web Vitals) like LCP, FID, and CLS.

These will automatically start collecting data once deployed to Vercel. Enable them in your Vercel Project Dashboard under the **Analytics** and **Speed Insights** tabs.

## 4. Build Configuration

The `package.json` is already configured for Vercel deployment with:

```json
"scripts": {
  "build": "prisma generate && next build",
  "postinstall": "prisma generate"
}
```

No changes needed - Prisma will automatically generate on deployment.

## 5. Deployment Steps

### Method A: Vercel CLI

```bash
vercel --prod
```

### Method B: Git Integration

1. Push your code to GitHub/GitLab/Bitbucket.
2. Import the repository into Vercel.
3. Configure the environment variables.
4. Click **Deploy**.

## 6. Post-Deployment: Sync Database

Once deployed, you need to push your Prisma schema to the production database:

```bash
npx prisma db push
```

*(Make sure your local `.env` is temporarily pointed to the production database or use a tunnel).*

---

## Cost Monitoring (OpenRouter)

When deployed with OpenRouter, monitor your API costs:

- The dashboard displays your current balance
- Each AI operation shows its cost after completion
- Consider setting up OpenRouter spending alerts at [openrouter.ai/settings](https://openrouter.ai/settings)

---

## Performance Optimization

Because Vercel uses Serverless Functions, the "Background Ingestion" feature relies on sequential processing that may be interrupted if the function times out.

**Recommendation**: For production-grade background processing on Vercel, consider integrating a dedicated worker service like **Inngest** or **Upstash Workflow**.
