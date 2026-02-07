-- Enable pgvector extension for vector similarity search
-- This migration ensures pgvector is available and converts the embedding column
-- from double precision[] to the proper vector type

-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Convert the embedding column from double precision[] to vector(1536)
-- 1536 is the dimension size for OpenAI's text-embedding-3-small model
-- If using a different embedding model with different dimensions, adjust accordingly
ALTER TABLE public.data_records
  ALTER COLUMN embedding TYPE vector(1536)
  USING CASE
    WHEN embedding IS NULL THEN NULL
    ELSE embedding::vector
  END;

-- Create index for faster vector similarity searches (cosine distance)
-- This significantly improves performance for semantic search queries
CREATE INDEX IF NOT EXISTS data_records_embedding_idx
  ON public.data_records
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Note: The index will be built asynchronously. For large datasets, this may take time.
-- You can monitor progress with: SELECT * FROM pg_stat_progress_create_index;
