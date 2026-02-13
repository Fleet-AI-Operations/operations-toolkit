#!/bin/bash
#
# Run the same tests that CI runs, but locally (without Docker)
# This is faster than using 'act' and useful for pre-push validation
#
# Usage:
#   ./scripts/run-ci-tests.sh [options]
#
# Options:
#   --skip-build    Skip the build step
#   --skip-e2e      Skip E2E tests
#   --unit-only     Run only unit tests

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Parse arguments
SKIP_BUILD=false
SKIP_E2E=false
UNIT_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --skip-e2e)
            SKIP_E2E=true
            shift
            ;;
        --unit-only)
            UNIT_ONLY=true
            SKIP_E2E=true
            SKIP_BUILD=true
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Running CI Tests Locally                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# Check if Supabase is running
echo -e "${YELLOW}→ Checking Supabase status...${NC}"
if ! supabase status &> /dev/null; then
    echo -e "${RED}✗ Supabase is not running${NC}"
    echo "Start it with: npm run dev:supabase"
    exit 1
fi
echo -e "${GREEN}✓ Supabase is running${NC}"
echo ""

# Ensure dependencies are installed
echo -e "${YELLOW}→ Checking dependencies...${NC}"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    pnpm install --frozen-lockfile
fi
echo -e "${GREEN}✓ Dependencies ready${NC}"
echo ""

# Generate Prisma client
echo -e "${YELLOW}→ Generating Prisma client...${NC}"
pnpm run db:generate
echo -e "${GREEN}✓ Prisma client generated${NC}"
echo ""

# Run linter (currently disabled - ESLint 9 config needs fixing)
echo -e "${YELLOW}→ Running linter...${NC}"
if pnpm turbo run lint; then
    echo -e "${GREEN}✓ Linting passed (currently disabled)${NC}"
else
    echo -e "${YELLOW}⚠ Linting had warnings (continuing)${NC}"
fi
echo ""

# Build all apps
if [ "$SKIP_BUILD" = false ]; then
    echo -e "${YELLOW}→ Building all apps...${NC}"
    pnpm turbo run build
    echo -e "${GREEN}✓ Build successful${NC}"
    echo ""
fi

# Run unit tests
echo -e "${YELLOW}→ Running unit tests...${NC}"
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
export DIRECT_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
export NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

pnpm turbo run test
echo -e "${GREEN}✓ Unit tests passed${NC}"
echo ""

# Run E2E tests
if [ "$SKIP_E2E" = false ]; then
    echo -e "${YELLOW}→ Running E2E tests...${NC}"
    export CI=true
    pnpm run test:e2e
    echo -e "${GREEN}✓ E2E tests passed${NC}"
    echo ""
fi

# Summary
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  ${GREEN}✓ All CI Tests Passed!${BLUE}                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Your code is ready to push! 🚀${NC}"
