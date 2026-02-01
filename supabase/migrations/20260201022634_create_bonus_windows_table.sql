-- Create bonus_windows table for tracking user performance windows
CREATE TABLE IF NOT EXISTS public.bonus_windows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    target_count INTEGER NOT NULL CHECK (target_count > 0),
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries by user_id
CREATE INDEX IF NOT EXISTS bonus_windows_user_id_idx ON public.bonus_windows(user_id);

-- Create index for time-based queries
CREATE INDEX IF NOT EXISTS bonus_windows_time_range_idx ON public.bonus_windows(start_time, end_time);

-- Enable Row Level Security
ALTER TABLE public.bonus_windows ENABLE ROW LEVEL SECURITY;

-- Policy: Managers and Admins can view all bonus windows
CREATE POLICY "Managers and Admins can view all bonus windows"
ON public.bonus_windows
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('MANAGER', 'ADMIN')
    )
);

-- Policy: Managers and Admins can create bonus windows
CREATE POLICY "Managers and Admins can create bonus windows"
ON public.bonus_windows
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('MANAGER', 'ADMIN')
    )
);

-- Policy: Managers and Admins can update bonus windows
CREATE POLICY "Managers and Admins can update bonus windows"
ON public.bonus_windows
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('MANAGER', 'ADMIN')
    )
);

-- Policy: Managers and Admins can delete bonus windows
CREATE POLICY "Managers and Admins can delete bonus windows"
ON public.bonus_windows
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('MANAGER', 'ADMIN')
    )
);

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_bonus_windows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bonus_windows_updated_at
    BEFORE UPDATE ON public.bonus_windows
    FOR EACH ROW
    EXECUTE FUNCTION update_bonus_windows_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bonus_windows TO authenticated;
GRANT SELECT ON public.bonus_windows TO anon;
