-- Allow users to update any likert scores, not just their own
-- This enables collaborative scoring where users can adjust any score

DROP POLICY IF EXISTS "Users can update own likert scores" ON public.likert_scores;

CREATE POLICY "Users can update any likert scores"
  ON public.likert_scores
  FOR UPDATE
  TO authenticated
  USING (true);
