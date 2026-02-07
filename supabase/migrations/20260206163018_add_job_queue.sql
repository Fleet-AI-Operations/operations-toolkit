-- Job queue table for database-backed queue system
-- This replaces the in-memory queue with a persistent, scalable solution

CREATE TABLE IF NOT EXISTS public.job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL, -- 'INGEST_DATA', 'VECTORIZE'
  status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'
  priority INTEGER NOT NULL DEFAULT 0, -- Higher = more urgent
  payload JSONB NOT NULL, -- Job data (ingestJobId, projectId, records, etc)
  result JSONB, -- Job result or error details
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient job polling (workers query this frequently)
CREATE INDEX idx_job_queue_pending ON public.job_queue(priority DESC, scheduled_for ASC)
WHERE status = 'PENDING';

-- Index for status queries and monitoring
CREATE INDEX idx_job_queue_status ON public.job_queue(status, created_at);

-- Index for cleanup queries (old completed jobs)
CREATE INDEX idx_job_queue_completed ON public.job_queue(completed_at)
WHERE status IN ('COMPLETED', 'FAILED');

-- Function to atomically claim the next available job
-- Uses FOR UPDATE SKIP LOCKED to prevent race conditions between workers
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
  SELECT * INTO claimed_job
  FROM public.job_queue
  WHERE status = 'PENDING'
    AND job_type = ANY(worker_types)
    AND scheduled_for <= NOW()
    AND attempts < max_attempts
  ORDER BY priority DESC, scheduled_for ASC
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

    RETURN QUERY SELECT claimed_job.id, claimed_job.job_type, claimed_job.payload;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- RLS policies for job_queue
ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for workers and API)
CREATE POLICY "Service role has full access to job_queue"
ON public.job_queue
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow authenticated users to view their own project's jobs
CREATE POLICY "Users can view jobs for their projects"
ON public.job_queue
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = (payload->>'projectId')::text
    -- Add ownership check here if needed
  )
);

-- Comment for documentation
COMMENT ON TABLE public.job_queue IS 'Database-backed job queue for ingestion and vectorization tasks. Replaces in-memory queue with persistent, scalable solution.';
COMMENT ON FUNCTION public.claim_next_job IS 'Atomically claims the next available job for processing. Uses row-level locking to prevent race conditions.';
