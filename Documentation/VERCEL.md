# Vercel Deployment Guide

This guide covers how to deploy the Percentage Tool to Vercel.

## ⚠️ Important Note on AI Models

The Percentage Tool is designed for **Local AI** (via LM Studio). When deploying to Vercel:
1. **AI_HOST**: You must point this to a publicly accessible endpoint (e.g., an OpenAI-compatible API, a tunneling service like Ngrok for your local machine, or a cloud-hosted LLM).
2. **Serverless Limits**: Long-running ingestion jobs may exceed Vercel's Serverless Function timeout (10-60s on Hobby/Pro). For massive datasets, local execution is recommended.

---

## 1. Database Setup (Vercel Postgres)

If you aren't using an external database, you can use Vercel Postgres:
1. Go to your Vercel Project Dashboard.
2. Select the **Storage** tab and click **Create Database** -> **Postgres**.
3. Follow the instructions to connect it to your project.
4. Vercel will automatically add `POSTGRES_URL` and other variables to your Environment Variables.

## 2. Environment Variables

In your Vercel Project Settings, add the following Environment Variables:

| Variable | Description |
| :--- | :--- |
| `DATABASE_URL` | Your full Postgres connection string. |
| `AI_HOST` | Public URL of your AI provider (e.g., `https://api.openai.com/v1`). |
| `LLM_MODEL` | The model name (e.g., `gpt-4o` or your local model id). |
| `EMBEDDING_MODEL` | The embedding model name. |

## 3. Build Configuration

To ensure Prisma works correctly in the serverless environment, update your `package.json` scripts if they don't already include `prisma generate`:

```json
"scripts": {
  "build": "prisma generate && next build"
}
```

## 4. Deployment Steps

### Method A: Vercel CLI
```bash
vercel --prod
```

### Method B: Git Integration
1. Push your code to GitHub/GitLab/Bitbucket.
2. Import the repository into Vercel.
3. Configure the environment variables.
4. Click **Deploy**.

## 5. Post-Deployment: Sync Database

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
