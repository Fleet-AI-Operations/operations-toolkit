-- 1. Create UserRole type if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
        CREATE TYPE "UserRole" AS ENUM ('USER', 'MANAGER', 'ADMIN');
    END IF;
END $$;

-- Ensure all role values exist (must be run outside DO block)
-- ORDER matters: PENDING before USER, new hierarchy roles added after base values.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'PENDING' BEFORE 'USER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'QA';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CORE';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'FLEET';

-- 2. Create or Update the profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role "UserRole" DEFAULT 'PENDING'::"UserRole",
  "firstName" TEXT,
  "lastName" TEXT,
  "mustResetPassword" BOOLEAN DEFAULT FALSE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure existing tables have all columns (idempotent)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS "mustResetPassword" BOOLEAN DEFAULT FALSE;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS "firstName" TEXT;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS "lastName" TEXT;

-- Ensure updatedAt has default for existing tables
ALTER TABLE public.profiles
ALTER COLUMN "updatedAt" SET DEFAULT NOW();

-- Force a reload of the PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- 3. Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Create helper functions (SECURITY DEFINER bypasses RLS to prevent circular dependencies)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'ADMIN'::"UserRole"
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = ANY (ARRAY['MANAGER'::"UserRole", 'ADMIN'::"UserRole"])
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create Policies for profiles table
-- Drop old policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "All users can view profiles" ON public.profiles;

-- Combined SELECT policy: Users can view their own profile OR are a manager/admin
-- Uses SECURITY DEFINER function to avoid circular RLS dependency
CREATE POLICY "Users can view profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    -- User viewing their own profile
    (id = (select auth.uid()))
    OR
    -- User is a manager or admin (SECURITY DEFINER function bypasses RLS)
    public.is_manager_or_admin()
  );

-- Separate policies for INSERT, UPDATE, DELETE (admin only)
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Admins can insert profiles"
  ON public.profiles
  FOR INSERT
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "Admins can update profiles"
  ON public.profiles
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles"
  ON public.profiles
  FOR DELETE
  USING (public.is_admin());

-- 6. Create a function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, "createdAt", "updatedAt")
  VALUES (new.id, new.email, 'PENDING', NOW(), NOW());
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Trigger the function every time a user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Create audit_logs table for tracking user actions
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  project_id TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Create indexes for audit_logs query performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_time ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_project ON public.audit_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- 9. Enable RLS for audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 10. Create audit_logs policies
-- Admin can read all audit logs (uses SECURITY DEFINER function to avoid RLS circular dependency)
DROP POLICY IF EXISTS "Admins can read all audit logs" ON public.audit_logs;

CREATE POLICY "Admins can read all audit logs"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- All authenticated users can insert (for system logging)
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;

CREATE POLICY "Authenticated users can insert audit logs"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Upload sessions for chunked CSV ingestion
-- Replaces filesystem-based session storage (/tmp) which is not shared
-- across Vercel serverless invocations.

CREATE TABLE IF NOT EXISTS public.upload_sessions (
    id TEXT PRIMARY KEY,
    file_name TEXT NOT NULL,
    total_chunks INTEGER NOT NULL,
    generate_embeddings BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.upload_chunks (
    session_id TEXT NOT NULL REFERENCES public.upload_sessions(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    PRIMARY KEY (session_id, chunk_index)
);

-- Used by opportunistic cleanup to quickly find expired sessions
CREATE INDEX IF NOT EXISTS idx_upload_sessions_expires_at ON public.upload_sessions (expires_at);

-- Functional index on metadata->>'task_key' to speed up task key lookups
-- and ingestion duplicate detection queries.
CREATE INDEX IF NOT EXISTS idx_data_records_task_key
ON public.data_records ((metadata->>'task_key'));

-- ============================================================
-- Duplicate detection staging table (FLEOTK-36)
-- Populated by pg_cron (bypasses RLS). Fleet/Admin access only.
-- ============================================================
CREATE TABLE IF NOT EXISTS public._duplicates_to_delete (
    id TEXT NOT NULL PRIMARY KEY
);

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
-- Worker flags (FLEOTK-36)
-- Workforce monitoring. Fleet/Admin access only.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.worker_flags (
    id               text        PRIMARY KEY DEFAULT gen_random_uuid()::text,
    worker_email     text        NOT NULL,
    worker_name      text,
    flag_type        text        NOT NULL,
    severity         text        NOT NULL DEFAULT 'MEDIUM',
    status           text        NOT NULL DEFAULT 'OPEN',
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
-- Mentorship pods and members (FLEOTK-36)
-- Pod config managed by Fleet/Manager/Admin.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mentorship_pods (
    id             text        NOT NULL DEFAULT gen_random_uuid()::text,
    name           text        NOT NULL,
    core_leader_id uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT mentorship_pods_pkey PRIMARY KEY (id)
);

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

CREATE TABLE IF NOT EXISTS public.mentorship_pod_members (
    id        text        NOT NULL DEFAULT gen_random_uuid()::text,
    pod_id    text        NOT NULL REFERENCES public.mentorship_pods(id) ON DELETE CASCADE,
    qa_email  text        NOT NULL,
    qa_name   text,
    joined_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT mentorship_pod_members_pkey PRIMARY KEY (id),
    CONSTRAINT mentorship_pod_members_pod_email_unique UNIQUE (pod_id, qa_email)
);

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
