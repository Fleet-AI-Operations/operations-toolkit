-- Add deel_timesheet_id column to time_entries table
-- This stores the Deel timesheet ID returned after successful submission

ALTER TABLE public.time_entries
ADD COLUMN IF NOT EXISTS deel_timesheet_id TEXT;

-- Add index for efficient timesheet_id queries
CREATE INDEX IF NOT EXISTS idx_time_entries_deel_timesheet_id
ON public.time_entries(deel_timesheet_id);

-- Add comment to document the field
COMMENT ON COLUMN public.time_entries.deel_timesheet_id IS 'Deel timesheet ID returned from POST /rest/v2/timesheets API after successful submission';
