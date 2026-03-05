-- Enable pg_trgm for ILIKE index support
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram indexes for ILIKE '%q%' on name/email (partial: TASK only)
CREATE INDEX IF NOT EXISTS idx_data_records_task_email_trgm
    ON public.data_records USING gin ("createdByEmail" gin_trgm_ops)
    WHERE type = 'TASK';

CREATE INDEX IF NOT EXISTS idx_data_records_task_name_trgm
    ON public.data_records USING gin ("createdByName" gin_trgm_ops)
    WHERE type = 'TASK';

-- Expression indexes for metadata field lookups (partial: TASK only)
CREATE INDEX IF NOT EXISTS idx_data_records_task_key
    ON public.data_records ((metadata->>'task_key'))
    WHERE type = 'TASK';

CREATE INDEX IF NOT EXISTS idx_data_records_task_id_meta
    ON public.data_records ((metadata->>'task_id'))
    WHERE type = 'TASK';

-- Index for ORDER BY createdAt DESC (partial: TASK only)
CREATE INDEX IF NOT EXISTS idx_data_records_task_created_at
    ON public.data_records ("createdAt" DESC)
    WHERE type = 'TASK';
