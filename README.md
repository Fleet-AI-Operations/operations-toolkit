# Operations Tools

A turborepo monorepo with 5 specialized Next.js applications for AI alignment, data ingestion, and operations management.

## 🏗️ Architecture

This project uses **Turborepo** with a multi-app architecture:

### Applications (5)
- **🏠 User App** (port 3001) - Time tracking and links for all users
- **📊 QA App** (port 3002) - Analysis tools, records management, similarity search
- **⭐ Core App** (port 3003) - Likert scoring and review decisions
- **🚀 Fleet App** (port 3004) - Data ingestion, analytics, project management
- **🔧 Admin App** (port 3005) - User management, system configuration, audit logs

### Shared Packages (6)
- **@repo/ui** - Shared React components (AppSwitcher, etc.)
- **@repo/database** - Prisma client and schema
- **@repo/auth** - Supabase authentication utilities
- **@repo/core** - Business logic (AI, ingestion, evaluation, analytics)
- **@repo/api-utils** - API route helpers
- **@repo/types** - Shared TypeScript types

See [APP_NAVIGATION_GUIDE.md](./APP_NAVIGATION_GUIDE.md) for feature mapping across apps.

## 📚 Documentation

**→ [Complete Documentation Index](./Documentation/INDEX.md)** - Central hub for all documentation with task-based and role-based navigation.

### Quick Links

#### Getting Started
- [**Local Development Guide**](./Documentation/LOCAL_DEVELOPMENT.md) - Turborepo development workflow
- [**User Guide**](./Documentation/USER_GUIDE.md) - How to use the applications
- [**User Management**](./Documentation/USER_MANAGEMENT.md) - Roles and permissions

#### Development
- [**Testing Guide**](./Documentation/TESTING.md) - How to run and write tests in the monorepo
- [**API Reference**](./Documentation/Reference/API_REFERENCE.md) - Complete REST API documentation
- [**Database Schema**](./Documentation/Reference/DATABASE_SCHEMA.md) - Database schema with ERD

#### Architecture
- [**System Overview**](./Documentation/Architecture/OVERVIEW.md) - Tech stack and turborepo structure
- [**Ingestion Flow**](./Documentation/Architecture/INGESTION_FLOW.md) - Background processes and queuing
- [**AI Strategy**](./Documentation/Architecture/AI_STRATEGY.md) - RAG-based alignment and embeddings

#### Operations
- [**Production Setup**](./Documentation/SETUP.md) - Environment configuration and deployment
- [**Vercel Deployment**](./Documentation/VERCEL.md) - Multi-app Vercel deployment guide
- [**Troubleshooting**](./Documentation/TROUBLESHOOTING.md) - Common issues and solutions
- [**Security**](./Documentation/SECURITY.md) - Security best practices

## ✨ Core Features

- **🚀 Parallel Ingestion Pipeline**: Decouples high-speed data loading from AI vectorization. Ingest thousands of records instantly while embeddings generate in the background.
- **🧠 AI-Powered Alignment Analysis**: Automatically evaluate Tasks and Feedback against project-specific guidelines using local LLM models (Llama 3.1, Qwen, etc.).
- **📊 Bulk Analytics Engine**: Process entire datasets sequentially in the background. Includes real-time progress tracking and job cancellation support.
- **🛡️ Hierarchical RBAC**: Role-based access control with 6 roles (PENDING, USER, QA, CORE, FLEET, ADMIN) and hierarchical permissions.
- **🛡️ Flexible AI Providers**: Supports both local AI (LM Studio) for maximum privacy and cloud AI (OpenRouter) for convenience. Switch providers with a single environment variable.
- **💰 Cost Tracking**: Real-time OpenRouter API cost tracking with per-query costs and account balance display on the dashboard.
- **🎯 Semantic Search**: Find similar prompts and feedback across projects using vector embeddings (Cosine Similarity).
- **🛠️ Admin Console**: Dynamic AI configuration (Host, Model, Provider), centralized management for bulk data wipes, and detailed system status.
- **🔍 Transparent Ingestion**: Detailed tracking of skipped records (e.g., duplicates, keyword mismatches) with visual breakdown in the UI.
- **💎 Premium UI/UX**: Fully responsive, high-fidelity glassmorphism interface with interactive data visualizations and real-time status polling.
- **🧪 Quality Assurance**: Integrated unit testing (Vitest) and E2E testing (Playwright) suites for robust development.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- pnpm 9+ (recommended for monorepos)
- PostgreSQL (via Supabase)

