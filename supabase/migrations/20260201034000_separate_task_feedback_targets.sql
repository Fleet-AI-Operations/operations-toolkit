-- Update bonus_windows to have separate targets for tasks and feedback
ALTER TABLE public.bonus_windows
ADD COLUMN IF NOT EXISTS target_task_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS target_feedback_count INTEGER NOT NULL DEFAULT 0;

-- Drop the old single target_count column
ALTER TABLE public.bonus_windows
DROP COLUMN IF EXISTS target_count;

-- Add constraint to ensure at least one target is set
ALTER TABLE public.bonus_windows
ADD CONSTRAINT at_least_one_target CHECK (target_task_count > 0 OR target_feedback_count > 0);
