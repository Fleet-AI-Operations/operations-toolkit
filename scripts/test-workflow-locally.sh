#!/bin/bash
#
# Test GitHub Actions workflow locally using act
# This simulates what GitHub Actions would do when you push/create a PR
#
# Usage:
#   ./scripts/test-workflow-locally.sh [options]
#
# Options:
#   --dry-run    Show what would run without actually running it
#   --job JOB    Run a specific job (e.g., test, test-summary)
#   --list       List all available workflows and jobs

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Testing GitHub Actions Workflow Locally${NC}"
echo ""

# Check if act is installed
if ! command -v act &> /dev/null; then
    echo -e "${RED}Error: 'act' is not installed${NC}"
    echo "Install with: brew install act"
    exit 1
fi

# Parse arguments
DRY_RUN=false
SPECIFIC_JOB=""
LIST=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --job)
            SPECIFIC_JOB="$2"
            shift 2
            ;;
        --list)
            LIST=true
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# List workflows if requested
if [ "$LIST" = true ]; then
    echo -e "${YELLOW}Available workflows:${NC}"
    act --list
    exit 0
fi

# Dry run
if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}Dry run - showing what would execute:${NC}"
    act --workflows .github/workflows/test.yml --dryrun --container-architecture linux/amd64
    exit 0
fi

# Show warning about local execution
echo -e "${YELLOW}⚠️  Important Notes:${NC}"
echo "1. This runs in Docker containers (may take 10-20 minutes first time)"
echo "2. Requires ~15GB disk space for Docker images"
echo "3. Supabase will run inside the container (different from local instance)"
echo "4. Results may differ slightly from actual GitHub Actions"
echo ""
echo -e "${YELLOW}Press Ctrl+C to cancel, or Enter to continue...${NC}"
read

# Run the workflow
echo -e "${GREEN}Running test workflow...${NC}"

if [ -n "$SPECIFIC_JOB" ]; then
    echo -e "${YELLOW}Running specific job: $SPECIFIC_JOB${NC}"
    act push \
        --workflows .github/workflows/test.yml \
        --job "$SPECIFIC_JOB" \
        --container-architecture linux/amd64 \
        --artifact-server-path /tmp/act-artifacts
else
    echo -e "${YELLOW}Running all jobs in test.yml${NC}"
    act push \
        --workflows .github/workflows/test.yml \
        --container-architecture linux/amd64 \
        --artifact-server-path /tmp/act-artifacts
fi

echo ""
echo -e "${GREEN}✓ Workflow execution completed${NC}"
echo -e "${YELLOW}Artifacts saved to: /tmp/act-artifacts${NC}"
