#!/bin/bash

# Script to verify shared API routes exist in all apps

echo "=== Checking Shared API Routes ==="
echo ""

SHARED_APIS=("auth" "status" "ai" "projects" "bug-reports")

for app in admin user qa core fleet; do
  echo "📱 $app:"
  for api in "${SHARED_APIS[@]}"; do
    if [ -d "apps/$app/src/app/api/$api" ]; then
      echo "  ✅ /api/$api"
    else
      echo "  ❌ /api/$api - MISSING!"
    fi
  done
  echo ""
done

echo "=== Summary ==="
echo "These APIs should be in ALL apps for common functionality:"
echo "  - auth: User authentication"
echo "  - status: Health check"
echo "  - ai: AI/LLM features"
echo "  - projects: Project management (used by ProjectContext)"
echo "  - bug-reports: Bug tracking (used by UserBugReportTracker)"
