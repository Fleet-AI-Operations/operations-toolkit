-- Fix claim_next_job function to avoid ambiguous column reference
-- The issue is that the RETURN QUERY needs to explicitly alias columns

DROP FUNCTION IF EXISTS public.claim_next_job(TEXT[]);

CREATE OR REPLACE FUNCTION public.claim_next_job(worker_types TEXT[])
RETURNS TABLE (
  job_id UUID,
  job_type TEXT,
  payload JSONB
) AS $$
DECLARE
  claimed_job RECORD;
BEGIN
  -- Lock and claim the next available job
  -- SKIP LOCKED ensures multiple workers don't grab the same job
  -- Use qualified column names to avoid ambiguity with RETURNS TABLE columns
  SELECT * INTO claimed_job
  FROM public.job_queue
  WHERE job_queue.status = 'PENDING'
    AND job_queue.job_type = ANY(worker_types)
    AND job_queue.scheduled_for <= NOW()
    AND job_queue.attempts < job_queue.max_attempts
  ORDER BY job_queue.priority DESC, job_queue.scheduled_for ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF claimed_job.id IS NOT NULL THEN
    -- Mark as processing
    UPDATE public.job_queue
    SET
      status = 'PROCESSING',
      started_at = NOW(),
      attempts = attempts + 1,
      updated_at = NOW()
    WHERE id = claimed_job.id;

    -- Return with explicit column aliases to avoid ambiguity
    RETURN QUERY SELECT
      claimed_job.id AS job_id,
      claimed_job.job_type AS job_type,
      claimed_job.payload AS payload;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.claim_next_job IS 'Atomically claims the next available job for processing. Uses row-level locking to prevent race conditions.';
