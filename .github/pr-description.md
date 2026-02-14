## Summary

Implements complete Deel API integration for automated timesheet management with a polished settings interface in the Fleet app. Includes contract synchronization, timesheet submission, and comprehensive configuration management.

## Changes

### Deel API Integration
- **Contract Sync Process**: Correlates users to Deel contract IDs via email matching
- **Timesheet Submission**: Batch processing with configurable delays and auto-approval
- **Settings Management**: Runtime configuration with database storage and environment variable fallback
- **API Client**: Pagination support, error handling, and type-safe interfaces

### Database Migrations
- `20260212000004_add_status_to_time_entries.sql` - Status tracking for submission lifecycle
- `20260212000005_add_contract_id_to_time_entries.sql` - Link entries to Deel contracts
- `20260212000006_add_deel_timesheet_id.sql` - Store Deel timesheet IDs after submission

### Core Package Enhancements
- **`packages/core/src/deel/client.ts`**: Deel API client with contract fetching and email mapping
- **`packages/core/src/deel/contract-sync.ts`**: Contract synchronization service
- **`packages/core/src/deel/timesheet-submit.ts`**: Timesheet submission with batch processing
- **`packages/core/package.json`**: Added `./deel` export configuration

### Fleet App Features
- **API Routes** (`/api/deel/*`):
  - `settings` - GET/POST configuration management
  - `sync-contracts` - Manual contract synchronization
  - `submit-timesheets` - Manual timesheet submission
- **UI Pages** (`/deel/*`):
  - `settings` - Modern configuration interface with glassmorphism design
  - `sync-contracts` - Contract sync dashboard with statistics
  - `submit-timesheets` - Timesheet submission dashboard
  - `index` - Overview and workflow guide
- **Navigation**: Added "Deel Configuration" section to sidebar (FLEET/ADMIN roles)

### Settings Page UI/UX Improvements
- **Two-column responsive layout** with status sidebar and configuration form
- **Network Environment Selection**: Card-based radio buttons with improved readability
  - Clear visual hierarchy (label → description → URL)
  - Better contrast and larger text
  - Active state highlighting with blue accent
- **API Credentials Section**:
  - Dedicated "Save API Token" button for immediate credential updates
  - Password visibility toggle
  - Inline documentation links
- **Automation Engine**: Toggle switch for 10-minute recursive sync (placeholder for future automation)
- **Test Connection**: Button with loading state and visual feedback

### Code Quality Improvements
- **Separate loading states**: Independent state management for credential save, full save, and test operations
- **TypeScript improvements**: Replaced `any` types with proper interfaces
- **Fixed dead code**: `handleSave` now correctly detects "no changes" state
- **Event handling fixes**: Added `stopPropagation` to prevent race conditions in custom endpoint input
- **Accurate security claims**: Updated UI text to match actual implementation

### Type Safety & Error Handling
- Proper TypeScript types throughout Deel modules
- Type assertions for API responses (`as DeelContractsResponse`, `as DeelTimesheetResponse`)
- Comprehensive error handling with user-friendly messages
- Validation for API token and base URL formats

## Testing
- ✅ All packages build successfully
- ✅ Fleet app compiles without errors
- ✅ Module resolution working correctly (`@repo/core/deel`)
- ✅ TypeScript strict mode compliance

## Configuration

### Three-Tier Configuration System
Settings are resolved in priority order:
1. **Database** (highest) - Configured via Settings UI
2. **Environment Variables** (fallback) - For development/CI/CD
3. **Default Values** (lowest) - `http://localhost:4000` for testing

### Environment Variables (Optional)
These are **optional** fallback values. Production deployments should use the Settings UI for database-backed configuration.

```bash
# Optional - fallback if not configured in database
DEEL_API_BASE_URL="http://localhost:4000"  # or https://api.letsdeel.com
DEEL_API_TOKEN="your-token-here"
```

**Use cases for environment variables:**
- Initial setup before UI configuration
- Local development with personal tokens
- CI/CD pipelines and automated testing
- Disaster recovery fallback

**Production recommendation:** Configure via Fleet app Settings UI (`/deel/settings`) for centralized, database-backed configuration.

## Security
- API tokens stored in `system_settings` table
- Only last 4 characters displayed in UI for verification
- Server-side validation of all inputs
- FLEET/ADMIN role requirements for all endpoints

## Breaking Changes
None - all new functionality

## Related Issues
Closes #[issue-number] (if applicable)
