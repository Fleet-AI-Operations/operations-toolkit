# Manual Testing Checklist - UI/UX Changes

## Prerequisites
- [ ] Supabase is running: `npm run dev:supabase`
- [ ] All apps are running: `pnpm turbo run dev` (or start individually)
- [ ] You have test accounts for each role: USER, QA, CORE, FLEET, ADMIN

## App URLs
- **User App**: http://localhost:3001
- **QA App**: http://localhost:3002
- **Core App**: http://localhost:3003
- **Fleet App**: http://localhost:3004
- **Admin App**: http://localhost:3005

---

## 🚀 Fleet App (Port 3004)

**Role Required**: FLEET or ADMIN

### Landing Page
- [ ] Navigate to http://localhost:3004
- [ ] After login, verify you land on **Analytics** page (not Dashboard)
- [ ] URL should be `/analytics`
- [ ] Page should show analytics charts and data

### Sidebar Navigation
- [ ] Open sidebar (if collapsed)
- [ ] ✅ Verify **NO "Dashboard"** link exists
- [ ] ✅ Verify **"Analytics"** link is present
- [ ] ✅ Verify sidebar items are present and clickable

### Project Management
- [ ] Navigate to **Project Management**
- [ ] ✅ Verify projects are listed **alphabetically by name**
- [ ] Try creating a test project to confirm sorting works with new projects

### Notes
```
Expected landing: /analytics
Dashboard removed: ✓
Alphabetical sorting: ✓
```

---

## 🎯 Core App (Port 3003)

**Role Required**: CORE, FLEET, or ADMIN

### Landing Page
- [ ] Navigate to http://localhost:3003
- [ ] After login, verify you land on **Likert Scoring** page (not Dashboard)
- [ ] URL should be `/likert-scoring`

### Sidebar Navigation
- [ ] Open sidebar
- [ ] ✅ Verify **NO "Dashboard"** link exists
- [ ] ✅ Verify sidebar items are in **alphabetical order**:
  1. Alignment Scoring
  2. Candidate Review
  3. Likert Scoring
  4. My Assignments

### Alignment Scoring (NEW!)
- [ ] ✅ Click **"Alignment Scoring"** in sidebar
- [ ] ✅ Page loads successfully
- [ ] ✅ Can see records list
- [ ] ✅ Can click "Generate Alignment Score" button
- [ ] ✅ Alignment scoring functionality works

