-- Daily duplicate detection job via pg_cron.
--
-- Schedules a job at 05:00 UTC (midnight EST / 01:00 EDT) that:
--   1. TRUNCATEs the staging table
--   2. Repopulates it with IDs of duplicate DataRecord rows
--      (keeps the oldest record per environment+content pair, marks the rest for deletion)
--
-- The staging table is used by the Admin > Configuration page to show how many
-- duplicate records are pending removal, and by the batched deletion script.
--
-- NOTES:
--   - pg_cron is pre-installed on Supabase Cloud.
--   - The table may already exist if the manual dedup script was run previously;
--     CREATE TABLE IF NOT EXISTS is safe to re-run.
--   - To run the detection immediately (outside the cron schedule):
--       SELECT cron.schedule('populate-duplicates-daily', '0 5 * * *', $$ ... $$);
--     Or call the body directly in the SQL editor.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Staging table: holds IDs of DataRecord rows identified as duplicates.
-- Safe to re-run; will not drop existing data.
CREATE TABLE IF NOT EXISTS public._duplicates_to_delete (
    id TEXT NOT NULL
);

-- Remove any existing schedule with this name so we can safely re-apply the migration.
SELECT cron.unschedule('populate-duplicates-daily')
WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'populate-duplicates-daily'
);

-- Schedule: 05:00 UTC daily (midnight EST).
SELECT cron.schedule(
    'populate-duplicates-daily',
    '0 5 * * *',
    $$
        TRUNCATE public._duplicates_to_delete;
        INSERT INTO public._duplicates_to_delete (id)
        SELECT id
        FROM (
            SELECT
                id,
                ROW_NUMBER() OVER (
                    PARTITION BY environment, content
                    ORDER BY "createdAt" ASC
                ) AS rn
            FROM public."DataRecord"
        ) sub
        WHERE rn > 1;
    $$
);
