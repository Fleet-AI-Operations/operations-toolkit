-- Add optional count field to time_entries for tracking task counts
ALTER TABLE public.time_entries
ADD COLUMN count INTEGER;

-- Add comment to explain the purpose
COMMENT ON COLUMN public.time_entries.count IS 'Optional count for categories like Writing New Tasks, Updating Tasks Based on Feedback, and Time Spent on QA';
