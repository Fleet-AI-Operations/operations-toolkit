-- Worker flags: general-purpose worker flagging for workforce monitoring.
-- Flags are raised manually by FLEET+ users to track quality concerns,
-- policy violations, or other workforce issues against a worker (by email).

CREATE TABLE IF NOT EXISTS public.worker_flags (
  id               text        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  worker_email     text        NOT NULL,
  worker_name      text,
  flag_type        text        NOT NULL, -- QUALITY_CONCERN | POLICY_VIOLATION | COMMUNICATION_ISSUE | ATTENDANCE | OTHER
  severity         text        NOT NULL DEFAULT 'MEDIUM', -- LOW | MEDIUM | HIGH | CRITICAL
  status           text        NOT NULL DEFAULT 'OPEN',   -- OPEN | UNDER_REVIEW | RESOLVED | DISMISSED
  reason           text        NOT NULL,
  notes            text,
  created_by_id    uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_email text,
  resolved_by_id   uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at      timestamptz,
  resolution_notes text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_worker_flags_worker_email ON public.worker_flags(worker_email);
CREATE INDEX IF NOT EXISTS idx_worker_flags_status       ON public.worker_flags(status);
CREATE INDEX IF NOT EXISTS idx_worker_flags_severity     ON public.worker_flags(severity);
CREATE INDEX IF NOT EXISTS idx_worker_flags_created_at   ON public.worker_flags(created_at DESC);
