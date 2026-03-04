-- ============================================================================
-- Partial index to speed up the createdByName/createdByEmail backfill query
--
-- The backfill script (scripts/backfill-created-by.ts) runs a batch UPDATE
-- that must find rows where both creator columns are NULL. Without this index,
-- every batch requires a full sequential scan of data_records regardless of
-- how many rows still need processing.
--
-- This partial index covers only the unprocessed rows, so:
--   - The planner jumps straight to unprocessed rows via the index
--   - The index shrinks automatically as rows are backfilled (updated rows
--     no longer satisfy the WHERE clause and fall out of the index)
--   - Zero overhead on already-backfilled rows
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_data_records_needs_creator_backfill
    ON public.data_records (id)
    WHERE "createdByName" IS NULL AND "createdByEmail" IS NULL;
