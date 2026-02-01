-- Update bonus_windows to track all users instead of specific users
ALTER TABLE public.bonus_windows
DROP COLUMN user_id,
DROP COLUMN user_email;

-- Add a name/description field for better identification
ALTER TABLE public.bonus_windows
ADD COLUMN name TEXT NOT NULL DEFAULT 'Bonus Window';

-- Drop the old index on user_id since it no longer exists
DROP INDEX IF EXISTS bonus_windows_user_id_idx;
