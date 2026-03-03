-- Add functional index on metadata->>'task_key' to speed up task key lookups
-- and ingestion duplicate detection queries.
CREATE INDEX IF NOT EXISTS idx_data_records_task_key
ON public.data_records ((metadata->>'task_key'));
