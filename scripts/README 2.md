# Scripts

Helper scripts for development and testing.

## Testing CI Locally

There are two ways to test the GitHub Actions workflow locally:

### Option 1: Quick Local Tests (Recommended)

Run the same tests that CI runs, but directly on your machine (no Docker):

```bash
# Run all tests (lint, build, unit, e2e)
./scripts/run-ci-tests.sh

# Run only unit tests (fast)
./scripts/run-ci-tests.sh --unit-only

# Skip build step (if already built)
./scripts/run-ci-tests.sh --skip-build

# Skip E2E tests (faster)
./scripts/run-ci-tests.sh --skip-e2e
```

**Requirements:**
- Supabase must be running locally (`npm run dev:supabase`)
- Takes 2-5 minutes to run all tests
- Fastest way to validate changes before pushing

**When to use:** Before every commit/push to ensure CI will pass.

---

### Option 2: Exact CI Simulation (Advanced)

Run the actual GitHub Actions workflow in Docker using `act`:

```bash
# List all workflows
./scripts/test-workflow-locally.sh --list

# Show what would run (dry run)
./scripts/test-workflow-locally.sh --dry-run

# Run the full workflow (takes 10-20 min first time)
./scripts/test-workflow-locally.sh

# Run specific job
./scripts/test-workflow-locally.sh --job test
```

**Requirements:**
- Docker Desktop must be running
- ~15GB disk space for Docker images
- First run takes 10-20 minutes (downloads images)
- Subsequent runs are faster (~5-10 minutes)

**When to use:**
- When you need exact CI environment replication
- Debugging workflow issues
- Testing workflow changes before pushing

---

## Comparison

| Feature | Quick Local Tests | Exact CI Simulation |
|---------|------------------|---------------------|
| Speed (first run) | 2-5 min | 10-20 min |
| Speed (subsequent) | 2-5 min | 5-10 min |
| Disk space | Minimal | ~15GB |
| Requirements | Local Supabase | Docker Desktop |
| Environment | Your machine | Ubuntu container |
| Accuracy | ~95% match | 100% match |
| Use case | Pre-push validation | Workflow debugging |

## Recommendations

1. **Daily development:** Use `run-ci-tests.sh --unit-only` frequently
2. **Before pushing:** Use `run-ci-tests.sh` to run all tests
3. **Workflow changes:** Use `test-workflow-locally.sh` to verify
4. **CI debugging:** Use `test-workflow-locally.sh` to reproduce issues

## Troubleshooting

### Quick Local Tests

**Error: "Supabase is not running"**
```bash
npm run dev:supabase
```

**Error: "Missing script: db:generate"**
```bash
cd packages/database
pnpm run db:generate
```

**Tests fail but CI passes**
- Check your `.env.test` matches CI environment variables
- Ensure local Supabase is on the correct branch/migration

### Exact CI Simulation

**Error: "Cannot connect to Docker daemon"**
```bash
# Start Docker Desktop
open -a Docker
```

**Error: "disk space"**
```bash
# Clean up Docker images
docker system prune -a
```

**Workflow stuck**
- Press Ctrl+C to cancel
- Check Docker Desktop has enough resources (Settings → Resources)

## Adding New Scripts

When adding new helper scripts:
1. Make them executable: `chmod +x scripts/your-script.sh`
2. Add usage documentation at the top
3. Use colors for better readability (see examples)
4. Document in this README
