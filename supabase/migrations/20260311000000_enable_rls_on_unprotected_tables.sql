-- ============================================================================
-- Enable RLS on 4 unprotected public tables (FLEOTK-36)
--
-- Tables: _duplicates_to_delete, worker_flags, mentorship_pods,
--         mentorship_pod_members
--
-- Policies mirror the API-layer auth already enforced in the route handlers.
-- pg_cron jobs run as the postgres superuser and bypass RLS, so enabling RLS
-- on _duplicates_to_delete does not affect the cron population job.
-- ============================================================================

-- ============================================================
-- _duplicates_to_delete
-- Internal staging table populated by pg_cron (bypasses RLS).
-- Only Fleet/Admin users should read or manipulate it via PostgREST.
-- ============================================================
ALTER TABLE public._duplicates_to_delete ENABLE ROW LEVEL SECURITY;

CREATE POLICY "duplicates_to_delete_fleet_admin_all"
    ON public._duplicates_to_delete FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = (SELECT auth.uid()) AND role IN ('FLEET', 'MANAGER', 'ADMIN')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = (SELECT auth.uid()) AND role IN ('FLEET', 'MANAGER', 'ADMIN')
        )
    );

-- ============================================================
-- worker_flags
-- Workforce monitoring flags managed by Fleet/Admin users.
-- ============================================================
ALTER TABLE public.worker_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "worker_flags_fleet_admin_all"
    ON public.worker_flags FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = (SELECT auth.uid()) AND role IN ('FLEET', 'MANAGER', 'ADMIN')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = (SELECT auth.uid()) AND role IN ('FLEET', 'MANAGER', 'ADMIN')
        )
    );

-- ============================================================
-- mentorship_pods
-- Mentorship pod configuration. Fleet/Manager/Admin only.
-- ============================================================
ALTER TABLE public.mentorship_pods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mentorship_pods_fleet_admin_all"
    ON public.mentorship_pods FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = (SELECT auth.uid()) AND role IN ('FLEET', 'MANAGER', 'ADMIN')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = (SELECT auth.uid()) AND role IN ('FLEET', 'MANAGER', 'ADMIN')
        )
    );

-- ============================================================
-- mentorship_pod_members
-- QA worker assignments to mentorship pods. Fleet/Manager/Admin only.
-- ============================================================
ALTER TABLE public.mentorship_pod_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mentorship_pod_members_fleet_admin_all"
    ON public.mentorship_pod_members FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = (SELECT auth.uid()) AND role IN ('FLEET', 'MANAGER', 'ADMIN')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = (SELECT auth.uid()) AND role IN ('FLEET', 'MANAGER', 'ADMIN')
        )
    );
