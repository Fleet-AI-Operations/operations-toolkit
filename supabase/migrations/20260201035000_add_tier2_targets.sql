-- Add optional tier 2 targets for bonus windows
-- This migration requires bonus_windows table to exist

-- Add columns if they don't exist (idempotent)
ALTER TABLE public.bonus_windows
ADD COLUMN IF NOT EXISTS target_task_count_tier2 INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS target_feedback_count_tier2 INTEGER DEFAULT 0;

COMMENT ON COLUMN public.bonus_windows.target_task_count_tier2 IS 'Optional higher tier task target for enhanced bonus';
COMMENT ON COLUMN public.bonus_windows.target_feedback_count_tier2 IS 'Optional higher tier feedback target for enhanced bonus';
