-- Task disputes: stores imported dispute records from the feedback disputes report.
-- Each row represents one dispute from the external system, matched against data_records.

CREATE TABLE IF NOT EXISTS public.task_disputes (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id           integer     NOT NULL UNIQUE,           -- source system id
  created_at_source     timestamptz NOT NULL,                  -- dispute created_at from source
  updated_at_source     timestamptz NOT NULL,                  -- dispute updated_at from source
  feedback_id           integer     NOT NULL,
  eval_task_id          text        REFERENCES public.data_records(id) ON DELETE SET NULL,
  dispute_status        text        NOT NULL,                  -- pending | approved | rejected | discarded
  dispute_reason        text,
  resolution_reason     text,
  resolved_at           timestamptz,
  report_text           text,
  is_helpful            boolean,
  disputer_user_id      text,
  disputer_name         text,
  disputer_email        text,
  resolver_user_id      text,
  resolver_name         text,
  team_id               text,
  team_name             text,
  task_key              text        NOT NULL,
  task_lifecycle_status text,
  env_key               text,
  env_data_key          text,
  task_modality         text,
  dispute_data          jsonb,
  leased_by             text,
  lease_expires_at      timestamptz,
  -- import metadata
  imported_at           timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_disputes_dispute_status    ON public.task_disputes(dispute_status);
CREATE INDEX IF NOT EXISTS idx_task_disputes_disputer_email    ON public.task_disputes(disputer_email);
CREATE INDEX IF NOT EXISTS idx_task_disputes_env_key           ON public.task_disputes(env_key);
CREATE INDEX IF NOT EXISTS idx_task_disputes_task_key          ON public.task_disputes(task_key);
CREATE INDEX IF NOT EXISTS idx_task_disputes_eval_task_id      ON public.task_disputes(eval_task_id);
CREATE INDEX IF NOT EXISTS idx_task_disputes_created_at_source ON public.task_disputes(created_at_source DESC);
