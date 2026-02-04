#!/bin/bash
# Test script to validate preview branch seeding logic
# Tests the dynamic project reference lookup and seeds a preview database

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Supabase Preview Branch Seeding Test ===${NC}\n"

# Check for required environment variables
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    echo -e "${RED}ERROR: SUPABASE_ACCESS_TOKEN not set${NC}"
    echo "Get your token from: https://supabase.com/dashboard/account/tokens"
    echo "Then run: export SUPABASE_ACCESS_TOKEN='your-token-here'"
    exit 1
fi

if [ -z "$SUPABASE_ORG_ID" ]; then
    echo -e "${RED}ERROR: SUPABASE_ORG_ID not set${NC}"
    echo "Get your org ID from: https://supabase.com/dashboard/org/_/general"
    echo "Then run: export SUPABASE_ORG_ID='your-org-id-here'"
    exit 1
fi

# Target branch name
BRANCH_NAME="${1:-fix/permission_issues}"
echo -e "${YELLOW}Target branch: $BRANCH_NAME${NC}\n"

# Step 1: Fetch all projects (including branches)
echo -e "${BLUE}Step 1: Fetching projects and branches from Supabase...${NC}"

HTTP_RESPONSE=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    "https://api.supabase.com/v1/organizations/$SUPABASE_ORG_ID/projects")

HTTP_CODE=$(echo "$HTTP_RESPONSE" | tail -n1)
PROJECTS=$(echo "$HTTP_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" != "200" ]; then
    echo -e "${RED}ERROR: Failed to fetch projects (HTTP $HTTP_CODE)${NC}"
    echo "Response: $PROJECTS"
    exit 1
fi

# Check if we got valid JSON
if ! echo "$PROJECTS" | jq empty 2>/dev/null; then
    echo -e "${RED}ERROR: Invalid response from Supabase API${NC}"
    echo "Response: $PROJECTS"
    exit 1
fi

# Debug: Show raw response structure
echo -e "\n${YELLOW}Debug: API Response Structure${NC}"
echo "$PROJECTS" | jq 'type'
echo "$PROJECTS" | jq 'keys' 2>/dev/null || echo "Not an object"

# Check if response has an error
ERROR_MSG=$(echo "$PROJECTS" | jq -r '.error // .message // empty' 2>/dev/null)
if [ -n "$ERROR_MSG" ]; then
    echo -e "${RED}ERROR from Supabase API: $ERROR_MSG${NC}"
    exit 1
fi

# Handle different response formats
if echo "$PROJECTS" | jq -e 'has("projects")' >/dev/null 2>&1; then
    # Response is wrapped in a "projects" key
    PROJECTS_ARRAY=$(echo "$PROJECTS" | jq '.projects')
elif echo "$PROJECTS" | jq -e 'type == "array"' >/dev/null 2>&1; then
    # Response is already an array
    PROJECTS_ARRAY="$PROJECTS"
else
    echo -e "${RED}ERROR: Unexpected API response format${NC}"
    echo "Response: $PROJECTS"
    exit 1
fi

# Get the main project ref for branch API call
MAIN_PROJECT_REF=$(echo "$PROJECTS_ARRAY" | jq -r '.[0].ref // .[0].id')

# Also try to fetch branches via the branches API endpoint
echo -e "\n${BLUE}Fetching branches for main project...${NC}"
BRANCHES_RESPONSE=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    "https://api.supabase.com/v1/projects/$MAIN_PROJECT_REF/branches" 2>/dev/null || echo "[]\n200")

BRANCHES_HTTP_CODE=$(echo "$BRANCHES_RESPONSE" | tail -n1)
BRANCHES=$(echo "$BRANCHES_RESPONSE" | sed '$d')

if [ "$BRANCHES_HTTP_CODE" != "200" ]; then
    echo -e "${YELLOW}Warning: Failed to fetch branches (HTTP $BRANCHES_HTTP_CODE), continuing without branches API${NC}"
    BRANCHES="[]"
fi

# Check if we got branches
if echo "$BRANCHES" | jq empty 2>/dev/null; then
    BRANCH_COUNT=$(echo "$BRANCHES" | jq 'length // 0')
    if [ "$BRANCH_COUNT" -gt 0 ]; then
        echo "Found $BRANCH_COUNT branches via branches API"
        # Merge branches into projects array
        PROJECTS_ARRAY=$(echo "$PROJECTS_ARRAY $BRANCHES" | jq -s 'add')
    fi
fi

