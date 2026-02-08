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
export function datetimeLocalToISO(datetimeLocal) {
    if (!datetimeLocal) {
        throw new Error('datetimeLocal value is required');
    }
    // Parse the datetime-local components
    const [datePart, timePart] = datetimeLocal.split('T');
    if (!datePart || !timePart) {
        throw new Error('Invalid datetime-local format. Expected YYYY-MM-DDTHH:mm');
    }
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    // Create Date object in local timezone
    // Month is 0-indexed in JavaScript Date constructor
    const date = new Date(year, month - 1, day, hour, minute);
    // Validate the date
    if (isNaN(date.getTime())) {
        throw new Error('Invalid date components');
    }
    // Convert to ISO string (UTC)
    return date.toISOString();
}
/**
 * Converts an ISO string to a datetime-local input value.
 *
 * Takes a UTC ISO string from the database and converts it to the format
 * expected by datetime-local inputs in the user's local timezone.
 *
 * @param isoString - ISO 8601 string (e.g., "2024-01-15T18:00:00.000Z")
 * @returns String for datetime-local input (e.g., "2024-01-15T10:00" in PST)
 */
export function isoToDatetimeLocal(isoString) {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
        throw new Error('Invalid ISO string');
    }
    // Format to YYYY-MM-DDTHH:mm in local timezone
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}
