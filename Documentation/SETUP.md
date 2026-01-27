# Setup Guide

This guide will help you get the Percentage Tool up and running on your local machine.

## Prerequisites

- **Node.js** (v18 or higher)
- **PostgreSQL** database
- **AI Provider** (choose one):
  - **LM Studio** - Local AI, privacy-first (default)
  - **OpenRouter** - Cloud API, no local setup required

## 1. Environment Configuration

Create a `.env` file in the root directory. Copy from `.env.example` and configure for your chosen AI provider.

### Option A: LM Studio (Local - Default)

```env
DATABASE_URL="postgres://user:password@localhost:5432/pertool"
AI_HOST="http://localhost:1234/v1"
LLM_MODEL="meta-llama-3.1-8b-instruct"
EMBEDDING_MODEL="text-embedding-qwen3-embedding-0.6b"
```

*Note: Ensure the model names match exactly what you have loaded in LM Studio.*

### Option B: OpenRouter (Cloud)

```env
DATABASE_URL="postgres://user:password@localhost:5432/pertool"
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

5. **Cost Tracking**: When using OpenRouter, the dashboard will display:
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
