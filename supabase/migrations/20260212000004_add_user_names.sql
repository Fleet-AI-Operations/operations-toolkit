-- Add firstName and lastName to profiles table
-- These fields are optional to allow existing users to have null values

ALTER TABLE public.profiles
ADD COLUMN "firstName" TEXT,
ADD COLUMN "lastName" TEXT;

-- Add index for name searches (optional, but useful for performance)
CREATE INDEX idx_profiles_names ON public.profiles("firstName", "lastName");
