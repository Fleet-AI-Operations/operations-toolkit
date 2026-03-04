-- ============================================================================
-- Fix RLS performance warnings and related issues (FLEOTK-16)
--
-- 1. auth_rls_initplan: Wrap auth.uid() calls in (SELECT auth.uid()) to
--    prevent per-row re-evaluation in RLS policies.
--
-- 2. multiple_permissive_policies:
--    - notification_settings: merge user + admin policies into one per operation
--    - time_entries: drop the redundant "view own" SELECT policy (subsumed by
--      the email-based policy added in 20260212000001)
--
-- 3. duplicate_index: drop idx_time_report_records_worker_email, which is
--    identical to idx_time_reports_worker_email added in the original table
--    creation migration.
-- ============================================================================


-- ============================================================================
-- time_entries
-- ============================================================================

-- Drop both SELECT policies; recreate only the email-based one (which is a
-- superset of the uid-based one). This resolves the multiple_permissive_policies
-- warning for SELECT and the auth_rls_initplan warning in one step.
DROP POLICY IF EXISTS "Users can view own time entries" ON public.time_entries;
DROP POLICY IF EXISTS "Users can view entries by email" ON public.time_entries;

CREATE POLICY "Users can view entries by email"
    ON public.time_entries FOR SELECT
    TO authenticated
    USING (
        (SELECT auth.uid()) = user_id
        OR (
            (SELECT auth.uid()) IS NOT NULL
            AND email = (SELECT email FROM public.profiles WHERE id = (SELECT auth.uid()))
        )
    );

DROP POLICY IF EXISTS "Users can insert own time entries" ON public.time_entries;
CREATE POLICY "Users can insert own time entries"
    ON public.time_entries FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT auth.uid()) = user_id
        OR user_id IS NULL
    );

DROP POLICY IF EXISTS "Users can update own time entries" ON public.time_entries;
CREATE POLICY "Users can update own time entries"
    ON public.time_entries FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own time entries" ON public.time_entries;
CREATE POLICY "Users can delete own time entries"
    ON public.time_entries FOR DELETE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);


-- ============================================================================
-- notification_settings
-- Merges the per-user policies and the admin FOR ALL policy into one policy
-- per operation to eliminate multiple_permissive_policies warnings.
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own notification settings" ON public.notification_settings;
DROP POLICY IF EXISTS "Users can insert their own notification settings" ON public.notification_settings;
DROP POLICY IF EXISTS "Users can update their own notification settings" ON public.notification_settings;
DROP POLICY IF EXISTS "Users can delete their own notification settings" ON public.notification_settings;
DROP POLICY IF EXISTS "Admins can manage all notification settings" ON public.notification_settings;

CREATE POLICY "notification_settings_select"
    ON public.notification_settings FOR SELECT
    TO authenticated
    USING (
        (SELECT auth.uid()) = user_id
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = (SELECT auth.uid()) AND role = 'ADMIN'
        )
    );

CREATE POLICY "notification_settings_insert"
    ON public.notification_settings FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT auth.uid()) = user_id
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = (SELECT auth.uid()) AND role = 'ADMIN'
        )
    );

CREATE POLICY "notification_settings_update"
    ON public.notification_settings FOR UPDATE
    TO authenticated
    USING (
        (SELECT auth.uid()) = user_id
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = (SELECT auth.uid()) AND role = 'ADMIN'
        )
    )
    WITH CHECK (
        (SELECT auth.uid()) = user_id
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = (SELECT auth.uid()) AND role = 'ADMIN'
        )
    );

CREATE POLICY "notification_settings_delete"
    ON public.notification_settings FOR DELETE
    TO authenticated
    USING (
        (SELECT auth.uid()) = user_id
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = (SELECT auth.uid()) AND role = 'ADMIN'
        )
    );


-- ============================================================================
-- bug_reports
-- ============================================================================

