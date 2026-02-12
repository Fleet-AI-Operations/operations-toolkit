# Browser Extension Quick Start Guide

## ⚠️ IMPORTANT SECURITY WARNING ⚠️

**THIS API IS UNAUTHENTICATED AND FOR DEVELOPMENT/MVP ONLY**

The endpoint described in this guide has **NO AUTHENTICATION** and should only be used for:
- ✅ Local development and testing
- ✅ Internal tools with trusted users
- ✅ Proof-of-concept / MVP

**DO NOT USE IN PRODUCTION** without implementing proper authentication!

See the full security warnings and authentication implementation plan in [API_TIME_TRACKING.md](../API_TIME_TRACKING.md#critical-security-warning).

---

## Overview

This guide will help you quickly integrate time tracking into your browser extension using the public API endpoint for development purposes.

## API Endpoint

```
POST http://localhost:3001/api/time-entries/record
```

**No authentication required** (for now - this will be added later)

## Minimal Example

```javascript
// Record time entry
fetch('http://localhost:3001/api/time-entries/record', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    category: 'Writing New Tasks',
    hours: 2,
    minutes: 30
  })
})
.then(res => res.json())
.then(data => {
  if (data.success) {
    console.log('Time recorded!', data.entry);
  } else {
    console.error('Error:', data.error);
  }
});
```

## Required Fields

- **email**: User's email address
- **category**: One of the following:
  - `"Writing New Tasks"`
  - `"Updating Tasks Based on Feedback"`
  - `"Time Spent on Instructions or Slack"`
  - `"Platform Downtime"`
  - `"Time Spent on QA"`
- **hours**: Integer 0-23
- **minutes**: Integer 0-59

## Optional Fields

- **count**: Task count (integer ≥ 0)
- **notes**: Additional notes (max 2000 characters)
- **date**: Date in YYYY-MM-DD format (defaults to today)

## Example Extension Files

### manifest.json (Chrome/Firefox)

```json
{
  "manifest_version": 3,
  "name": "Time Tracker",
  "version": "1.0.0",
  "description": "Track your work time",
  "permissions": [
    "storage",
    "notifications"
  ],
  "host_permissions": [
    "http://localhost:3001/*"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": "icon128.png"
  }
}
```

### popup.html

```html
<!DOCTYPE html>
<html>
<head>
  <title>Time Tracker</title>
  <style>
    body { width: 300px; padding: 15px; font-family: Arial, sans-serif; }
    label { display: block; margin-top: 10px; font-weight: bold; }
    select, input { width: 100%; padding: 5px; margin-top: 5px; }
    button { width: 100%; padding: 10px; margin-top: 15px; background: #4CAF50; color: white; border: none; cursor: pointer; }
    button:hover { background: #45a049; }
    .time-inputs { display: flex; gap: 10px; }
    .time-inputs input { width: 50%; }
  </style>
</head>
<body>
  <h2>Record Time</h2>
  <form id="timeForm">
    <label>Category:</label>
    <select id="category" required>
      <option value="">Select category...</option>
      <option value="Writing New Tasks">Writing New Tasks</option>
      <option value="Updating Tasks Based on Feedback">Updating Tasks</option>
      <option value="Time Spent on Instructions or Slack">Instructions/Slack</option>
      <option value="Platform Downtime">Platform Downtime</option>
      <option value="Time Spent on QA">QA</option>
    </select>

    <label>Time Spent:</label>
    <div class="time-inputs">
      <input type="number" id="hours" min="0" max="23" placeholder="Hours" required>
      <input type="number" id="minutes" min="0" max="59" placeholder="Minutes" required>
    </div>

    <label>Task Count (optional):</label>
    <input type="number" id="count" min="0" placeholder="Number of tasks">

    <label>Notes (optional):</label>
    <input type="text" id="notes" placeholder="Additional notes">

    <button type="submit">Record Time</button>
  </form>

  <div id="status"></div>

  <script src="popup.js"></script>
</body>
</html>
```

### popup.js

```javascript
const API_URL = 'http://localhost:3001/api/time-entries/record';

// Get user email from storage (or prompt for it)
async function getUserEmail() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['userEmail'], (result) => {
      if (!result.userEmail) {
        const email = prompt('Enter your email:');
        if (email) {
          chrome.storage.sync.set({ userEmail: email });
          resolve(email);
        } else {
          resolve(null);
        }
      } else {
        resolve(result.userEmail);
      }
    });
  });
}

// Show status message
function showStatus(message, isError = false) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.style.color = isError ? 'red' : 'green';
  status.style.marginTop = '10px';

  setTimeout(() => {
    status.textContent = '';
  }, 3000);
}

// Handle form submission
document.getElementById('timeForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = await getUserEmail();
  if (!email) {
    showStatus('Email is required', true);
    return;
  }

  const category = document.getElementById('category').value;
  const hours = parseInt(document.getElementById('hours').value);
  const minutes = parseInt(document.getElementById('minutes').value);
  const count = document.getElementById('count').value
    ? parseInt(document.getElementById('count').value)
    : null;
  const notes = document.getElementById('notes').value || null;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        category,
        hours,
        minutes,
        count,
        notes,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      showStatus(`Time recorded: ${hours}h ${minutes}m`);
      // Reset form
      document.getElementById('timeForm').reset();
    } else {
      showStatus(data.error || 'Failed to record time', true);
    }
  } catch (error) {
    showStatus('Network error: Could not connect', true);
  }
});
```

## Testing Locally

1. Start the user app: `pnpm turbo run dev --filter=@repo/user-app`
2. Load your extension in Chrome:
   - Go to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select your extension folder
3. Click the extension icon and test recording time!

## Next Steps

- See full documentation: `Documentation/API_TIME_TRACKING.md`
- See advanced examples: `Documentation/examples/browser-extension-example.js`
- Add timer functionality
- Add persistent storage
- Handle offline scenarios

## Production Deployment

When deploying to production:

1. Update `API_URL` to your production URL
2. Update `host_permissions` in manifest.json to match production domain
3. Add proper error handling
4. Consider adding authentication (coming soon)

## Support

For questions or issues, contact your system administrator or file an issue in the project repository.
