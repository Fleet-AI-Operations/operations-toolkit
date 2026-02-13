-- Add contract_id column to time_entries table
-- This stores the Deel contract ID for correlating time entries with Deel contracts

ALTER TABLE public.time_entries
ADD COLUMN IF NOT EXISTS contract_id TEXT;

-- Add index for efficient contract_id queries
CREATE INDEX IF NOT EXISTS idx_time_entries_contract_id
ON public.time_entries(contract_id);

-- Add comment to document the contract_id field
COMMENT ON COLUMN public.time_entries.contract_id IS 'Deel contract ID associated with this time entry (from Deel API /rest/v2/contracts)';
