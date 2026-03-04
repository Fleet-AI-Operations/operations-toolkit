-- ============================================================================
-- Enable RLS on public tables that were missing it (FLEOTK-13)
-- Tables: meetings, guidelines, ai_quality_jobs, ai_quality_ratings,
--         exemplar_tasks, upload_sessions, upload_chunks
-- ============================================================================

-- ============================================================
-- meetings
-- Reference catalog managed by Fleet/Admin.
-- All authenticated users can read (needed to display meeting options).
-- ============================================================
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meetings_authenticated_select"
    ON public.meetings FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "meetings_fleet_admin_insert"
    ON public.meetings FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = (SELECT auth.uid()) AND role IN ('FLEET', 'ADMIN')
        )
    );

CREATE POLICY "meetings_fleet_admin_update"
    ON public.meetings FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = (SELECT auth.uid()) AND role IN ('FLEET', 'ADMIN')
        )
    );

CREATE POLICY "meetings_fleet_admin_delete"
    ON public.meetings FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = (SELECT auth.uid()) AND role IN ('FLEET', 'ADMIN')
        )
    );

-- ============================================================
-- guidelines
-- Managed by Fleet/Admin; readable by all authenticated users
-- (QA, Core, and Fleet apps all need to read guidelines for analysis).
-- ============================================================
ALTER TABLE public.guidelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guidelines_authenticated_select"
    ON public.guidelines FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "guidelines_fleet_admin_insert"
    ON public.guidelines FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = (SELECT auth.uid()) AND role IN ('FLEET', 'ADMIN')
        )
    );

CREATE POLICY "guidelines_fleet_admin_update"
    ON public.guidelines FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = (SELECT auth.uid()) AND role IN ('FLEET', 'ADMIN')
        )
    );

CREATE POLICY "guidelines_fleet_admin_delete"
    ON public.guidelines FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = (SELECT auth.uid()) AND role IN ('FLEET', 'ADMIN')
        )
    );

-- ============================================================
-- ai_quality_jobs / ai_quality_ratings
-- Internal job tracking tables for the AI quality rating feature.
-- Fleet and Admin only.
-- ============================================================
ALTER TABLE public.ai_quality_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_quality_jobs_fleet_admin_all"
    ON public.ai_quality_jobs FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = (SELECT auth.uid()) AND role IN ('FLEET', 'ADMIN')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = (SELECT auth.uid()) AND role IN ('FLEET', 'ADMIN')
        )
    );

ALTER TABLE public.ai_quality_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_quality_ratings_fleet_admin_all"
    ON public.ai_quality_ratings FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = (SELECT auth.uid()) AND role IN ('FLEET', 'ADMIN')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = (SELECT auth.uid()) AND role IN ('FLEET', 'ADMIN')
        )
    );

-- ============================================================
-- exemplar_tasks
-- Exemplar/reference tasks for similarity comparison.
-- Fleet and Admin only.
-- ============================================================
ALTER TABLE public.exemplar_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exemplar_tasks_fleet_admin_all"
    ON public.exemplar_tasks FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = (SELECT auth.uid()) AND role IN ('FLEET', 'ADMIN')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = (SELECT auth.uid()) AND role IN ('FLEET', 'ADMIN')
        )
    );

-- ============================================================
-- upload_sessions / upload_chunks
-- Temporary storage for chunked CSV uploads.
-- Fleet and Admin only (upload flow is Fleet-gated at the API layer too).
-- ============================================================
ALTER TABLE public.upload_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "upload_sessions_fleet_admin_all"
    ON public.upload_sessions FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = (SELECT auth.uid()) AND role IN ('FLEET', 'ADMIN')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = (SELECT auth.uid()) AND role IN ('FLEET', 'ADMIN')
        )
    );

ALTER TABLE public.upload_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "upload_chunks_fleet_admin_all"
    ON public.upload_chunks FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = (SELECT auth.uid()) AND role IN ('FLEET', 'ADMIN')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = (SELECT auth.uid()) AND role IN ('FLEET', 'ADMIN')
        )
    );
