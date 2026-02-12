# USER Role Guide

**Welcome to Operations Tools!** This guide covers all features available to users with the USER role.

## 🏠 Your Application: User App

As a USER, you have access to the **User App** at:
- **Local**: http://localhost:3001
- **Production**: Your assigned user-app URL

## 📋 Table of Contents

1. [Getting Started](#getting-started)
2. [Time Tracking](#time-tracking)
3. [Links & Resources](#links--resources)
4. [Profile Management](#profile-management)
5. [Bug Reporting](#bug-reporting)

---

## Getting Started

### First Login

1. **Access the User App** using the URL provided by your administrator
2. **Log in** with your email and temporary password
3. **Change your password** when prompted (first login only)
4. You'll see the **User Dashboard** with your available tools

### Navigation

The User App sidebar shows:
- **Dashboard** - Your home page
- **Time Tracking** - Record your work hours
- **Links** - Quick access to external resources

---

## Time Tracking

Record and manage your work hours by category for accurate time tracking and reporting.

### Pay Cycles

The system tracks time in two pay cycles per month:
- **Cycle 1**: 1st to 15th of each month
- **Cycle 2**: 16th to end of month

The time tracking page displays totals for both the current and previous pay cycles.

### Recording Time

1. Navigate to **Time Tracking** from the sidebar
2. Fill in the **"Add Time Entry"** form:
   - **Date**: When you worked (defaults to today)
   - **Hours**: Hours worked (0-23)
   - **Minutes**: Minutes worked (0-59)
   - **Category**: Select from available categories
   - **Count** (optional): Number of tasks/items (appears for certain categories)
   - **Additional Notes** (optional): Any relevant context (max 2000 characters)
3. Click **"Add Entry"** to save

**Available Categories:**
- **Writing New Tasks** (with optional count)
- **Updating Tasks Based on Feedback** (with optional count)
- **Time Spent on Instructions or Slack**
- **Platform Downtime**
- **Time Spent on QA** (QA role and above only, with optional count)

⚠️ **Note**: You cannot submit 0h 0m. At least 1 minute is required.

### Viewing Your Time Records

**Pay Cycle Summary** (top of page):
- Current pay cycle total and date range
- Previous pay cycle total and date range

**Category Totals**:
- Total time across all categories
- Individual totals for each category

**Your Time Entries Table**:
- Shows entries from the past 14 days
- Displays date, time, category, count (if applicable), and notes
- Sorted by most recent first

### Editing Time Entries

1. Find the entry in your time tracking list
2. Click the **Edit** icon (blue button)
3. The form will populate with the entry's data
4. Update any fields
5. Click **"Update Entry"** to save changes
6. Click **"Cancel"** to discard changes

### Deleting Time Entries

1. Find the entry to delete
2. Click the **Delete** icon (red button)
3. A confirmation modal will appear
4. Click **"Delete"** to confirm or **"Cancel"** to abort

⚠️ **Note**: Deleted entries cannot be recovered.

### Best Practices

- **Record daily**: Log your time at the end of each day while it's fresh
- **Be specific**: Use the most appropriate category for your work
- **Use count field**: Track the number of tasks completed when applicable
- **Add notes**: Include helpful context like specific task IDs or project names
- **Review weekly**: Check your entries regularly to ensure accuracy
- **Track pay cycles**: Monitor your totals for each pay cycle for reporting

---

## Links & Resources

Quick access to external resources and documentation.

### Accessing Links

1. Navigate to **Links** from the sidebar
2. Browse categorized links:
   - **General Resources** - Company docs, wikis, tools
   - **Project Guidelines** - Project-specific documentation
   - **External Tools** - Third-party services you may need

### Using Links

- Click any link to open in a new tab
- Links are organized by category for easy discovery
- Bookmark frequently used links in your browser

### Requesting New Links

If you need a link added:
1. Contact your manager or administrator
2. Provide the URL and suggested category
3. Administrator will add it to the Links page

---

## Profile Management

Manage your account settings and profile information.

### Accessing Your Profile

1. Click your **profile icon** in the top-right corner
2. Select **"Profile"** from the dropdown

### Updating Your Profile

**Email**:
- Your email is set by administrators
- Contact an admin to change your email address

**Password**:
1. Click **"Change Password"**
2. Enter your current password
3. Enter new password (must meet requirements):
   - At least 8 characters
   - Mix of letters and numbers recommended
4. Confirm new password
5. Click **"Update Password"**

**Display Preferences**:
- Theme settings (if available)
- Notification preferences
- Language settings (if available)

### Security

**Password Best Practices**:
- Use a unique password for this application
- Include uppercase, lowercase, numbers, and symbols
- Avoid common words or personal information
- Change your password if you suspect it's compromised

**Logout**:
1. Click your profile icon
2. Select **"Logout"**
3. You'll be redirected to the login page

> 🔒 **Security Tip**: Always logout when using a shared computer.

---

## Bug Reporting

Report issues or problems you encounter while using the application.

### When to Report a Bug

Report bugs when you experience:
- Features not working as expected
- Error messages
- Data not saving properly
- Pages not loading
- Unexpected behavior

### How to Report a Bug

1. Click the **"Report Bug"** button (usually in header or footer)
2. Fill out the bug report form:
   - **Title**: Brief description (e.g., "Time entry won't save")
   - **Description**: Detailed explanation of the problem
   - **Steps to Reproduce**: What you did before the error occurred
   - **Expected Behavior**: What should have happened
   - **Actual Behavior**: What actually happened
   - **Screenshot**: Optional, but very helpful
3. Click **"Submit Report"**

### Good Bug Reports Include

✅ **Clear title**: "Cannot delete time entries"
✅ **Detailed steps**: "1. Go to Time Tracking, 2. Click delete on any entry, 3. Error appears"
✅ **What you expected**: "Entry should be deleted"
✅ **What happened**: "Got error: 'Permission denied'"
✅ **Screenshot**: Shows the exact error message

❌ **Bad bug report**: "It's broken" - too vague, no details

### After Reporting

- You'll receive a confirmation that your report was submitted
- Administrators will review and prioritize the issue
- You may be contacted for additional information
- Check back for updates on the bug status

### Urgent Issues

For critical issues (data loss, security concerns, system outage):
1. Report the bug as usual
2. **Also contact** your manager or IT support immediately
3. Provide your bug report number for reference

---

## Frequently Asked Questions

### Can I access other tools or features?

As a USER, you have access to the User App only. If you need access to additional features (Analysis Tools, Scoring, Fleet Management), request a role upgrade from your administrator.

### How do I know what my role is?

Your role is displayed in your profile. Click your profile icon in the top-right corner to see your current role.

### Can I change my own role?

No, only administrators can assign or change user roles. If you need different permissions, contact your administrator with a business justification.

### Why can't I see certain menu items?

Some features are restricted to higher roles (QA, CORE, FLEET, ADMIN). Your USER role provides access to essential features for general users.

### My time tracking isn't saving - what should I do?

1. Check your internet connection
2. Refresh the page and try again
3. If the problem persists, report it as a bug
4. Save your time entry details in a text file as backup

### How do I request new features?

1. Discuss with your manager first
2. Submit a detailed feature request through the bug reporting system
3. Mark it as "Feature Request" in the title
4. Explain the business need and expected benefit

### Can I export my data?

Yes, you can export your time tracking data to CSV from the Time Tracking page. Other data exports may require administrator assistance.

---

## Tips for Success

### Efficiency Tips

1. **Use keyboard shortcuts** (if available) for common actions
2. **Bookmark your most-used pages** for quick access
3. **Record time daily** to avoid forgetting hours worked
4. **Keep descriptions consistent** for easier reporting later

### Getting Help

**In-App Help**:
- Look for "?" icons next to features for tooltips
- Check the Links page for documentation

**Support Channels**:
- Bug reports for technical issues
- Manager for permissions or role questions
- Administrator for account issues

### Best Practices

- **Log in daily** to stay current with updates
- **Keep your password secure** and change it periodically
- **Report bugs promptly** to help improve the system
- **Provide feedback** when requested to help shape future features

---

## Need More Access?

If your role responsibilities require additional features:

**QA Tools** - For quality assurance work, request QA role
**Scoring Tools** - For evaluation tasks, request CORE role
**Fleet Management** - For project management, request FLEET role
**Administration** - For system administration, request ADMIN role

Contact your manager or administrator to discuss role changes.

---

## Support & Feedback

**Technical Issues**: Use the bug reporting feature
**Feature Requests**: Discuss with your manager, then submit via bug reports
**Account Issues**: Contact your administrator
**Questions**: Check this guide first, then ask your manager

---

**Document Version**: 1.0
**Last Updated**: February 2026
**Role**: USER
**Access Level**: Basic (User App only)