DROP POLICY IF EXISTS "Users can create their own bug reports" ON public.bug_reports;
CREATE POLICY "Users can create their own bug reports"
    ON public.bug_reports FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT auth.uid()) = user_id::uuid OR user_id IS NULL
    );


-- ============================================================================
-- likert_scores
-- ============================================================================

DROP POLICY IF EXISTS "Users can create likert scores for their records" ON public.likert_scores;
CREATE POLICY "Users can create likert scores for their records"
    ON public.likert_scores FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('QA', 'CORE', 'FLEET', 'MANAGER', 'ADMIN')
        )
    );


-- ============================================================================
-- audit_logs
-- ============================================================================

DROP POLICY IF EXISTS "Users can insert their own audit logs" ON public.audit_logs;
CREATE POLICY "Users can insert their own audit logs"
    ON public.audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT auth.uid()) = user_id::uuid
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('ADMIN', 'MANAGER')
        )
    );


-- ============================================================================
-- cross_encoder_cache
-- ============================================================================

DROP POLICY IF EXISTS "System can insert cross encoder cache" ON public.cross_encoder_cache;
CREATE POLICY "System can insert cross encoder cache"
    ON public.cross_encoder_cache FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('ADMIN', 'FLEET')
        )
    );

DROP POLICY IF EXISTS "System can update cross encoder cache" ON public.cross_encoder_cache;
CREATE POLICY "System can update cross encoder cache"
    ON public.cross_encoder_cache FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('ADMIN', 'FLEET')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('ADMIN', 'FLEET')
        )
    );


-- ============================================================================
-- qa_feedback_ratings
-- ============================================================================

DROP POLICY IF EXISTS "Fleet and Admin can view feedback ratings" ON public.qa_feedback_ratings;
CREATE POLICY "Fleet and Admin can view feedback ratings"
    ON public.qa_feedback_ratings FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('FLEET', 'ADMIN', 'MANAGER')
        )
    );

DROP POLICY IF EXISTS "Admin can insert feedback ratings" ON public.qa_feedback_ratings;
CREATE POLICY "Admin can insert feedback ratings"
    ON public.qa_feedback_ratings FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = 'ADMIN'
        )
    );

DROP POLICY IF EXISTS "Admin can update feedback ratings" ON public.qa_feedback_ratings;
CREATE POLICY "Admin can update feedback ratings"
    ON public.qa_feedback_ratings FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = 'ADMIN'
        )
    );


-- ============================================================================
-- time_report_records
-- ============================================================================

DROP POLICY IF EXISTS "time_reports_fleet_admin_select" ON public.time_report_records;
CREATE POLICY "time_reports_fleet_admin_select"
    ON public.time_report_records FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('FLEET', 'ADMIN')
        )
    );

DROP POLICY IF EXISTS "time_reports_fleet_admin_insert" ON public.time_report_records;
CREATE POLICY "time_reports_fleet_admin_insert"
    ON public.time_report_records FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('FLEET', 'ADMIN')
        )
    );

DROP POLICY IF EXISTS "time_reports_fleet_admin_update" ON public.time_report_records;
CREATE POLICY "time_reports_fleet_admin_update"
    ON public.time_report_records FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('FLEET', 'ADMIN')
        )
    );

DROP POLICY IF EXISTS "time_reports_fleet_admin_delete" ON public.time_report_records;
CREATE POLICY "time_reports_fleet_admin_delete"
    ON public.time_report_records FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('FLEET', 'ADMIN')
        )
    );


-- ============================================================================
-- billable_meetings
-- ============================================================================

DROP POLICY IF EXISTS "meetings_fleet_admin_all" ON public.billable_meetings;
CREATE POLICY "meetings_fleet_admin_all"
    ON public.billable_meetings FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('FLEET', 'ADMIN')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('FLEET', 'ADMIN')
        )
    );


-- ============================================================================
-- time_estimates
-- ============================================================================

