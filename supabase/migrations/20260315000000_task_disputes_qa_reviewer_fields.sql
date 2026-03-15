-- Add QA reviewer and original feedback fields to task_disputes (FLEOTK-44)
--
-- New CSV export includes qa_reviewer_user_id, qa_reviewer_name, qa_reviewer_email,
-- original_feedback_positive, and original_feedback_content which were missing
-- from the initial data load.

ALTER TABLE public.task_disputes
    ADD COLUMN IF NOT EXISTS qa_reviewer_user_id        text,
    ADD COLUMN IF NOT EXISTS qa_reviewer_name           text,
    ADD COLUMN IF NOT EXISTS qa_reviewer_email          text,
    ADD COLUMN IF NOT EXISTS original_feedback_positive boolean,
    ADD COLUMN IF NOT EXISTS original_feedback_content  text;
