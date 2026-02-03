-- Create cross_encoder_cache table
CREATE TABLE IF NOT EXISTS public.cross_encoder_cache (
  id TEXT PRIMARY KEY DEFAULT ('ce_' || substr(md5(random()::text || clock_timestamp()::text), 1, 21)),
  "sourceRecordId" TEXT NOT NULL REFERENCES public.data_records(id) ON DELETE CASCADE,
  "targetRecordId" TEXT NOT NULL REFERENCES public.data_records(id) ON DELETE CASCADE,
  score DOUBLE PRECISION NOT NULL,
  "llmModel" TEXT,
  reasoning TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cross_encoder_cache_unique_pair UNIQUE ("sourceRecordId", "targetRecordId")
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ce_cache_source ON public.cross_encoder_cache("sourceRecordId");
CREATE INDEX IF NOT EXISTS idx_ce_cache_target ON public.cross_encoder_cache("targetRecordId");

-- Enable RLS
ALTER TABLE public.cross_encoder_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can insert cache entries
DROP POLICY IF EXISTS "Authenticated can insert cross encoder cache" ON public.cross_encoder_cache;
CREATE POLICY "Authenticated can insert cross encoder cache"
  ON public.cross_encoder_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Authenticated users can view cache (needed by UI to read cached scores)
DROP POLICY IF EXISTS "Authenticated can view cross encoder cache" ON public.cross_encoder_cache;
CREATE POLICY "Authenticated can view cross encoder cache"
  ON public.cross_encoder_cache
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated can update cache entries (allow system to refresh)
DROP POLICY IF EXISTS "Authenticated can update cross encoder cache" ON public.cross_encoder_cache;
CREATE POLICY "Authenticated can update cross encoder cache"
  ON public.cross_encoder_cache
  FOR UPDATE
  TO authenticated
  USING (true);