### Access Control Test
- [ ] **With QA role**: Try accessing http://localhost:3003/alignment-scoring
- [ ] ✅ Should be redirected or see access denied (QA can't access)

### Notes
```
Expected landing: /likert-scoring
Dashboard removed: ✓
Alignment Scoring added: ✓
Alphabetical order: ✓
```

---

## 🔍 QA App (Port 3002)

**Role Required**: QA, CORE, FLEET, or ADMIN

### Landing Page
- [ ] Navigate to http://localhost:3002
- [ ] After login, verify you land on **Records** page (not Dashboard)
- [ ] URL should be `/records`

### Sidebar Navigation
- [ ] Open sidebar
- [ ] ✅ Verify **NO "Dashboard"** link exists
- [ ] ✅ Verify **NO "Alignment Scoring"** link (moved to Core app)
- [ ] ✅ Verify **NO "Compare"** link in sidebar (requires record ID)
- [ ] ✅ Verify **"Records"** link is present
- [ ] ✅ Verify **"Similarity Search"** and other QA tools are present

### Records Page
- [ ] Navigate to **Records** page
- [ ] ✅ Verify **NO "Generate Alignment Score"** buttons/links
- [ ] ✅ Verify **NO "Quality"** score displays
- [ ] ✅ Records display correctly otherwise
- [ ] ✅ Can filter and search records normally

### Compare Page Access
- [ ] Try accessing `/compare` directly (without record ID)
- [ ] ✅ Should show "No Record Selected" message
- [ ] ✅ Should have link to go back to Records page

### Similarity Search
- [ ] Navigate to **Similarity Search**
- [ ] ✅ User filter dropdown shows users **sorted by last name**
- [ ] ✅ Search box is available to filter users
- [ ] ✅ Type in search box to filter user list
- [ ] ✅ User count updates: "All Users (X of Y)" when searching

### Notes
```
Expected landing: /records
Dashboard removed: ✓
Alignment Scoring removed: ✓
Quality scores removed: ✓
User sorting & search: ✓
```

---

## 👤 User App (Port 3001)

**Role Required**: Any authenticated user (USER, QA, CORE, FLEET, ADMIN)

### Landing Page
- [ ] Navigate to http://localhost:3001
- [ ] After login, verify you land on **Time Tracking** page (not Dashboard)
- [ ] URL should be `/time-tracking`

### Sidebar Navigation
- [ ] Open sidebar
- [ ] ✅ Verify **NO "Dashboard"** link exists
- [ ] ✅ Verify **"Time Tracking"** link is present (first section)
- [ ] ✅ Verify **"Links"** link is present (under Resources)

### Time Tracking
- [ ] ✅ Time tracking interface loads correctly
- [ ] ✅ Can create time entries
- [ ] ✅ Can view time entries

### Links Page
- [ ] Navigate to **Links** page
- [ ] ✅ External links are displayed correctly
- [ ] ✅ Links are organized by category

### Notes
```
Expected landing: /time-tracking
Dashboard removed: ✓
Navigation simplified: ✓
```

---

## 👑 Admin App (Port 3005)

**Role Required**: ADMIN

### Status Check
- [ ] Navigate to http://localhost:3005
- [ ] ✅ **Dashboard SHOULD STILL BE PRESENT** (Admin app unchanged)
- [ ] ✅ All admin features accessible
- [ ] ✅ User Management works
- [ ] ✅ AI Settings work

### Notes
```
Admin app: UNCHANGED (Dashboard still present) ✓
```

---

## 🔄 Cross-App Testing

### Role-Based Access
Test with different roles to verify correct redirects:

**USER Role**:
- [ ] Can access User app
- [ ] Cannot access QA, Core, Fleet features
- [ ] Redirected to appropriate page when trying to access restricted features

**QA Role**:
- [ ] Can access QA app features
- [ ] Cannot access alignment scoring
- [ ] Cannot access Fleet management

**CORE Role**:
- [ ] Can access Core app features
- [ ] CAN access alignment scoring
- [ ] Sidebar shows Alignment Scoring link

**FLEET Role**:
- [ ] Can access all Fleet features
- [ ] Can access alignment scoring in Core app
- [ ] Landing page is Analytics

**ADMIN Role**:
- [ ] Can access all features
- [ ] Admin app still has Dashboard
- [ ] Can switch between all apps

---

## 📝 Quick Verification Script

Open browser console and run on each app:

```javascript
// Check for Dashboard link
const dashboardLinks = document.querySelectorAll('a[href="/"]');
const hasDashboard = Array.from(dashboardLinks).some(link =>
  link.textContent.toLowerCase().includes('dashboard')
);
console.log('Dashboard link found:', hasDashboard); // Should be FALSE (except Admin)

// Check current path matches expected landing page
console.log('Current path:', window.location.pathname);
```

---

## ✅ Success Criteria

### All Apps (except Admin)
- ✅ NO Dashboard links in sidebar
- ✅ Landing pages redirect to primary feature (not `/`)
- ✅ Navigation works smoothly
- ✅ No broken links

### Core App Specific
- ✅ Alignment Scoring accessible
- ✅ Sidebar alphabetically ordered
- ✅ Only CORE+ roles can access

### QA App Specific
- ✅ NO Alignment Scoring
- ✅ NO Quality scores on Records
- ✅ User sorting and search works

### Fleet App Specific
- ✅ Projects alphabetically sorted

---

## 🐛 Issues Found

Use this section to track any issues:

| App | Issue | Severity | Notes |
|-----|-------|----------|-------|
| | | | |
| | | | |

---

## 📊 Final Sign-Off

- [ ] All Fleet app tests passed
- [ ] All Core app tests passed
- [ ] All QA app tests passed
- [ ] All User app tests passed
- [ ] Admin app unchanged (Dashboard still present)
- [ ] Cross-app navigation works
- [ ] Role-based access control works

**Tester**: _________________
**Date**: _________________
**Build/Branch**: feat/ui-ux-improvements

---

## 🚨 Common Issues & Solutions

### Issue: Can't log in
**Solution**: Ensure you have a valid user account created via Admin panel

### Issue: App not loading
**Solution**: Check that Supabase is running: `npm run dev:supabase`

### Issue: Wrong landing page
**Solution**: Clear browser cache/cookies and try again

### Issue: Sidebar not showing expected items
**Solution**: Check your user role - different roles see different navigation items

### Issue: 404 errors
**Solution**: Ensure the correct app is running on the expected port