# Filter and show branch projects specifically
BRANCH_PROJECTS=$(echo "$PROJECTS_ARRAY" | jq '[.[] | select(.is_branch == true)]')
BRANCH_COUNT=$(echo "$BRANCH_PROJECTS" | jq 'length')

echo -e "\n${GREEN}Total projects found: $(echo "$PROJECTS_ARRAY" | jq 'length')${NC}"
echo -e "${GREEN}Preview branches found: $BRANCH_COUNT${NC}\n"

if [ "$BRANCH_COUNT" -gt 0 ]; then
    echo -e "${GREEN}Preview Branches:${NC}"
    echo "$BRANCH_PROJECTS" | jq -r '.[] | "  - Name: \(.name)\n    Ref: \(.ref // .id)\n    Parent: \(.parent_project_ref // "N/A")\n    Git Branch: \(.git_branch // "N/A")\n"'
fi

echo -e "${GREEN}All Projects:${NC}"
echo "$PROJECTS_ARRAY" | jq -r '.[] | "  - Name: \(.name)\n    Ref: \(.ref // .id)\n    Is Branch: \(.is_branch)\n    Git Branch: \(.git_branch // "N/A")\n"'

# Also show raw JSON for debugging
echo -e "${YELLOW}Full project details (first 3):${NC}"
echo "$PROJECTS_ARRAY" | jq '.[0:3]'

# Step 2: Find the preview project for the branch
echo -e "\n${BLUE}Step 2: Looking for preview project matching '$BRANCH_NAME'...${NC}"

# Normalize branch name (remove slashes, convert to lowercase, etc.)
NORMALIZED_BRANCH=$(echo "$BRANCH_NAME" | tr '/' '-' | tr '[:upper:]' '[:lower:]')
echo "Normalized branch name: $NORMALIZED_BRANCH"

# Try multiple search strategies
PROJECT_REF=""

# Strategy 1: Match git_branch field (works for branches API)
echo -e "\n${YELLOW}Strategy 1: Matching git_branch field${NC}"
PROJECT_REF=$(echo "$PROJECTS_ARRAY" | jq -r \
    ".[] | select(.git_branch == \"$BRANCH_NAME\") | (.project_ref // .ref // .id)" | head -1)

if [ -n "$PROJECT_REF" ] && [ "$PROJECT_REF" != "null" ]; then
    echo -e "${GREEN}✓ Found via git_branch match${NC}"
else
    # Strategy 2: Exact name match (with slashes)
    echo -e "${YELLOW}Strategy 2: Exact name match${NC}"
    PROJECT_REF=$(echo "$PROJECTS_ARRAY" | jq -r \
        ".[] | select(.name == \"$BRANCH_NAME\") | (.project_ref // .ref // .id)" | head -1)

    if [ -n "$PROJECT_REF" ] && [ "$PROJECT_REF" != "null" ]; then
        echo -e "${GREEN}✓ Found via exact name match${NC}"
    else
        # Strategy 3: Contains match on name
        echo -e "${YELLOW}Strategy 3: Contains match on name${NC}"
        PROJECT_REF=$(echo "$PROJECTS_ARRAY" | jq -r \
            ".[] | select(.name | contains(\"$BRANCH_NAME\")) | (.project_ref // .ref // .id)" | head -1)

        if [ -n "$PROJECT_REF" ] && [ "$PROJECT_REF" != "null" ]; then
            echo -e "${GREEN}✓ Found via contains match${NC}"
        fi
    fi
fi

if [ -z "$PROJECT_REF" ] || [ "$PROJECT_REF" == "null" ]; then
    echo -e "\n${RED}ERROR: Could not find preview project for branch '$BRANCH_NAME'${NC}"
    echo -e "\n${YELLOW}Available project names:${NC}"
    echo "$PROJECTS_ARRAY" | jq -r '.[].name'
    echo -e "\n${YELLOW}Tip: Preview projects are usually named with sanitized branch names${NC}"
    echo "Branch 'fix/permission_issues' might be 'fix-permission-issues'"
    exit 1
fi

# Validate PROJECT_REF format (Supabase project refs are 20 lowercase alphanumeric chars)
if [[ ! "$PROJECT_REF" =~ ^[a-z0-9]{20}$ ]]; then
    echo -e "\n${RED}ERROR: Invalid project ref format: $PROJECT_REF${NC}"
    echo "Expected 20 lowercase alphanumeric characters"
    exit 1
fi

PROJECT_NAME=$(echo "$PROJECTS_ARRAY" | jq -r ".[] | select((.project_ref // .ref // .id) == \"$PROJECT_REF\") | .name")
echo -e "\n${GREEN}✓ Found preview project!${NC}"
echo "  Name: $PROJECT_NAME"
echo "  Ref:  $PROJECT_REF"

