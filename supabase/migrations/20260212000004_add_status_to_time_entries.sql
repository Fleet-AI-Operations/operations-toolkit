-- Add status column to time_entries table
-- This tracks whether entries have been sent to the external API

ALTER TABLE public.time_entries
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';

-- Add index for efficient status queries
CREATE INDEX IF NOT EXISTS idx_time_entries_status
ON public.time_entries(status);

-- Add comment to document the status field
COMMENT ON COLUMN public.time_entries.status IS 'Tracks API sync status: pending (not sent), processing (in progress), sent (successfully synced), failed (sync error)';
