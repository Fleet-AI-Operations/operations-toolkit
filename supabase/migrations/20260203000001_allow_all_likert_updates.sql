-- Allow users to update any likert scores, not just their own
-- This enables collaborative scoring where users can adjust any score
--
-- SECURITY NOTE: This policy allows ANY authenticated user to modify ANY likert score,
-- including scores created by other users. This is intentional for collaborative scoring
-- but removes data ownership and individual accountability. Consider implications for:
-- - Score integrity and audit trails
-- - Potential for score manipulation
-- - Analytics based on user-specific scoring patterns
--
-- If stricter control is needed, consider restricting to managers/admins only.

DROP POLICY IF EXISTS "Users can update own likert scores" ON public.likert_scores;

CREATE POLICY "Users can update any likert scores"
  ON public.likert_scores
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