# Step 3: Link to the preview project
echo -e "\n${BLUE}Step 3: Linking to preview project...${NC}"
supabase link --project-ref "$PROJECT_REF" 2>&1 || {
    echo -e "${RED}ERROR: Failed to link to project${NC}"
    echo "Make sure Supabase CLI is installed: https://supabase.com/docs/guides/cli"
    exit 1
}

# Step 4: Run the seed file
echo -e "\n${BLUE}Step 4: Running seed file...${NC}"
echo -e "${YELLOW}This will create test users in the preview database:${NC}"
echo "  - admin@test.com (password: test)"
echo "  - manager@test.com (password: test)"
echo "  - user@test.com (password: test)"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Aborted by user${NC}"
    exit 0
fi

# Execute SQL on the remote database using Supabase Management API
echo "Executing SQL on remote database via API..."

# Read the seed file content
SEED_SQL=$(cat supabase/seed.sql)

# Execute via Supabase Management API
EXEC_HTTP_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    "https://api.supabase.com/v1/projects/$PROJECT_REF/database/query" \
    -d "{\"query\": $(echo "$SEED_SQL" | jq -Rs .)}")

EXEC_HTTP_CODE=$(echo "$EXEC_HTTP_RESPONSE" | tail -n1)
EXEC_RESPONSE=$(echo "$EXEC_HTTP_RESPONSE" | sed '$d')

if [ "$EXEC_HTTP_CODE" != "200" ]; then
    echo -e "${RED}ERROR: HTTP $EXEC_HTTP_CODE${NC}"
    echo "Response: $EXEC_RESPONSE"
    exit 1
fi

# Check if execution was successful
if echo "$EXEC_RESPONSE" | jq -e '.error' >/dev/null 2>&1; then
    ERROR_MSG=$(echo "$EXEC_RESPONSE" | jq -r '.error')
    echo -e "${RED}ERROR: $ERROR_MSG${NC}"
    echo "Response: $EXEC_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✓ SQL executed successfully${NC}"

echo -e "\n${GREEN}=== ✓ Seed script executed! ===${NC}"

# Verify the users were actually created using Supabase Management API
echo -e "\n${BLUE}Step 5: Verifying users were created...${NC}"

# Get database connection details from Supabase API
echo "Fetching database connection details..."
DB_SETTINGS_RESPONSE=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    "https://api.supabase.com/v1/projects/$PROJECT_REF/settings")

DB_SETTINGS_HTTP_CODE=$(echo "$DB_SETTINGS_RESPONSE" | tail -n1)
DB_SETTINGS=$(echo "$DB_SETTINGS_RESPONSE" | sed '$d')

if [ "$DB_SETTINGS_HTTP_CODE" != "200" ]; then
    echo -e "${YELLOW}Warning: Failed to fetch database settings (HTTP $DB_SETTINGS_HTTP_CODE)${NC}"
    DB_HOST=""
    DB_NAME="postgres"
else
    DB_HOST=$(echo "$DB_SETTINGS" | jq -r '.db_host // empty')
    DB_NAME=$(echo "$DB_SETTINGS" | jq -r '.db_name // "postgres"')
fi

if [ -n "$DB_HOST" ]; then
    echo -e "${GREEN}✓ Database host: $DB_HOST${NC}"

    # Try to verify using psql (if available and password is known)
    echo -e "\n${YELLOW}Note: Direct verification requires database password.${NC}"
    echo -e "To verify users manually, check the Supabase dashboard:"
    echo -e "  https://supabase.com/dashboard/project/$PROJECT_REF/auth/users"
else
    echo -e "${YELLOW}Could not fetch database connection details${NC}"
fi

echo -e "\n${GREEN}=== ✓ Seed Script Completed! ===${NC}"
echo -e "\nTarget Database:"
echo -e "  Branch: $BRANCH_NAME"
echo -e "  Project ref: $PROJECT_REF"
echo -e "  Name: $PROJECT_NAME"

echo -e "\nTest Credentials:"
echo -e "  - admin@test.com / test (ADMIN)"
echo -e "  - manager@test.com / test (MANAGER)"
echo -e "  - user@test.com / test (USER)"

echo -e "\n${YELLOW}To verify users were created:${NC}"
echo -e "1. Check Supabase Dashboard: https://supabase.com/dashboard/project/$PROJECT_REF/auth/users"
echo -e "2. Try logging in to your preview deployment with the test credentials"
