-- Ensure bonus_windows table exists with current schema
-- This is a fix for production where the table may not exist despite migration history showing it was applied

-- Create the table if it doesn't exist (with the updated schema after all modifications)
CREATE TABLE IF NOT EXISTS public.bonus_windows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL DEFAULT 'Bonus Window',
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    target_task_count INTEGER NOT NULL DEFAULT 0,
    target_feedback_count INTEGER NOT NULL DEFAULT 0,
    target_task_count_tier2 INTEGER DEFAULT 0,
    target_feedback_count_tier2 INTEGER DEFAULT 0,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT at_least_one_target CHECK (target_task_count > 0 OR target_feedback_count > 0)
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS bonus_windows_time_range_idx ON public.bonus_windows(start_time, end_time);

-- Enable Row Level Security
ALTER TABLE public.bonus_windows ENABLE ROW LEVEL SECURITY;

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_bonus_windows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bonus_windows_updated_at ON public.bonus_windows;
CREATE TRIGGER bonus_windows_updated_at
    BEFORE UPDATE ON public.bonus_windows
    FOR EACH ROW
    EXECUTE FUNCTION update_bonus_windows_updated_at();

-- Create policies only if they don't already exist
-- Note: RLS policies control all access; role-level GRANTs are not needed when RLS is enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'bonus_windows' AND policyname = 'Managers and Admins can view all bonus windows'
  ) THEN
    CREATE POLICY "Managers and Admins can view all bonus windows"
    ON public.bonus_windows
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = ANY (ARRAY['MANAGER'::"UserRole", 'ADMIN'::"UserRole"])
        )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'bonus_windows' AND policyname = 'Managers and Admins can create bonus windows'
  ) THEN
    CREATE POLICY "Managers and Admins can create bonus windows"
    ON public.bonus_windows
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = ANY (ARRAY['MANAGER'::"UserRole", 'ADMIN'::"UserRole"])
        )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'bonus_windows' AND policyname = 'Managers and Admins can update bonus windows'
  ) THEN
    CREATE POLICY "Managers and Admins can update bonus windows"
    ON public.bonus_windows
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = ANY (ARRAY['MANAGER'::"UserRole", 'ADMIN'::"UserRole"])
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = ANY (ARRAY['MANAGER'::"UserRole", 'ADMIN'::"UserRole"])
        )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'bonus_windows' AND policyname = 'Managers and Admins can delete bonus windows'
  ) THEN
    CREATE POLICY "Managers and Admins can delete bonus windows"
    ON public.bonus_windows
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = ANY (ARRAY['MANAGER'::"UserRole", 'ADMIN'::"UserRole"])
        )
    );
  END IF;
END $$;