### Local Development

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Start Supabase (PostgreSQL + Auth)**:
   ```bash
   npm run dev:supabase  # Starts local Supabase stack
   ```

3. **Generate Prisma Client**:
   ```bash
   npm run postinstall
   ```

4. **Start all apps** (development mode):
   ```bash
   pnpm turbo run dev
   ```

   Or start individual apps:
   ```bash
   pnpm turbo run dev --filter=@repo/user-app
   pnpm turbo run dev --filter=@repo/qa-app
   pnpm turbo run dev --filter=@repo/core-app
   pnpm turbo run dev --filter=@repo/fleet-app
   pnpm turbo run dev --filter=@repo/admin-app
   ```

5. **Access applications**:
   - User App: http://localhost:3001
   - QA App: http://localhost:3002
   - Core App: http://localhost:3003
   - Fleet App: http://localhost:3004
   - Admin App: http://localhost:3005
   - Supabase Studio: http://localhost:54323

### Build All Apps

```bash
pnpm turbo run build
```

Turborepo will intelligently cache builds and only rebuild changed packages.

### Run Tests

```bash
# Unit tests (all packages)
pnpm turbo run test

# E2E tests (requires Supabase running)
npm run test:e2e
```

## 🛠 Tech Stack

- **Monorepo**: Turborepo with pnpm workspaces
- **Framework**: Next.js 16 (App Router) × 5 apps
- **Database**: PostgreSQL (Prisma ORM) + Supabase Auth
- **Observability**: Vercel Analytics & Speed Insights
- **AI**: LM Studio (local) or OpenRouter (cloud) - configurable via environment
- **Styling**: Premium Glassmorphism UI (Tailwind CSS)
- **Build Tool**: Turbopack (Next.js 16)
- **Testing**: Vitest (unit) + Playwright (E2E)

## 🌐 Deployment

Each app deploys independently to Vercel with its own vercel.json configuration:

```bash
# Deploy Fleet app (example)
cd apps/fleet
vercel deploy --prod
```

**Domain structure**:
- `user-app.vercel.app` (or custom domain)
- `qa-app.vercel.app`
- `core-app.vercel.app`
- `fleet-app.vercel.app`
- `admin-app.vercel.app`

All apps share a single Supabase database. See [VERCEL.md](./Documentation/VERCEL.md) for detailed deployment instructions.

## 💰 Cost Tracking (OpenRouter)

When using OpenRouter as your AI provider, the tool automatically tracks API costs:

- **Per-query costs**: See the cost of each alignment analysis displayed after completion
- **Account balance**: View your remaining OpenRouter credits in the dashboard header

Cost information appears after each AI operation. Balance refreshes when the dashboard loads.

*Note: Cost tracking is only available with OpenRouter. LM Studio operations are free (local compute).*

## 🔐 Authentication & Roles

- **Authentication**: Supabase Auth (SSO across all apps)
- **User Creation**: Admin-only via User Management page (no self-service signup)
- **Role Hierarchy**: PENDING → USER → QA → CORE → FLEET → ADMIN
- **Permissions**: Higher roles inherit lower role permissions

See [USER_MANAGEMENT.md](./Documentation/USER_MANAGEMENT.md) for role descriptions and access control.

---

*This tool processes all data locally to ensure maximum privacy and compliance.*

## ✅ Roadmap

- [ ] **API Ingestion**: Complete the refactor of the live endpoint sync engine (currently under construction).
- [ ] **Similarity Clustering**: Implement a view to group similar records by their vector embeddings for bulk analysis.
- [ ] **Advanced Filtering**: Filter by different metadata fields across analysis tools.
- [ ] **Multi-Model Testing**: Enable a "comparison mode" to run the same alignment check across different LLM models.
- [ ] **Duplicate Strategy**: Handle duplicate task_ids with configurable merge/update strategies.
