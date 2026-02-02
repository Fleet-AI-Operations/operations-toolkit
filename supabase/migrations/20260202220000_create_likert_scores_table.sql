-- Create likert_scores table
CREATE TABLE IF NOT EXISTS public.likert_scores (
  id TEXT PRIMARY KEY DEFAULT ('lik_' || substr(md5(random()::text || clock_timestamp()::text), 1, 21)),
  "recordId" TEXT NOT NULL REFERENCES public.data_records(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL,
  "realismScore" INTEGER NOT NULL CHECK ("realismScore" >= 1 AND "realismScore" <= 7),
  "qualityScore" INTEGER NOT NULL CHECK ("qualityScore" >= 1 AND "qualityScore" <= 7),
  "llmModel" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT likert_scores_unique_user_record UNIQUE ("recordId", "userId")
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_likert_scores_record ON public.likert_scores("recordId");
CREATE INDEX IF NOT EXISTS idx_likert_scores_user ON public.likert_scores("userId");
CREATE INDEX IF NOT EXISTS idx_likert_scores_llm_model ON public.likert_scores("llmModel");

-- Enable RLS
ALTER TABLE public.likert_scores ENABLE ROW LEVEL SECURITY;

-- Policy: Users can create their own scores
CREATE POLICY "Users can create likert scores"
  ON public.likert_scores
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Users can view all scores (for seeing averages)
CREATE POLICY "Users can view likert scores"
  ON public.likert_scores
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Users can update their own scores
CREATE POLICY "Users can update own likert scores"
  ON public.likert_scores
  FOR UPDATE
  TO authenticated
  USING ("userId" = auth.uid()::text);
