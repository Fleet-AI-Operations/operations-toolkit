-- Create time_entries table for user time tracking
CREATE TABLE IF NOT EXISTS public.time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    hours INTEGER NOT NULL CHECK (hours >= 0 AND hours <= 23),
    minutes INTEGER NOT NULL CHECK (minutes >= 0 AND minutes <= 59),
    category TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON public.time_entries(user_id);

-- Create index on date for date range queries
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON public.time_entries(date);

-- Create composite index for user and date queries
CREATE INDEX IF NOT EXISTS idx_time_entries_user_date ON public.time_entries(user_id, date DESC);

-- Enable Row Level Security
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own time entries
CREATE POLICY "Users can view own time entries"
    ON public.time_entries
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own time entries
CREATE POLICY "Users can insert own time entries"
    ON public.time_entries
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own time entries
CREATE POLICY "Users can update own time entries"
    ON public.time_entries
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own time entries
CREATE POLICY "Users can delete own time entries"
    ON public.time_entries
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_time_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_time_entries_updated_at
    BEFORE UPDATE ON public.time_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.update_time_entries_updated_at();
