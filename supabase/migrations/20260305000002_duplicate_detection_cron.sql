-- Daily duplicate detection job via pg_cron.
--
-- Schedules a job at 05:00 UTC daily that:
--   1. TRUNCATEs the staging table
--   2. Repopulates it with IDs of duplicate DataRecord rows
--      (keeps the oldest record per environment+content pair, marks the rest for deletion)
--
-- The staging table is used by the Admin > Configuration page to show how many
-- duplicate records are pending removal, and by the POST /api/admin/duplicate-records/delete
-- API route which deletes them in batches.
--
-- NOTES:
--   - pg_cron is pre-installed on Supabase Cloud.
--   - To run the detection immediately (outside the cron schedule), paste and execute
--     the body of the $$...$$ block directly in the Supabase SQL editor.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Staging table: holds IDs of DataRecord rows identified as duplicates.
CREATE TABLE IF NOT EXISTS public._duplicates_to_delete (
    id TEXT NOT NULL PRIMARY KEY
);

-- Remove any existing schedule with this name so this migration is safely re-runnable.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'populate-duplicates-daily') THEN
        PERFORM cron.unschedule('populate-duplicates-daily');
    END IF;
END
$$;

-- Schedule: 05:00 UTC daily.
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
