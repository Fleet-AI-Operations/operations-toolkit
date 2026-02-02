-- Create audit_logs table if it doesn't exist
create table if not exists "public"."audit_logs" (
  "id" text not null,
  "action" text not null,
  "entity_type" text not null,
  "entity_id" text,
  "project_id" text,
  "user_id" uuid not null,
  "user_email" text not null,
  "metadata" jsonb,
  "created_at" timestamp with time zone not null default now()
);

-- Enable RLS (idempotent)
alter table "public"."audit_logs" enable row level security;

-- Create indexes if they don't exist
CREATE UNIQUE INDEX IF NOT EXISTS audit_logs_pkey ON public.audit_logs USING btree (id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs USING btree (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs USING btree (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_project ON public.audit_logs USING btree (project_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_time ON public.audit_logs USING btree (user_id, created_at DESC);

-- Add primary key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_pkey'
  ) THEN
    ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY USING INDEX "audit_logs_pkey";
  END IF;
END $$;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_user_id_fkey'
  ) THEN
    ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey"
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."audit_logs" VALIDATE CONSTRAINT "audit_logs_user_id_fkey";
  END IF;
END $$;

-- Grant permissions (these are idempotent)
-- Audit logs are append-only: only INSERT and SELECT allowed for authenticated users
-- No permissions for anon users (they shouldn't access audit logs)

-- Authenticated users: can only INSERT (via app logic) and SELECT (via RLS policy restricting to admins)
grant insert on table "public"."audit_logs" to "authenticated";
grant select on table "public"."audit_logs" to "authenticated";

-- Service role: full access for system operations and admin tasks
grant delete on table "public"."audit_logs" to "service_role";
grant insert on table "public"."audit_logs" to "service_role";
grant references on table "public"."audit_logs" to "service_role";
grant select on table "public"."audit_logs" to "service_role";
grant trigger on table "public"."audit_logs" to "service_role";
grant truncate on table "public"."audit_logs" to "service_role";
grant update on table "public"."audit_logs" to "service_role";

-- Create policies if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_logs'
    AND policyname = 'Admins can read all audit logs'
  ) THEN
    CREATE POLICY "Admins can read all audit logs"
    ON "public"."audit_logs"
    AS PERMISSIVE
    FOR SELECT
    TO authenticated
    USING ((EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'ADMIN'::public."UserRole"))
    )));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_logs'
    AND policyname = 'Authenticated users can insert audit logs'
  ) THEN
    CREATE POLICY "Authenticated users can insert audit logs"
    ON "public"."audit_logs"
    AS PERMISSIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
  END IF;
END $$;
