/**
 * Datetime utility functions for handling timezone conversions
 */
/**
 * Converts a datetime-local input value to an ISO string.
 *
 * The datetime-local input provides a string like "2024-01-15T10:00" which represents
 * local time. This function interprets it as the user's local timezone and converts
 * it to a proper ISO string with UTC timezone.
 *
 * @param datetimeLocal - String from datetime-local input (e.g., "2024-01-15T10:00")
 * @returns ISO 8601 string in UTC (e.g., "2024-01-15T18:00:00.000Z" for PST)
 */
export declare function datetimeLocalToISO(datetimeLocal: string): string;
/**
 * Converts an ISO string to a datetime-local input value.
 *
 * Takes a UTC ISO string from the database and converts it to the format
 * expected by datetime-local inputs in the user's local timezone.
 *
 * @param isoString - ISO 8601 string (e.g., "2024-01-15T18:00:00.000Z")
 * @returns String for datetime-local input (e.g., "2024-01-15T10:00" in PST)
 */
export declare function isoToDatetimeLocal(isoString: string): string;
//# sourceMappingURL=datetime.d.ts.map