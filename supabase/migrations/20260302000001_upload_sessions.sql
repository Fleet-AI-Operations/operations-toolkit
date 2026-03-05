-- Upload sessions for chunked CSV ingestion
-- Replaces filesystem-based session storage (/tmp) which is not shared
-- across Vercel serverless invocations.

CREATE TABLE IF NOT EXISTS public.upload_sessions (
    id TEXT PRIMARY KEY,
    file_name TEXT NOT NULL,
    total_chunks INTEGER NOT NULL,
    generate_embeddings BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.upload_chunks (
    session_id TEXT NOT NULL REFERENCES public.upload_sessions(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    PRIMARY KEY (session_id, chunk_index)
);

-- Used by opportunistic cleanup to quickly find expired sessions
CREATE INDEX IF NOT EXISTS idx_upload_sessions_expires_at ON public.upload_sessions (expires_at);
