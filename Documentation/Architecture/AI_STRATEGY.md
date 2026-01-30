# AI Strategy & Alignment Logic

The core value of the Operations Tools is its ability to ground AI analysis in specific project guidelines using local-first processing.

## Guideline Alignment Check (RAG)

When a user clicks "Generate Alignment Score", the tool performs a Retrieval-Augmented Generation (RAG) cycle:

### 1. Context Extraction
- **The Record**: The specific prompt or feedback content.
- **The Guidelines**: The tool retrieves the base64-encoded PDF guidelines from the `Project` model.
- **OCR/Scraping**: We use `pdf-parse` to extract raw text content from the PDF for grounding.

### 2. Prompt Grounding
The LLM is given a specialized "Alignment Lead" system prompt. The request includes the raw Guidelines text and the Item Content, requiring a structured breakdown:
- **Alignment Score** (1-10)
- **Strengths/Weaknesses**
- **Improvement Suggestions**

### 3. Numerical Scoring
To ensure data consistency, the UI uses a **Regex Extractor** (`extractAlignmentScore`) to translate the LLM's natural language response into a numeric value for badge color-coding.

## High-Performance Vector Embeddings

The tool uses vector embeddings for semantic similarity and future clustering features.

### 1. Batch Processing
To maximize throughput, the system never sends records one-by-one. It uses a **Batch Multiplier** (default: 25) which is significantly faster for local AI hosts like LM Studio.

### 2. Tokenizer Sanitation
Different embedding models (e.g., Qwen, Nomic) have different requirements. The tool implements an **AI Sanitizer** that:
- Trims whitespace.
- Normalizes text input.
- Prevents empty/null tokenization errors.
- Mitigates `SEP` token warnings in GGML/GGUF models.

## Collaborative Prompting Model

The `src/lib/ai.ts` layer standardizes logic across the app:
- **Dynamic Configuration**: Easily switch between LLM models (e.g., Llama 3.1) and Embedding models (e.g., Qwen 3) via `.env`.
- **Error Resilience**: Automatic fallback to empty vectors on AI timeout to prevent database ingestion hangs.
- **Local Proxy-Ready**: Designed to connect to any OpenAI-compatible API host (Defaulting to `http://localhost:1234/v1`).

## Cost Tracking Architecture

When using OpenRouter, the system tracks API costs at multiple levels:

### Response-Level Tracking
- OpenRouter includes `usage` data in each API response (prompt tokens, completion tokens, cost)
- The `generateCompletionWithUsage()` function extracts and returns this data alongside the content
- Per-operation costs are displayed in the UI after each AI call

### Balance Monitoring
- A dedicated `/api/ai/balance` endpoint queries OpenRouter's key info API
- Returns current credits, usage, and limits
- Dashboard polls this on load to show real-time balance

### Data Flow
```
User Action -> API Route -> ai.ts (captures usage) -> Response with cost
                                                           |
Dashboard <- /api/ai/balance <- OpenRouter Key API <------+
```

### Privacy Note
Cost data is displayed transiently after each operation and is not persisted to the database.
