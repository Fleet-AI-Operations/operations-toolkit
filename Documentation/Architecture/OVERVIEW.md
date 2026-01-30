# Architectural Overview

The Operations Tools is built with a **Local-First AI** philosophy. Heavy lifting (LLM analysis and Vector Embeddings) runs on local hardware via LM Studio, ensuring data privacy and zero API costs.

## System Diagram

```mermaid
graph TD
    User((User)) --> WebUI[Next.js Frontend]
    WebUI --> API[Next.js API Routes]
    
    subgraph "Backend Services"
        API --> DB[(PostgreSQL / Prisma)]
        API --> IngestLib[Ingestion Service]
        API --> AIService[AI Service Layer]
    end
    
    subgraph "Local AI Host (LM Studio)"
        AIService --> LLM[LLM / Llama 3.1]
        AIService --> Vector[Embedding / Qwen]
    end
    
    IngestLib --> Queue[Parallel Phase Queue]
    Queue --> DB
```

## Tech Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Styling**: Premium Glassmorphism UI (Vanilla CSS + Lucide Icons).
- **Features**: Real-time progress polling, background job management.

### Backend
- **ORM**: Prisma 7.
- **Database**: PostgreSQL (Relational data + JSON metadata + Vector arrays).
- **Processing**: Decoupled ingestion pipeline (Fast load + Async AI).

### AI Service Layer
- **Host**: Any OpenAI-compatible server (LM Studio validated, OpenRouter supported).
- **Logic**: RAG-based extraction, batch vectorization, and content sanitation.
- **Cost Tracking**: OpenRouter usage costs are captured from API responses and displayed in the UI.

## Core Data Models

1. **Project**: Organizational container holding Guidelines (PDF grounding data).
2. **DataRecord**: Individual tasks/feedback containing raw content and generated embeddings.
3. **IngestJob**: Lifecycle tracker for background processes. Supports parallel loading and sequential vectorization across jobs.
