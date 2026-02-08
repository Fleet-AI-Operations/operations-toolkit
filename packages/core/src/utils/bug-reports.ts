/**
 * Utility functions for bug reports
 */

/**
 * Get the priority order for bug report statuses
 * Used for sorting: PENDING > IN_PROGRESS > RESOLVED
 */
export function getStatusPriority(status: string): number {
  switch (status) {
    case 'PENDING':
      return 1
    case 'IN_PROGRESS':
      return 2
    case 'RESOLVED':
      return 3
    default:
      return 4
  }
}

/**
 * Get the display label for a bug report status
 */
export function getStatusLabel(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'Pending'
    case 'IN_PROGRESS':
      return 'In Progress'
    case 'RESOLVED':
      return 'Resolved'
    default:
      return status
  }
}

/**
 * Get the color for a bug report status badge
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'PENDING':
      return '#fbbf24' // amber
    case 'IN_PROGRESS':
      return '#60a5fa' // blue
    case 'RESOLVED':
      return '#34d399' // green
    default:
      return '#9ca3af' // gray
  }
}
