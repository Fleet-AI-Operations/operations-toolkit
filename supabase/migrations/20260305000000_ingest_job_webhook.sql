-- Webhook trigger: fires net.http_post (pg_net) when an ingest_job row is inserted.
-- This drives ingestion processing without polling or browser dependency.
--
-- SETUP REQUIRED — run these once per environment after applying this migration:
--
--   Production (Supabase dashboard SQL editor or CLI):
--     ALTER DATABASE postgres SET app.ingest_webhook_url = 'https://your-fleet-app.vercel.app/api/ingest/process-job';
--     ALTER DATABASE postgres SET app.ingest_webhook_secret = 'your-secret';
--
--   Local dev (Supabase in Docker, Next.js on host machine):
--     ALTER DATABASE postgres SET app.ingest_webhook_url = 'http://host.docker.internal:3004/api/ingest/process-job';
--     ALTER DATABASE postgres SET app.ingest_webhook_secret = 'dev-secret';
--
-- If app.ingest_webhook_url is not set, the trigger is a safe no-op.
-- The WEBHOOK_SECRET env var in Vercel must match app.ingest_webhook_secret in the DB.

CREATE OR REPLACE FUNCTION public.trigger_ingest_job_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    _url    text := current_setting('app.ingest_webhook_url', true);
    _secret text := current_setting('app.ingest_webhook_secret', true);
BEGIN
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
