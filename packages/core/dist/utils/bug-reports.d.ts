/**
 * Utility functions for bug reports
 */
/**
 * Get the priority order for bug report statuses
 * Used for sorting: PENDING > IN_PROGRESS > RESOLVED
 */
export declare function getStatusPriority(status: string): number;
/**
 * Get the display label for a bug report status
 */
export declare function getStatusLabel(status: string): string;
/**
 * Get the color for a bug report status badge
 */
export declare function getStatusColor(status: string): string;
//# sourceMappingURL=bug-reports.d.ts.map