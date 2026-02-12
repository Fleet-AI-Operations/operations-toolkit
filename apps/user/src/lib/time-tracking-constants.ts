/**
 * Valid time entry categories shared across all time tracking endpoints
 */
export const VALID_CATEGORIES = [
  'Writing New Tasks',
  'Updating Tasks Based on Feedback',
  'Time Spent on Instructions or Slack',
  'Platform Downtime',
  'Time Spent on QA',
] as const;

export type TimeEntryCategory = typeof VALID_CATEGORIES[number];
