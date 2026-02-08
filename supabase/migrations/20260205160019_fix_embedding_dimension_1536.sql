-- Fix vector dimension for OpenRouter embedding model
-- OpenRouter's openai/text-embedding-3-small returns 1536 dimensions
-- Local models (nomic-embed) use 1024 dimensions

-- Ensure pgvector extension is installed
CREATE EXTENSION IF NOT EXISTS vector;

-- IMPORTANT: Clear existing 1024-dimension embeddings before changing dimension
-- Existing vectors are incompatible with the new dimension and must be regenerated
UPDATE public.data_records SET embedding = NULL WHERE embedding IS NOT NULL;

-- Change embedding column from vector(1024) to vector(1536)
ALTER TABLE public.data_records
ALTER COLUMN embedding TYPE vector(1536);

-- Note: Existing data will need to be re-vectorized with the new embedding model
