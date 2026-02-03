/**
 * Unit tests for bug report utility functions
 */

import { describe, it, expect } from 'vitest';
import { getStatusPriority, getStatusLabel, getStatusColor } from '../bug-reports';

describe('bug-reports utilities', () => {
  describe('getStatusPriority', () => {
    it('should return 1 for PENDING status', () => {
      expect(getStatusPriority('PENDING')).toBe(1);
    });

    it('should return 2 for IN_PROGRESS status', () => {
      expect(getStatusPriority('IN_PROGRESS')).toBe(2);
    });

    it('should return 3 for RESOLVED status', () => {
      expect(getStatusPriority('RESOLVED')).toBe(3);
    });

    it('should return 4 for unknown status', () => {
      expect(getStatusPriority('UNKNOWN')).toBe(4);
      expect(getStatusPriority('')).toBe(4);
      expect(getStatusPriority('invalid')).toBe(4);
    });

    it('should maintain correct sort order (ascending priority)', () => {
      const pending = getStatusPriority('PENDING');
      const inProgress = getStatusPriority('IN_PROGRESS');
      const resolved = getStatusPriority('RESOLVED');

      expect(pending).toBeLessThan(inProgress);
      expect(inProgress).toBeLessThan(resolved);
    });
  });

  describe('getStatusLabel', () => {
    it('should return "Pending" for PENDING status', () => {
      expect(getStatusLabel('PENDING')).toBe('Pending');
    });

    it('should return "In Progress" for IN_PROGRESS status', () => {
      expect(getStatusLabel('IN_PROGRESS')).toBe('In Progress');
    });

    it('should return "Resolved" for RESOLVED status', () => {
      expect(getStatusLabel('RESOLVED')).toBe('Resolved');
    });

    it('should return original value for unknown status', () => {
      expect(getStatusLabel('UNKNOWN')).toBe('UNKNOWN');
      expect(getStatusLabel('custom_status')).toBe('custom_status');
    });

    it('should handle empty string', () => {
      expect(getStatusLabel('')).toBe('');
    });
  });

  describe('getStatusColor', () => {
    it('should return amber color for PENDING status', () => {
      expect(getStatusColor('PENDING')).toBe('#fbbf24');
    });

    it('should return blue color for IN_PROGRESS status', () => {
      expect(getStatusColor('IN_PROGRESS')).toBe('#60a5fa');
    });

    it('should return green color for RESOLVED status', () => {
      expect(getStatusColor('RESOLVED')).toBe('#34d399');
    });

    it('should return gray color for unknown status', () => {
      expect(getStatusColor('UNKNOWN')).toBe('#9ca3af');
      expect(getStatusColor('')).toBe('#9ca3af');
    });

    it('should return valid hex color codes', () => {
      const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

      expect(getStatusColor('PENDING')).toMatch(hexColorRegex);
      expect(getStatusColor('IN_PROGRESS')).toMatch(hexColorRegex);
      expect(getStatusColor('RESOLVED')).toMatch(hexColorRegex);
      expect(getStatusColor('UNKNOWN')).toMatch(hexColorRegex);
    });
  });

  describe('integration - sorting bug reports by priority', () => {
    it('should sort bug reports correctly using getStatusPriority', () => {
      const reports = [
        { id: '1', status: 'RESOLVED', createdAt: '2024-01-01' },
        { id: '2', status: 'PENDING', createdAt: '2024-01-02' },
        { id: '3', status: 'IN_PROGRESS', createdAt: '2024-01-03' },
        { id: '4', status: 'PENDING', createdAt: '2024-01-04' },
      ];

      const sorted = reports.sort((a, b) => {
        const statusDiff = getStatusPriority(a.status) - getStatusPriority(b.status);
        if (statusDiff !== 0) return statusDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      // First two should be PENDING (newest first)
      expect(sorted[0].status).toBe('PENDING');
      expect(sorted[0].id).toBe('4'); // Newest PENDING
      expect(sorted[1].status).toBe('PENDING');
      expect(sorted[1].id).toBe('2');

      // Third should be IN_PROGRESS
      expect(sorted[2].status).toBe('IN_PROGRESS');
      expect(sorted[2].id).toBe('3');

      // Last should be RESOLVED
      expect(sorted[3].status).toBe('RESOLVED');
      expect(sorted[3].id).toBe('1');
    });
  });
});
