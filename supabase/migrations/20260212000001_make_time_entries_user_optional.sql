-- ⚠️ SECURITY NOTE: This migration supports unauthenticated time entry submission ⚠️
--
-- This migration enables recording time entries via an unauthenticated API endpoint
-- for browser extension integration during development/MVP phase.
--
-- CRITICAL: This implementation has NO AUTHENTICATION and must be secured before
-- production deployment. See Documentation/TIME_TRACKING_SECURITY_ROADMAP.md
-- for the complete security implementation plan.
--
-- Make user_id optional for time entries from browser extensions
-- This allows recording time for users who haven't been created yet

-- Add email column to store the user's email (for later linking when user is created)
ALTER TABLE public.time_entries
ADD COLUMN email TEXT;

-- Make user_id nullable
ALTER TABLE public.time_entries
ALTER COLUMN user_id DROP NOT NULL;

-- Update the foreign key constraint to handle NULL user_id
-- (The existing FK constraint already handles this since we're just making the column nullable)

-- Add index on email for faster lookups when linking users later
CREATE INDEX IF NOT EXISTS idx_time_entries_email ON public.time_entries(email);

-- Add comment explaining the purpose
COMMENT ON COLUMN public.time_entries.email IS 'Email address for time entries from browser extension. Used to link entries to users when they are created.';
COMMENT ON COLUMN public.time_entries.user_id IS 'User ID (nullable). NULL for entries created before user exists in system.';

-- Update RLS policies to allow viewing entries by email for unauthenticated creation
-- Keep existing policies for authenticated users

-- Policy: Allow INSERT without authentication (for browser extension)
-- This replaces the existing insert policy to allow NULL user_id
DROP POLICY IF EXISTS "Users can insert own time entries" ON public.time_entries;
CREATE POLICY "Users can insert own time entries"
    ON public.time_entries
    FOR INSERT
    WITH CHECK (
        -- Either authenticated user matches user_id
        (auth.uid() = user_id)
        OR
        -- Or user_id is NULL (browser extension creating entry for not-yet-created user)
        (user_id IS NULL)
    );

-- Policy: Allow viewing entries by email (for when user is created and needs to see past entries)
CREATE POLICY "Users can view entries by email"
    ON public.time_entries
    FOR SELECT
    USING (
        auth.uid() = user_id
        OR
        (
            auth.uid() IS NOT NULL
            AND email = (SELECT email FROM public.profiles WHERE id = auth.uid())
        )
    );
