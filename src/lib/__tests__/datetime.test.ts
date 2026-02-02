/**
 * Unit tests for datetime utility functions
 */

import { describe, it, expect } from 'vitest';
import { datetimeLocalToISO, isoToDatetimeLocal } from '../datetime';

describe('datetime utilities', () => {
  describe('datetimeLocalToISO', () => {
    it('should convert datetime-local string to ISO string format', () => {
      const input = '2024-01-15T10:00';
      const result = datetimeLocalToISO(input);

      // The result should be an ISO string with Z suffix (UTC)
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      // Parse the result to verify it's a valid date
      const date = new Date(result);
      expect(date.getTime()).not.toBeNaN();
    });

    it('should properly handle the date components', () => {
      const input = '2024-01-15T10:00';
      const result = datetimeLocalToISO(input);
      const date = new Date(result);

      // The local date/time should match when converted back
      expect(date.getFullYear()).toBe(2024);
      expect(date.getMonth()).toBe(0); // January (0-indexed)
      expect(date.getDate()).toBe(15);
      expect(date.getHours()).toBe(10);
      expect(date.getMinutes()).toBe(0);
    });

    it('should throw error for empty input', () => {
      expect(() => datetimeLocalToISO('')).toThrow('datetimeLocal value is required');
    });

    it('should throw error for invalid format', () => {
      expect(() => datetimeLocalToISO('invalid')).toThrow('Invalid datetime-local format');
      expect(() => datetimeLocalToISO('2024-01-15')).toThrow('Invalid datetime-local format');
    });
  });

  describe('isoToDatetimeLocal', () => {
    it('should convert ISO string to datetime-local format', () => {
      // Create a date and convert it to ISO
      const testDate = new Date(2024, 0, 15, 10, 0); // Jan 15, 2024, 10:00 local time
      const isoString = testDate.toISOString();

      // Convert back to datetime-local format
      const result = isoToDatetimeLocal(isoString);

      // Should be in YYYY-MM-DDTHH:mm format
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

      // Parse the result
      const [datePart, timePart] = result.split('T');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hours, minutes] = timePart.split(':').map(Number);

      // Should match the original local time components
      expect(year).toBe(2024);
      expect(month).toBe(1); // January
      expect(day).toBe(15);
      expect(hours).toBe(10);
      expect(minutes).toBe(0);
    });

    it('should pad single-digit values with zeros', () => {
      // Create a date with single-digit month, day, hour, minute
      const testDate = new Date(2024, 0, 5, 9, 5); // Jan 5, 2024, 09:05 local time
      const isoString = testDate.toISOString();
      const result = isoToDatetimeLocal(isoString);

      // Should have padded zeros
      const [datePart, timePart] = result.split('T');
      const [year, month, day] = datePart.split('-');
      const [hours, minutes] = timePart.split(':');

      expect(month).toBe('01');
      expect(day).toBe('05');
      expect(hours).toBe('09');
      expect(minutes).toBe('05');
    });

    it('should throw error for invalid ISO string', () => {
      expect(() => isoToDatetimeLocal('invalid')).toThrow('Invalid ISO string');
      expect(() => isoToDatetimeLocal('2024-13-01')).toThrow('Invalid ISO string');
    });
  });

  describe('round-trip conversion', () => {
    it('should maintain consistency through round-trip conversion', () => {
      const original = '2024-01-15T10:00';

      // Convert to ISO and back
      const iso = datetimeLocalToISO(original);
      const backToLocal = isoToDatetimeLocal(iso);

      // Should get back the same datetime-local value
      expect(backToLocal).toBe(original);
    });

    it('should handle different dates correctly in round-trip', () => {
      const testCases = [
        '2024-01-01T00:00',
        '2024-12-31T23:59',
        '2024-06-15T12:30',
        '2024-02-29T08:15', // Leap year
      ];

      for (const testCase of testCases) {
        const iso = datetimeLocalToISO(testCase);
        const backToLocal = isoToDatetimeLocal(iso);
        expect(backToLocal).toBe(testCase);
      }
    });
  });
});
