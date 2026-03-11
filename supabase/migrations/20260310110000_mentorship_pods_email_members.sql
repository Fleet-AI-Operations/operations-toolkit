-- Drop user_id FK and replace with qa_email on mentorship_pod_members.
-- QA workers are identified by email (from data_records / QAFeedbackRating),
-- not by platform profiles.

ALTER TABLE public.mentorship_pod_members
    DROP CONSTRAINT IF EXISTS mentorship_pod_members_pod_user_unique,
    DROP COLUMN user_id;

ALTER TABLE public.mentorship_pod_members
    ADD COLUMN qa_email TEXT NOT NULL DEFAULT '',
    ADD COLUMN qa_name  TEXT;

-- Remove the empty-string default now that existing rows are handled
ALTER TABLE public.mentorship_pod_members
    ALTER COLUMN qa_email DROP DEFAULT;

ALTER TABLE public.mentorship_pod_members
    ADD CONSTRAINT mentorship_pod_members_pod_email_unique UNIQUE (pod_id, qa_email);

DROP INDEX IF EXISTS idx_mentorship_pod_members_user;
CREATE INDEX idx_mentorship_pod_members_qa_email ON public.mentorship_pod_members(qa_email);
