# Setup Guide

This guide will help you get the Percentage Tool up and running on your local machine.

## Prerequisites

- **Node.js** (v18 or higher)
- **Database** (choose one):
  - **Supabase** (Cloud) - Recommended for production and easy setup
  - **PostgreSQL** (Local) - For offline or self-hosted deployments
- **AI Provider** (choose one):
  - **LM Studio** - Local AI, privacy-first (default for local development)
  - **OpenRouter** - Cloud API, recommended for production deployments

## 1. Environment Configuration

Create a `.env` file in the root directory. Copy from `.env.example` and configure for your chosen database and AI provider.

### Database Setup

**Supabase (Recommended)**:
1. Create a free project at [supabase.com](https://supabase.com)
2. Get your database password and connection string from Project Settings -> Database
3. Get your Project URL and Publishable Key from Project Settings -> API

```env
# For Prisma database access
# Local development: Use direct connection (port 5432)
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
# Production (Vercel): Use Transaction Pooler (port 6543)
# DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres"

# For Supabase client SDK
NEXT_PUBLIC_SUPABASE_URL="https://[PROJECT-REF].supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."

# For Server Actions (Admin Bypass) - Never use NEXT_PUBLIC_ for this
SUPABASE_SERVICE_ROLE_KEY="sb_service_role_..."
```

### ⚠️ Prisma Schema Standards

This project uses explicit column mapping to ensure compatibility between camelCase identifiers in code and snake_case or case-sensitive identifiers in Postgres:

1. **Always use `@map("column_name")`** for any field that deviates from standard lowercase (especially `createdAt`, `updatedAt`, `ownerId`).
2. Run `npx prisma generate` after any schema changes to update the client.

**Local PostgreSQL**:

```env
DATABASE_URL="postgres://user:password@localhost:5432/pertool"
```

### AI Provider Setup

### Option A: LM Studio (Local - For Development)

```env
AI_HOST="http://localhost:1234/v1"
LLM_MODEL="meta-llama-3.1-8b-instruct"
EMBEDDING_MODEL="text-embedding-qwen3-embedding-0.6b"
```

*Note: Ensure the model names match exactly what you have loaded in LM Studio.*

### Option B: OpenRouter (Cloud - For Production)

```env
OPENROUTER_API_KEY="sk-or-v1-your-key-here"
OPENROUTER_LLM_MODEL="anthropic/claude-3.5-sonnet"
OPENROUTER_EMBEDDING_MODEL="openai/text-embedding-3-small"
```

Get your API key from [openrouter.ai/keys](https://openrouter.ai/keys). See [openrouter.ai/models](https://openrouter.ai/models) for available models.

*Note: Setting `OPENROUTER_API_KEY` automatically switches the provider to OpenRouter.*

## 2. Install Dependencies

```bash
npm install
```

## 3. Database Initialization

This project uses Prisma (v7). Run the following commands to synchronize the schema:

```bash
npx prisma generate
npx prisma db push
```

## 4. AI Provider Setup

Choose **one** of the following options:

### Option A: LM Studio (Local)

1. Open **LM Studio**.
2. **Search & Download**:
   - For Analysis: `Llama 3.1 8B Instruct` (or similar).
   - For Vectors: `Qwen 3 Embedding` or `Nomic Embed`.
3. **Load Models**: Load both a Chat model and an Embedding model.
4. **Start Server**: Start the **Local Server** in LM Studio on port 1234.
5. **GPU Acceleration**: Recommended for faster vectorization phases.

### Recommended Settings (LM Studio)

To ensure stable performance and sufficient memory for RAG operations:

- **Context Length**: Set to **8192** (or minimum 4096). This allows the AI to process large chunks of retrieved feedback.
- **Token Generation Limit**: Set to **2048** or -1 (Infinite). This prevents responses from being cut off during long analyses.
- **Flash Attention**: Enable if your hardware supports it (e.g., Apple Silicon, RTX cards) for significantly faster inference.

### Option B: OpenRouter (Cloud)

1. Create an account at [openrouter.ai](https://openrouter.ai).
2. Generate an API key at [openrouter.ai/keys](https://openrouter.ai/keys).
3. Add to your `.env` file:

   ```env
   OPENROUTER_API_KEY="sk-or-v1-your-key-here"
   ```

4. (Optional) Configure models:

   ```env
   OPENROUTER_LLM_MODEL="anthropic/claude-3.5-sonnet"
   OPENROUTER_EMBEDDING_MODEL="openai/text-embedding-3-small"
   ```

No local AI setup required - the system will automatically use OpenRouter when the API key is present.

1. **Cost Tracking**: When using OpenRouter, the dashboard will display:
   - Your current API balance in the header
   - Per-query costs after each AI analysis

   This helps you monitor usage and avoid unexpected charges.

## 5. Running the Application

Start the development server:

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to begin.

## 6. Testing

The tool includes a suite of unit and end-to-end tests to ensure reliability.

### Unit Tests (Vitest)

Unit tests cover core logic, including AI utilities and math helpers.

```bash
npm test
```

### End-to-End Tests (Playwright)

E2E tests verify navigation, UI components, and critical workflows.

```bash
npm run test:e2e
```

---

## Maintenance & Recovery

- **Re-Generation**: If you pull new updates, run `npx prisma generate` to ensure the background job types are synced.
- **Port Conflict**: If port 3000 is busy, use `PORT=3001 npm run dev`.
- **Worker Recovery**: The system automatically attempts to resume `QUEUED_FOR_VEC` jobs on startup if a project is active.
