-- Ensure no UPDATE policy exists for likert_scores table
-- Note: Application only uses INSERT and SELECT operations on likert_scores
-- (uses CREATE for initial scoring and SELECT for viewing)
-- This is a safety measure to ensure no UPDATE policy remains
-- (may have been dropped by prior migration, but using IF EXISTS is safe)

DROP POLICY IF EXISTS "Users can update own likert scores" ON public.likert_scores;
