-- Fix empty embeddings by setting them to NULL
-- This handles records that may have been created with empty arrays/vectors
-- PostgreSQL arrays are represented as '{}' and pgvector vectors as '[]'

-- Update any records with empty embeddings to NULL
-- Cast to text for comparison to avoid type-specific function issues
UPDATE data_records
SET embedding = NULL
WHERE embedding IS NOT NULL
  AND (embedding::text = '{}' OR embedding::text = '[]');

-- Add a comment to document the column
COMMENT ON COLUMN data_records.embedding IS 'Vector representation for similarity searches. NULL if not yet generated.';
