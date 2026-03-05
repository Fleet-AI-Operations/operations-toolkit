-- Webhook trigger: fires net.http_post (pg_net) when an ingest_job row is inserted.
-- This drives ingestion processing without polling or browser dependency.
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
--   Local dev (Supabase in Docker, Next.js on host):
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
-- If missing: CREATE EXTENSION pg_net WITH SCHEMA net;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA net;

CREATE TABLE IF NOT EXISTS public.ingest_webhook_config (
    key   text PRIMARY KEY,
    value text NOT NULL
);

-- Restrict access: only the service role and postgres can read/write
ALTER TABLE public.ingest_webhook_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.ingest_webhook_config
    USING (auth.role() = 'service_role');

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

    -- Fire async HTTP POST via pg_net — does not block the INSERT transaction
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

CREATE TRIGGER on_ingest_job_created
    AFTER INSERT ON public.ingest_jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_ingest_job_webhook();
