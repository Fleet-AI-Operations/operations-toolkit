#!/bin/bash
# Finds all QUEUED_FOR_VEC ingest jobs and triggers process-job for each one.
# Usage: ./scripts/trigger-vectorization.sh

FLEET_URL="${FLEET_URL:-http://localhost:3004}"
WEBHOOK_SECRET="${WEBHOOK_SECRET:-}"

if [ -z "$WEBHOOK_SECRET" ]; then
  # Try to read from apps/fleet/.env.local
  ENV_FILE="$(dirname "$0")/../apps/fleet/.env.local"
  if [ -f "$ENV_FILE" ]; then
    WEBHOOK_SECRET=$(grep '^WEBHOOK_SECRET=' "$ENV_FILE" | cut -d '=' -f2- | tr -d '"')
  fi
fi

if [ -z "$WEBHOOK_SECRET" ]; then
  echo "Error: WEBHOOK_SECRET not set. Add it to apps/fleet/.env.local or export it."
  exit 1
fi

echo "Querying for QUEUED_FOR_VEC jobs..."

JOBS=$(docker exec supabase_db_percentage-tool psql -U postgres -t -A -F '|' -c \
  "SELECT id, environment FROM public.ingest_jobs WHERE status = 'QUEUED_FOR_VEC' ORDER BY \"createdAt\"")

if [ -z "$JOBS" ]; then
  echo "No QUEUED_FOR_VEC jobs found."
  exit 0
fi

COUNT=$(echo "$JOBS" | wc -l | tr -d ' ')
echo "Found $COUNT job(s). Triggering vectorization..."
echo ""

while IFS='|' read -r JOB_ID ENVIRONMENT; do
  echo "  -> Job $JOB_ID (env: $ENVIRONMENT)"
  RESPONSE=$(curl -s -X POST "$FLEET_URL/api/ingest/process-job" \
    -H "Content-Type: application/json" \
    -H "x-webhook-secret: $WEBHOOK_SECRET" \
    -d "{\"job_id\": \"$JOB_ID\", \"environment\": \"$ENVIRONMENT\", \"status\": \"QUEUED_FOR_VEC\"}")
  echo "     $RESPONSE"
done <<< "$JOBS"

echo ""
echo "Done. Monitor progress at $FLEET_URL/ingest"
