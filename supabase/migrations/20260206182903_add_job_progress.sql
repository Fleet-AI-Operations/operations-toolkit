-- Add progress tracking to job queue
-- Progress is stored as JSONB with: { current: number, total: number, message?: string }

ALTER TABLE public.job_queue
ADD COLUMN IF NOT EXISTS progress JSONB;

COMMENT ON COLUMN public.job_queue.progress IS 'Job progress tracking: { current: number, total: number, message?: string }';