DROP POLICY IF EXISTS "estimates_fleet_admin_all" ON public.time_estimates;
CREATE POLICY "estimates_fleet_admin_all"
    ON public.time_estimates FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('FLEET', 'ADMIN')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('FLEET', 'ADMIN')
        )
    );


-- ============================================================================
-- meeting_claims
-- ============================================================================

DROP POLICY IF EXISTS "claims_fleet_admin_all" ON public.meeting_claims;
CREATE POLICY "claims_fleet_admin_all"
    ON public.meeting_claims FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('FLEET', 'ADMIN')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('FLEET', 'ADMIN')
        )
    );


-- ============================================================================
-- quality_scores
-- ============================================================================

DROP POLICY IF EXISTS "quality_fleet_admin_all" ON public.quality_scores;
CREATE POLICY "quality_fleet_admin_all"
    ON public.quality_scores FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('FLEET', 'ADMIN')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('FLEET', 'ADMIN')
        )
    );


-- ============================================================================
-- time_analysis_flags
-- ============================================================================

DROP POLICY IF EXISTS "flags_fleet_admin_all" ON public.time_analysis_flags;
CREATE POLICY "flags_fleet_admin_all"
    ON public.time_analysis_flags FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('FLEET', 'ADMIN')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('FLEET', 'ADMIN')
        )
    );


-- ============================================================================
-- time_analysis_configs
-- ============================================================================

DROP POLICY IF EXISTS "configs_fleet_admin_all" ON public.time_analysis_configs;
CREATE POLICY "configs_fleet_admin_all"
    ON public.time_analysis_configs FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('FLEET', 'ADMIN')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('FLEET', 'ADMIN')
        )
    );


-- ============================================================================
-- prompt_authenticity_records
-- ============================================================================

DROP POLICY IF EXISTS "Fleet and Admin can view prompt records" ON public.prompt_authenticity_records;
CREATE POLICY "Fleet and Admin can view prompt records"
    ON public.prompt_authenticity_records FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('FLEET', 'ADMIN')
        )
    );

DROP POLICY IF EXISTS "Fleet and Admin can insert prompt records" ON public.prompt_authenticity_records;
CREATE POLICY "Fleet and Admin can insert prompt records"
    ON public.prompt_authenticity_records FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('FLEET', 'ADMIN')
        )
    );

DROP POLICY IF EXISTS "Fleet and Admin can update prompt records" ON public.prompt_authenticity_records;
CREATE POLICY "Fleet and Admin can update prompt records"
    ON public.prompt_authenticity_records FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('FLEET', 'ADMIN')
        )
    );


-- ============================================================================
-- prompt_authenticity_jobs
-- ============================================================================

DROP POLICY IF EXISTS "Fleet and Admin can view jobs" ON public.prompt_authenticity_jobs;
CREATE POLICY "Fleet and Admin can view jobs"
    ON public.prompt_authenticity_jobs FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('FLEET', 'ADMIN')
        )
    );

DROP POLICY IF EXISTS "Fleet and Admin can insert jobs" ON public.prompt_authenticity_jobs;
CREATE POLICY "Fleet and Admin can insert jobs"
    ON public.prompt_authenticity_jobs FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('FLEET', 'ADMIN')
        )
    );

DROP POLICY IF EXISTS "Fleet and Admin can update jobs" ON public.prompt_authenticity_jobs;
CREATE POLICY "Fleet and Admin can update jobs"
    ON public.prompt_authenticity_jobs FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('FLEET', 'ADMIN')
        )
    );


-- ============================================================================
-- Drop duplicate index on time_report_records (FLEOTK-16)
--
-- idx_time_report_records_worker_email was added in 20260227000001 but is
-- identical to idx_time_reports_worker_email from the original table creation
-- in 20260224000001. Drop the duplicate.
-- ============================================================================
DROP INDEX IF EXISTS public.idx_time_report_records_worker_email;
