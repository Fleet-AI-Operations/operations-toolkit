-- Fix empty embeddings by setting them to NULL
-- This handles records that may have been created with empty arrays '{}' which are invalid for vector types

-- Update any records with empty embedding arrays to NULL
UPDATE data_records
SET embedding = NULL
WHERE embedding IS NOT NULL
  AND cardinality(embedding) = 0;

-- Add a comment to document the column
COMMENT ON COLUMN data_records.embedding IS 'Vector representation for similarity searches. NULL if not yet generated.';
