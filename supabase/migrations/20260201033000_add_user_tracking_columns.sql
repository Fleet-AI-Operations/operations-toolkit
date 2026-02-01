-- Add user tracking columns to data_records table
ALTER TABLE public.data_records
ADD COLUMN IF NOT EXISTS "createdById" TEXT,
ADD COLUMN IF NOT EXISTS "createdByName" TEXT,
ADD COLUMN IF NOT EXISTS "createdByEmail" TEXT;

-- Create index for faster queries by creator
CREATE INDEX IF NOT EXISTS idx_data_records_created_by ON public.data_records("createdById");
