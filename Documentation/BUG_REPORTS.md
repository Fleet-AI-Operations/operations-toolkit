# Bug Reports Feature

The bug report system allows users to report issues they encounter while using the application and provides admins with a centralized interface to manage and track these reports.

## Table of Contents

- [Overview](#overview)
- [User Features](#user-features)
  - [Submitting Bug Reports](#submitting-bug-reports)
  - [Tracking Your Reports](#tracking-your-reports)
- [Admin Features](#admin-features)
  - [Viewing All Reports](#viewing-all-reports)
  - [Managing Reports](#managing-reports)
  - [Status Workflow](#status-workflow)
- [Technical Details](#technical-details)
- [Accessibility](#accessibility)

---

## Overview

The bug report feature consists of three main components:

1. **Bug Report Button** - Floating button for users to submit bug reports from any page
2. **User Bug Report Tracker** - Header icon showing users their submitted reports and their status
3. **Admin Bug Reports Page** - Centralized admin interface for managing all bug reports

All bug reports are **system-wide** and not tied to specific projects. They track issues with the application itself.

---

## User Features

### Submitting Bug Reports

**Location:** Floating bug icon in bottom-right corner of every page

#### How to Submit a Bug Report

1. Click the floating bug button (purple gradient circle with bug icon)
2. A modal will appear showing:
   - Current page URL (automatically captured)
   - Text area for describing the bug
3. Describe what action led to the bug (required)
4. Click "Submit Report"

#### What Happens After Submission

1. **In-Modal Success**:
   - Checkmark animation appears
   - Success message: "Bug report submitted successfully! An admin will review it soon."
   - Modal automatically closes after 2 seconds

2. **Toast Notification**:
   - After modal closes, a toast notification slides in from the right
   - Shows "Bug Report Submitted" with confirmation message
   - Auto-dismisses after 5 seconds (can be manually closed)

#### What Information is Captured

- **Page URL**: The page where the bug occurred
- **Description**: Your description of the issue
- **User Email**: Your account email (automatically captured)
- **User Agent**: Browser and device information (automatically captured)
- **Timestamp**: When the report was submitted

### Tracking Your Reports

**Location:** Bug icon in header (next to user profile)

#### Viewing Your Reports

1. Click the bug icon in the header
2. A dropdown shows all your submitted bug reports
3. Each report displays:
   - **Status Badge**: Current status (Pending, In Progress, or Resolved)
   - **Time**: How long ago you submitted it (e.g., "2h ago", "3d ago")
   - **Page**: The page where the bug occurred
   - **Description**: First 100 characters of your description

#### Status Meanings

- **Pending** (Amber): Report submitted, awaiting admin review
- **In Progress** (Blue): An admin is actively working on the issue
- **Resolved** (Green): The bug has been fixed

#### Badge Counter

- Shows the total number of your bug reports
- **Smart Filtering**: If you have more than 5 reports, the dropdown only shows:
  - Pending reports
  - In Progress reports
  - (Resolved reports are hidden to keep the list focused)

#### Report Sorting

Reports are automatically sorted by priority:
1. **Pending** reports first (newest to oldest)
2. **In Progress** reports second (newest to oldest)
3. **Resolved** reports last (newest to oldest)

---

## Admin Features

### Viewing All Reports

**Location:** `/bug-reports` (accessible from Sidebar → System → Bug Reports)

**Access:** Admin role required

#### Page Layout

The Bug Reports page displays a compact table with:
- **Status**: Color-coded status badge
- **Assigned To**: Admin email or "Unassigned"
- **Created By**: User who submitted the report
- **Time**: When the report was submitted
- **Expand Arrow**: Click to view full details

#### Expandable Rows

Click any row to expand and see:
- **Page URL**: Where the bug occurred
- **Full Description**: Complete bug description
- **User Agent**: Browser/device information (if available)
- **Action Controls**: Status dropdown and "Assign to me" button

#### Keyboard Navigation

The table is fully keyboard accessible:
- **Tab**: Navigate between rows
- **Enter** or **Space**: Expand/collapse a row
- **Visual Focus**: Blue outline indicates focused row

### Managing Reports

#### Updating Status

1. Click a report row to expand it
2. Use the status dropdown to change:
   - Pending
   - In Progress
   - Resolved
3. Status updates immediately and reflects in:
   - Admin table
   - User's bug report tracker
   - Admin notification count (unassigned pending reports)

#### Assigning Reports

1. Expand an unassigned report
2. Click "Assign to me"
3. Your email appears in the "Assigned To" column
4. Status automatically changes to "In Progress" (if it was Pending)

**Note:** Once assigned, the "Assign to me" button disappears. Currently, there's no UI to reassign or unassign reports (must be done via database).

### Status Workflow

Recommended workflow:

```
PENDING → IN_PROGRESS → RESOLVED
```

- **PENDING**: New report, needs review
- **IN_PROGRESS**: Admin is investigating/fixing
- **RESOLVED**: Bug has been fixed

#### Admin Notification Badge

Admins see a red notification in the header showing the count of:
- Unassigned reports
- Pending or In Progress status
- Links directly to `/bug-reports`

---

## Technical Details

### Database Schema

Table: `BugReport`

```prisma
model BugReport {
  id               String   @id @default(cuid())
  userId           String
  userEmail        String
  pageUrl          String   @db.Text
  description      String   @db.Text
  userAgent        String?  @db.Text
  status           String   @default("PENDING")
  assignedTo       String?
  assignedToEmail  String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

### API Endpoints

**POST `/api/bug-reports`**
- Submit a new bug report
- Authentication required
- Rate limited to prevent spam

**GET `/api/bug-reports`**
- Fetch bug reports
- Non-admins: Returns only their own reports
- Admins: Returns all reports

**PATCH `/api/bug-reports`**
- Update bug report status/assignment
- Admin-only endpoint
- Validates status values

**GET `/api/bug-reports/unassigned-count`**
- Get count of unassigned pending/in-progress reports
- Admin-only endpoint
- Used for header notification badge

### Shared Utilities

Location: `src/lib/bug-reports.ts`

```typescript
// Get sort priority (1 = highest)
getStatusPriority(status: string): number

// Get display label
getStatusLabel(status: string): string

// Get status color code
getStatusColor(status: string): string
```

### Component Locations

- **Bug Report Button**: `src/components/BugReportButton.tsx`
- **User Tracker**: `src/components/UserBugReportTracker.tsx`
- **Admin Notification**: `src/components/BugReportNotification.tsx`
- **Admin Page**: `src/app/bug-reports/page.tsx`

---

## Accessibility

### WCAG Compliance

The bug report system follows WCAG 2.1 Level AA guidelines:

#### Keyboard Navigation
- ✅ All interactive elements are keyboard accessible
- ✅ Tab order is logical and predictable
- ✅ Enter/Space keys work for expandable rows
- ✅ No keyboard traps

#### Screen Reader Support
- ✅ `role="button"` on expandable table rows
- ✅ `aria-expanded` indicates expansion state
- ✅ `aria-label` provides context for each row
- ✅ `aria-hidden` hides decorative icons
- ✅ Form labels properly associated with inputs

#### Visual Accessibility
- ✅ Focus indicators with sufficient contrast (blue outline)
- ✅ Color is not the only indicator (status includes text labels)
- ✅ Minimum 4.5:1 contrast ratio for text
- ✅ Status badges use both color and text

#### Testing

Run accessibility tests:
```bash
npm run test:e2e -- bug-reports.spec.ts
```

---

## Best Practices

### For Users

1. **Be Specific**: Describe exactly what you were doing when the bug occurred
2. **Include Steps**: If possible, list the steps to reproduce the bug
3. **One Issue Per Report**: Submit separate reports for different bugs
4. **Check Your Tracker**: Monitor the status of your reports in the header dropdown

### For Admins

1. **Assign Quickly**: Assign reports to yourself when you start investigating
2. **Update Status**: Keep status current so users know progress
3. **Prioritize by Impact**: Use the compact table view to quickly scan pending reports
4. **Mark as Resolved**: Once fixed, update the status so users know it's done
5. **Regular Review**: Check the bug reports page regularly for new submissions

---

## Troubleshooting

### Users Can't Submit Reports

**Possible causes:**
- User is not logged in
- Network connectivity issues
- API endpoint is down

**Solution:**
1. Verify user is logged in
2. Check browser console for errors
3. Check `/status` page for system health

### Admin Can't See Reports Page

**Possible causes:**
- User doesn't have ADMIN role
- Role check hook is redirecting

**Solution:**
1. Verify user role in database: `SELECT role FROM profiles WHERE email = '...'`
2. Check that `useRoleCheck` hook is properly configured
3. Clear browser cache and re-login

### Status Updates Not Saving

**Possible causes:**
- Network error
- Invalid status value
- Database connection issue

**Solution:**
1. Check browser network tab for failed requests
2. Verify API endpoint returns 200 status
3. Check server logs for errors

---

## Future Enhancements

Potential improvements for the bug report system:

- [ ] Email notifications when status changes
- [ ] Ability to add comments to bug reports
- [ ] Screenshot/attachment upload capability
- [ ] Bulk status updates for admins
- [ ] Reassign reports to other admins
- [ ] Search and filter functionality
- [ ] Export reports to CSV
- [ ] Integration with issue tracking systems (GitHub Issues, Jira)
- [ ] Bug report analytics dashboard

---

## Related Documentation

- [User Management](./USER_MANAGEMENT.md) - Role management and permissions
- [API Reference](./Reference/API_REFERENCE.md) - Complete API documentation
- [Security](./SECURITY.md) - Security best practices
- [Testing Guide](./TESTING.md) - How to write and run tests
