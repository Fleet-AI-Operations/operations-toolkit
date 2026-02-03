-- Update bonus_windows to have separate targets for tasks and feedback
-- This migration requires bonus_windows table to exist

-- Add new columns if they don't exist (idempotent)
ALTER TABLE public.bonus_windows
ADD COLUMN IF NOT EXISTS target_task_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS target_feedback_count INTEGER NOT NULL DEFAULT 0;

-- Drop the old single target_count column if it exists (idempotent)
ALTER TABLE public.bonus_windows
DROP COLUMN IF EXISTS target_count;

-- Add constraint if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'at_least_one_target' AND conrelid = 'public.bonus_windows'::regclass
  ) THEN
    ALTER TABLE public.bonus_windows
    ADD CONSTRAINT at_least_one_target CHECK (target_task_count > 0 OR target_feedback_count > 0);
  END IF;
END $$;
