# Percentage Tool

A local-first AI alignment and data ingestion tool for evaluating task and feedback data.

## 📚 Documentation

Detailed documentation for developers and users can be found in the `Documentation` directory:

- [**Setup Guide**](./Documentation/SETUP.md) - How to configure your environment, database, and local AI (LM Studio).
- [**User Guide**](./Documentation/USER_GUIDE.md) - How to manage projects, ingest data, and interpret AI alignment scores.
- [**Vercel Deployment**](./Documentation/VERCEL.md) - Instructions for deploying to a Vercel serverless environment.

### 🏗 Architecture
- [**System Overview**](./Documentation/Architecture/OVERVIEW.md) - High-level tech stack and system diagrams.
- [**Ingestion & Queuing**](./Documentation/Architecture/INGESTION_FLOW.md) - Deep dive into background processes and memory management.
- [**AI Strategy**](./Documentation/Architecture/AI_STRATEGY.md) - Logic behind RAG-based alignment checks and embeddings.

## ✨ Core Features

- **🚀 Parallel Ingestion Pipeline**: Decouples high-speed data loading from AI vectorization. Ingest thousands of records instantly while embeddings generate in the background.
- **🧠 AI-Powered Alignment Analysis**: Automatically evaluate Tasks and Feedback against project-specific guidelines using local LLM models (Llama 3.1, Qwen, etc.).
- **📊 Bulk Analytics Engine**: Process entire datasets sequentially in the background. Includes real-time progress tracking and job cancellation support.
- **🛡️ Flexible AI Providers**: Supports both local AI (LM Studio) for maximum privacy and cloud AI (OpenRouter) for convenience. Switch providers with a single environment variable.
- **💰 Cost Tracking**: Real-time OpenRouter API cost tracking with per-query costs and account balance display on the dashboard.
- **🎯 Semantic Search**: Find similar prompts and feedback across projects using vector embeddings (Cosine Similarity).
- **🛠️ Admin Console**: Centralized management for bulk data wipes, project context switching, and advanced maintenance tasks.
- **💎 Premium UI/UX**: Fully responsive, high-fidelity glassmorphism interface with interactive data visualizations and real-time status polling.
- **🧪 Quality Assurance**: Integrated unit testing (Vitest) and E2E testing (Playwright) suites for robust development.

## 🚀 Quick Start

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
   npx prisma db push
   ```

4. **Run Tests**:
   - Unit Tests: `npm test`
   - E2E Tests: `npm run test:e2e`

5. **Launch**:
   ```bash
   npm run dev
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

1. **Configure Environment**:
   Copy `.env.example` to `.env`. The database URL is pre-configured for Docker.

2. **Start Services**:
   ```bash
   docker-compose up -d
   ```
   This will start the Postgres database and the Next.js app on port 3000.

3. **Initialize DB**:
   ```bash
   docker-compose exec app npx prisma db push
   ```

4. **Stop**:
   ```bash
   docker-compose down
   ```


## 🛠 Tech Stack

- **Framework**: Next.js 15
- **Database**: PostgreSQL with Prisma ORM
- **AI**: LM Studio (local) or OpenRouter (cloud) - configurable via environment
- **Styling**: Premium Glassmorphism UI
- **Ingestion**: Decoupled parallel pipeline (Fast Data Load + Async Vectorization)

---

*This tool processes all data locally to ensure maximum privacy and compliance.*

## ✅ ToDo / Roadmap

- [ ] **API Ingestion**: Complete the refactor of the live endpoint sync engine (currently under construction).
- [ ] **Similarity Clustering**: Implement a view to group similar records by their vector embeddings for bulk analysis. More details and constraints are needed here.
- [ ] **Advanced Filtering**: Is this something we want? Should we be able to filter by different metadata fields?
- [ ] **Multi-Model Testing**: Enable a "comparison mode" to run the same alignment check across different LLM models.
