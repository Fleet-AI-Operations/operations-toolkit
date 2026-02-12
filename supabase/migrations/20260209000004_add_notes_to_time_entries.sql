-- Add optional notes field to time_entries for additional context
ALTER TABLE public.time_entries
ADD COLUMN notes TEXT;

-- Add comment to explain the purpose
COMMENT ON COLUMN public.time_entries.notes IS 'Optional additional notes or context about the time entry';
