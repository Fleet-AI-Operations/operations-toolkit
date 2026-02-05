-- Fix vector dimension for OpenRouter embedding model
-- OpenRouter's openai/text-embedding-3-small returns 1536 dimensions
-- Local models (nomic-embed) use 1024 dimensions

-- Change embedding column from vector(1024) to vector(1536)
ALTER TABLE public.data_records
ALTER COLUMN embedding TYPE vector(1536);

-- Note: Existing embeddings with 1024 dimensions will be padded with zeros
-- or you may want to regenerate them with the new model
