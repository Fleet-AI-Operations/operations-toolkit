/**
 * Browser Extension Example for Time Tracking API
 *
 * ⚠️ SECURITY WARNING ⚠️
 * This example uses an UNAUTHENTICATED API endpoint that is only suitable for
 * development/MVP purposes. DO NOT use in production without implementing
 * proper authentication. See TIME_TRACKING_SECURITY_ROADMAP.md for details.
 *
 * This example shows how to integrate the time tracking API
 * into a Chrome/Firefox browser extension.
 */

// Configuration
const API_BASE_URL = 'http://localhost:3001'; // Change to your production URL
const API_ENDPOINT = `${API_BASE_URL}/api/time-entries/record`;

// Valid categories
const CATEGORIES = [
  'Writing New Tasks',
  'Updating Tasks Based on Feedback',
  'Time Spent on Instructions or Slack',
  'Platform Downtime',
  'Time Spent on QA',
];

/**
 * Record a time entry
 */
async function recordTimeEntry({
  email,
  category,
  hours,
  minutes,
  count = null,
  notes = null,
  date = null,
}) {
  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        category,
        hours,
        minutes,
        count,
        notes,
        date,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to record time entry');
    }

    return {
      success: true,
      entry: data.entry,
    };
  } catch (error) {
    console.error('Error recording time entry:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get user email from extension storage
 */
async function getUserEmail() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['userEmail'], (result) => {
      resolve(result.userEmail || null);
    });
  });
}

/**
 * Save user email to extension storage
 */
async function saveUserEmail(email) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ userEmail: email }, () => {
      resolve();
    });
  });
}

/**
 * Show notification to user
 */
function showNotification(message, type = 'info') {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon128.png',
    title: 'Time Tracker',
    message: message,
  });
}

/**
 * Example: Record time from popup UI
 */
async function handleFormSubmit(event) {
  event.preventDefault();

  // Get user email from storage
  const email = await getUserEmail();
  if (!email) {
    showNotification('Please configure your email in settings', 'error');
    return;
  }

  // Get form values
  const category = document.getElementById('category').value;
  const hours = parseInt(document.getElementById('hours').value);
  const minutes = parseInt(document.getElementById('minutes').value);
  const count = document.getElementById('count').value
    ? parseInt(document.getElementById('count').value)
    : null;
  const notes = document.getElementById('notes').value || null;

  // Validate
  if (!category || hours === undefined || minutes === undefined) {
    showNotification('Please fill in all required fields', 'error');
    return;
  }

  // Record time
  const result = await recordTimeEntry({
    email,
    category,
    hours,
    minutes,
    count,
    notes,
  });

  if (result.success) {
    showNotification(`Time recorded: ${hours}h ${minutes}m for ${category}`);
    // Clear form or close popup
    document.getElementById('timeForm').reset();
  } else {
    showNotification(`Error: ${result.error}`, 'error');
  }
}

/**
 * Example: Quick record buttons
 */
async function quickRecord(category, hours, minutes) {
  const email = await getUserEmail();
  if (!email) {
    showNotification('Please configure your email in settings', 'error');
    return;
  }

  const result = await recordTimeEntry({
    email,
    category,
    hours,
    minutes,
  });

  if (result.success) {
    showNotification(`Recorded ${hours}h ${minutes}m for ${category}`);
  } else {
    showNotification(`Error: ${result.error}`, 'error');
  }
}

/**
 * Example: Timer-based tracking
 */
class TimeTracker {
  constructor() {
    this.startTime = null;
    this.category = null;
    this.isRunning = false;
  }

  start(category) {
    this.startTime = Date.now();
    this.category = category;
    this.isRunning = true;
    this.saveState();
    showNotification(`Timer started for ${category}`);
  }

  async stop() {
    if (!this.isRunning) {
      showNotification('No timer is running', 'error');
      return;
    }

    const endTime = Date.now();
    const totalMinutes = Math.floor((endTime - this.startTime) / 1000 / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0 && minutes === 0) {
      showNotification('Timer must run for at least 1 minute', 'error');
      return;
    }

    const email = await getUserEmail();
    if (!email) {
      showNotification('Please configure your email in settings', 'error');
      return;
    }

    const result = await recordTimeEntry({
      email,
      category: this.category,
      hours,
      minutes,
    });

    if (result.success) {
      showNotification(`Recorded ${hours}h ${minutes}m for ${this.category}`);
      this.reset();
    } else {
      showNotification(`Error: ${result.error}`, 'error');
    }
  }

  reset() {
    this.startTime = null;
    this.category = null;
    this.isRunning = false;
    this.clearState();
  }

  saveState() {
    chrome.storage.local.set({
      timerState: {
        startTime: this.startTime,
        category: this.category,
        isRunning: this.isRunning,
      },
    });
  }

  clearState() {
    chrome.storage.local.remove('timerState');
  }

  async loadState() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['timerState'], (result) => {
        if (result.timerState) {
          this.startTime = result.timerState.startTime;
          this.category = result.timerState.category;
          this.isRunning = result.timerState.isRunning;
        }
        resolve();
      });
    });
  }

  getElapsedTime() {
    if (!this.isRunning) return { hours: 0, minutes: 0 };

    const totalMinutes = Math.floor((Date.now() - this.startTime) / 1000 / 60);
    return {
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60,
    };
  }
}

// Initialize tracker
const tracker = new TimeTracker();

// Example usage in popup.html
document.addEventListener('DOMContentLoaded', async () => {
  // Load saved timer state
  await tracker.loadState();

  // Update timer display if running
  if (tracker.isRunning) {
    const { hours, minutes } = tracker.getElapsedTime();
    document.getElementById('timerDisplay').textContent = `${hours}h ${minutes}m`;
    document.getElementById('timerCategory').textContent = tracker.category;
  }

  // Setup event listeners
  document.getElementById('startTimer')?.addEventListener('click', () => {
    const category = document.getElementById('timerCategory').value;
    tracker.start(category);
  });

  document.getElementById('stopTimer')?.addEventListener('click', () => {
    tracker.stop();
  });

  document.getElementById('timeForm')?.addEventListener('submit', handleFormSubmit);

  // Quick record buttons
  document.getElementById('quick1h')?.addEventListener('click', () => {
    const category = document.getElementById('category').value;
    quickRecord(category, 1, 0);
  });

  document.getElementById('quick30m')?.addEventListener('click', () => {
    const category = document.getElementById('category').value;
    quickRecord(category, 0, 30);
  });
});
