-- Update bonus_windows to track all users instead of specific users
-- This migration requires bonus_windows table to exist (created in 20260201022634 or 20260203000001)

-- Drop columns if they exist (idempotent)
ALTER TABLE public.bonus_windows
DROP COLUMN IF EXISTS user_id,
DROP COLUMN IF EXISTS user_email;

-- Add name column if it doesn't exist (idempotent)
ALTER TABLE public.bonus_windows
ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Bonus Window';

-- Drop the old index on user_id since it no longer exists
DROP INDEX IF EXISTS bonus_windows_user_id_idx;
