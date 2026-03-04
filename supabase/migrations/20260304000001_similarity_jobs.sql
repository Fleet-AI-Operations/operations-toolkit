CREATE TABLE public.similarity_jobs (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  ingest_job_id TEXT   NOT NULL,
  environment  TEXT    NOT NULL,
  status       TEXT    NOT NULL DEFAULT 'PENDING',
  records_checked INT  NOT NULL DEFAULT 0,
  flags_found  INT     NOT NULL DEFAULT 0,
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.similarity_flags (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  similarity_job_id  UUID NOT NULL REFERENCES public.similarity_jobs(id) ON DELETE CASCADE,
  source_record_id   TEXT NOT NULL,
  matched_record_id  TEXT NOT NULL,
  similarity_score   FLOAT NOT NULL,
  user_email         TEXT,
  user_name          TEXT,
  environment        TEXT NOT NULL,
  notified_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_record_id, matched_record_id)
);

ALTER TABLE public.similarity_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "similarity_jobs_core_fleet_admin_select"
  ON public.similarity_jobs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND role IN ('CORE', 'FLEET', 'ADMIN', 'MANAGER')
  ));

ALTER TABLE public.similarity_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "similarity_flags_core_fleet_admin_select"
  ON public.similarity_flags FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND role IN ('CORE', 'FLEET', 'ADMIN', 'MANAGER')
  ));
