-- Flag column on data_records
ALTER TABLE public.data_records
    ADD COLUMN IF NOT EXISTS is_daily_great BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_data_records_daily_great
    ON public.data_records (is_daily_great)
    WHERE is_daily_great = true;

-- match_type on similarity_flags
ALTER TABLE public.similarity_flags
    ADD COLUMN IF NOT EXISTS match_type TEXT NOT NULL DEFAULT 'USER_HISTORY';

-- Drop old unique constraint (source+matched), replace with (source+matched+match_type)
-- so the same pair can be flagged as both USER_HISTORY and DAILY_GREAT independently
ALTER TABLE public.similarity_flags
    DROP CONSTRAINT IF EXISTS similarity_flags_source_record_id_matched_record_id_key;

ALTER TABLE public.similarity_flags
    ADD CONSTRAINT similarity_flags_source_matched_type_key
    UNIQUE (source_record_id, matched_record_id, match_type);

-- Allow ingest_job_id to be NULL so manual/standalone jobs can be created
ALTER TABLE public.similarity_jobs
    ALTER COLUMN ingest_job_id DROP NOT NULL;
