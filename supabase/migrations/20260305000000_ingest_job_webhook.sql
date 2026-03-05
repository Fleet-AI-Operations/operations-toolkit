-- Webhook triggers: fire net.http_post (pg_net) to drive ingestion processing.
-- Two triggers are used so Phase 1 and Phase 2 each get their own Vercel function
-- invocation (and their own 300s timeout window):
--   - on_ingest_job_created:        fires on INSERT (status = PENDING)   → starts Phase 1
--   - on_ingest_job_queued_for_vec: fires on UPDATE to QUEUED_FOR_VEC    → starts Phase 2
--
-- Config is stored in public.ingest_webhook_config so no superuser permissions
-- are needed (ALTER DATABASE SET is not available on Supabase Cloud).
--
-- SETUP REQUIRED — run this once per environment after applying this migration:
--
--   Production:
--     INSERT INTO public.ingest_webhook_config (key, value) VALUES
--         ('url',    'https://your-fleet-app.vercel.app/api/ingest/process-job'),
--         ('secret', 'your-secret')
--     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
--
--   Local dev (Supabase in Docker, Next.js on host — Fleet app runs on port 3004):
--     INSERT INTO public.ingest_webhook_config (key, value) VALUES
--         ('url',    'http://host.docker.internal:3004/api/ingest/process-job'),
--         ('secret', 'dev-secret')
--     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
--
-- To update values later, re-run the same INSERT ... ON CONFLICT statement.
-- If 'url' is not set or empty, the trigger is a safe no-op.
-- The WEBHOOK_SECRET env var in Vercel must match the 'secret' value here.

-- pg_net is pre-installed on Supabase Cloud. For local dev, verify it is enabled:
--   SELECT * FROM pg_extension WHERE extname = 'pg_net';
-- pg_net creates its own 'net' schema on install — do not specify WITH SCHEMA here
-- or the statement will fail on fresh environments where the schema doesn't exist yet.
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS public.ingest_webhook_config (
    key   text PRIMARY KEY,
    value text NOT NULL
);

-- Restrict access: only the service_role JWT can read/write via RLS.
-- The postgres superuser bypasses RLS by default (used when running setup SQL directly).
ALTER TABLE public.ingest_webhook_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.ingest_webhook_config
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.trigger_ingest_job_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    _url    text;
    _secret text;
BEGIN
    SELECT value INTO _url    FROM public.ingest_webhook_config WHERE key = 'url';
    SELECT value INTO _secret FROM public.ingest_webhook_config WHERE key = 'secret';

    -- Skip if webhook URL is not configured
    IF _url IS NULL OR _url = '' THEN
        RETURN NEW;
    END IF;

    -- Fire async HTTP POST via pg_net — does not block the transaction
    PERFORM net.http_post(
        url     := _url,
        headers := jsonb_build_object(
            'Content-Type',     'application/json',
            'x-webhook-secret', coalesce(_secret, '')
        ),
        body    := jsonb_build_object(
            'job_id',      NEW.id,
            'environment', NEW.environment,
            'status',      NEW.status
        )
    );

    RETURN NEW;
END;
$$;

-- Fires on INSERT (status = PENDING) to start Phase 1.
CREATE TRIGGER on_ingest_job_created
    AFTER INSERT ON public.ingest_jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_ingest_job_webhook();

-- Fires when status transitions to QUEUED_FOR_VEC to start Phase 2.
-- This separates phases into independent webhook calls so each gets its own
-- 300s Vercel function window instead of sharing one.
CREATE TRIGGER on_ingest_job_queued_for_vec
    AFTER UPDATE ON public.ingest_jobs
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'QUEUED_FOR_VEC')
    EXECUTE FUNCTION public.trigger_ingest_job_webhook();
