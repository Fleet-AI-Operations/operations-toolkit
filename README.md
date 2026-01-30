# Percentage Tool

A local-first AI alignment and data ingestion tool for evaluating task and feedback data.

## 📚 Documentation

### Getting Started
- [**Deployment Options**](./DEPLOYMENT_OPTIONS.md) - Compare Local, Docker, and Production deployments
- [**Local Development Quick Start**](./LOCALDEV_QUICKSTART.md) - Get up and running in 5 minutes
- [**Production vs Local**](./PRODUCTION_VS_LOCAL.md) - What's deployed to production vs local only

### Guides
- [**Setup Guide**](./Documentation/SETUP.md) - How to configure your environment, database, and local AI (LM Studio)
- [**Local Development Guide**](./Documentation/LOCAL_DEVELOPMENT.md) - Detailed guide for local development with Supabase
- [**Testing Guide**](./Documentation/TESTING.md) - How to run and write tests
- [**Docker Deployment**](./docker/README.md) - Running with Docker Compose
- [**User Guide**](./Documentation/USER_GUIDE.md) - How to manage projects, ingest data, and interpret AI alignment scores
- [**User Management**](./Documentation/USER_MANAGEMENT.md) - Approval flows, roles, and access delegation
- [**Vercel Deployment**](./Documentation/VERCEL.md) - Instructions for deploying to production

### 🏗 Architecture

- [**System Overview**](./Documentation/Architecture/OVERVIEW.md) - High-level tech stack and system diagrams.
- [**Ingestion & Queuing**](./Documentation/Architecture/INGESTION_FLOW.md) - Deep dive into background processes and memory management.
- [**AI Strategy**](./Documentation/Architecture/AI_STRATEGY.md) - Logic behind RAG-based alignment checks and embeddings.

## ✨ Core Features

- **🚀 Parallel Ingestion Pipeline**: Decouples high-speed data loading from AI vectorization. Ingest thousands of records instantly while embeddings generate in the background.
- **🧠 AI-Powered Alignment Analysis**: Automatically evaluate Tasks and Feedback against project-specific guidelines using local LLM models (Llama 3.1, Qwen, etc.).
- **📊 Bulk Analytics Engine**: Process entire datasets sequentially in the background. Includes real-time progress tracking and job cancellation support.
- **🛡️ Authentication & RBAC**: Secure login with Supabase Auth, role-based access control (Admin, Manager, User), and an automated approval workflow for new signups.
- **🛡️ Flexible AI Providers**: Supports both local AI (LM Studio) for maximum privacy and cloud AI (OpenRouter) for convenience. Switch providers with a single environment variable.
- **💰 Cost Tracking**: Real-time OpenRouter API cost tracking with per-query costs and account balance display on the dashboard.
- **🎯 Semantic Search**: Find similar prompts and feedback across projects using vector embeddings (Cosine Similarity).
- **🛠️ Admin Console**: Dynamic AI configuration (Host, Model, Provider), centralized management for bulk data wipes, and detailed system status.
- **🔍 Transparent Ingestion**: Detailed tracking of skipped records (e.g., duplicates, keyword mismatches) with visual breakdown in the UI.
- **💎 Premium UI/UX**: Fully responsive, high-fidelity glassmorphism interface with interactive data visualizations and real-time status polling.
- **🧪 Quality Assurance**: Integrated unit testing (Vitest) and E2E testing (Playwright) suites for robust development.

## 🚀 Quick Start

### Local Development (New!)

**See [LOCALDEV_QUICKSTART.md](./LOCALDEV_QUICKSTART.md) for local development with Supabase.**

Quick commands:
```bash
npm install
npm run dev:supabase  # Start local Supabase
npm run dev           # Start app
```

Open http://localhost:3000

### Production Setup

1. **Install Dependencies**:

   ```bash
   npm install
   ```

2. **Configure Environment**:

   Copy `.env.example` to `.env` and update your `DATABASE_URL`. Choose your AI provider:

   - **LM Studio** (local): Configure `AI_HOST`, `LLM_MODEL`, `EMBEDDING_MODEL`
   - **OpenRouter** (cloud): Set `OPENROUTER_API_KEY` (get one at [openrouter.ai/keys](https://openrouter.ai/keys))

3. **Initialize Database**:

   ```bash
   npx prisma generate
   # Note: For local development, use Supabase migrations instead
   ```

4. **Run Tests**:

   - Unit Tests: `npm test`
   - E2E Tests: `npm run test:e2e`

5. **Launch**:

   ```bash
   npm run dev:next  # Or npm run dev for Vercel Dev
   ```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### 💰 Cost Tracking (OpenRouter)

When using OpenRouter as your AI provider, the tool automatically tracks API costs:

- **Per-query costs**: See the cost of each alignment analysis displayed after completion
- **Account balance**: View your remaining OpenRouter credits in the dashboard header

Cost information appears after each AI operation. Balance refreshes when the dashboard loads.

*Note: Cost tracking is only available with OpenRouter. LM Studio operations are free (local compute).*

### 🐳 Running with Docker (Portable Mode)

The easiest way to run the entire stack (App + Database) without manual setup:

```bash
cd docker
docker-compose up -d
```

This will:
- Start PostgreSQL with auth schema
- Run database migrations automatically
- Start the Next.js app on port 3000

**Documentation**: See [docker/README.md](./docker/README.md) for detailed Docker instructions.

**Stop Services**:
```bash
docker-compose down
```

## 🛠 Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: PostgreSQL (Prisma ORM) / Supabase
- **Observability**: Vercel Analytics & Speed Insights
- **AI**: LM Studio (local) or OpenRouter (cloud) - configurable via environment
- **Styling**: Premium Glassmorphism UI (Tailwind CSS)
- **Ingestion**: Decoupled parallel pipeline (Fast Data Load + Async Vectorization)

---

*This tool processes all data locally to ensure maximum privacy and compliance.*

## ✅ ToDo / Roadmap

- [ ] **API Ingestion**: Complete the refactor of the live endpoint sync engine (currently under construction).
- [ ] **Similarity Clustering**: Implement a view to group similar records by their vector embeddings for bulk analysis. More details and constraints are needed here.
- [ ] **Advanced Filtering**: Is this something we want? Should we be able to filter by different metadata fields?
- [ ] **Multi-Model Testing**: Enable a "comparison mode" to run the same alignment check across different LLM models.
- [ ] **Duplicate Strategy**: Recent ingestion files have contained duplicate task_ids, because those are unique, we need to identify a strategy to handle these. Today duplicates are just skipped on ingestion.
