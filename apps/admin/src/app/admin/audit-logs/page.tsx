'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Shield,
  ChevronDown,
  ChevronUp,
  UserPlus,
  UserCog,
  KeyRound,
  FolderPlus,
  FolderEdit,
  FolderMinus,
  Trash2,
  Sparkles,
  Settings,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { datetimeLocalToISO } from '@/lib/datetime';

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  projectId?: string;
  userId: string;
  userEmail: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  skip: number;
  take: number;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [take] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [actionFilter, setActionFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        skip: skip.toString(),
        take: take.toString(),
      });

      if (actionFilter) params.append('action', actionFilter);
      if (entityTypeFilter) params.append('entityType', entityTypeFilter);
      if (startDateFilter) params.append('startDate', datetimeLocalToISO(startDateFilter));
      if (endDateFilter) params.append('endDate', datetimeLocalToISO(endDateFilter));

      const response = await fetch(`/api/audit-logs?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch audit logs');
      }

      const data: AuditLogsResponse = await response.json();
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [skip, take, actionFilter, entityTypeFilter, startDateFilter, endDateFilter]);

  // Fetch logs on mount and when filters/pagination change
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Action icon mapping
  const getActionIcon = (action: string) => {
    switch (action) {
      case 'USER_CREATED':
        return <UserPlus className="w-4 h-4" />;
      case 'USER_ROLE_CHANGED':
        return <UserCog className="w-4 h-4" />;
      case 'USER_PASSWORD_RESET':
        return <KeyRound className="w-4 h-4" />;
      case 'PROJECT_CREATED':
        return <FolderPlus className="w-4 h-4" />;
      case 'PROJECT_UPDATED':
        return <FolderEdit className="w-4 h-4" />;
      case 'PROJECT_DELETED':
        return <FolderMinus className="w-4 h-4" />;
      case 'DATA_CLEARED':
      case 'ANALYTICS_CLEARED':
        return <Trash2 className="w-4 h-4" />;
      case 'BULK_ALIGNMENT_STARTED':
        return <Sparkles className="w-4 h-4" />;
      case 'SYSTEM_SETTINGS_UPDATED':
        return <Settings className="w-4 h-4" />;
      case 'BONUS_WINDOW_CREATED':
      case 'BONUS_WINDOW_UPDATED':
      case 'BONUS_WINDOW_DELETED':
        return <Calendar className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  // Action color mapping
  const getActionColor = (action: string): string => {
    if (action.includes('CREATED')) return 'border-green-500';
    if (action.includes('UPDATED') || action.includes('CHANGED')) return 'border-blue-500';
    if (action.includes('DELETED') || action.includes('CLEARED')) return 'border-red-500';
    if (action.includes('PASSWORD_RESET')) return 'border-yellow-500';
    return 'border-gray-500';
  };

  // Format action text
  const formatAction = (action: string): string => {
    return action
      .split('_')
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Pagination handlers
  const handlePrevious = () => {
    setSkip(Math.max(0, skip - take));
  };

  const handleNext = () => {
    if (skip + take < total) {
      setSkip(skip + take);
    }
  };

  // Reset filters
  const resetFilters = () => {
    setActionFilter('');
    setEntityTypeFilter('');
    setStartDateFilter('');
    setEndDateFilter('');
    setSkip(0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2 mb-2">
          <Shield className="w-6 h-6" />
          Audit Logs
        </h1>
        <p className="text-gray-400">
          Track user actions and administrative operations across the system.
        </p>
      </div>

      {/* Filters Section */}
      <div className="glass-card">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors rounded-lg"
        >
          <span className="font-semibold">Filters</span>
          {showFilters ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </button>

        {showFilters && (
          <div className="p-4 pt-0 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Action Filter */}
              <div>
                <label className="block text-sm font-medium mb-2">Action</label>
                <select
                  value={actionFilter}
                  onChange={(e) => {
                    setActionFilter(e.target.value);
                    setSkip(0);
                  }}
                  className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">All Actions</option>
                  <option value="USER_CREATED">User Created</option>
                  <option value="USER_ROLE_CHANGED">User Role Changed</option>
                  <option value="USER_PASSWORD_RESET">User Password Reset</option>
                  <option value="PROJECT_CREATED">Project Created</option>
                  <option value="PROJECT_UPDATED">Project Updated</option>
                  <option value="PROJECT_DELETED">Project Deleted</option>
                  <option value="DATA_CLEARED">Data Cleared</option>
                  <option value="ANALYTICS_CLEARED">Analytics Cleared</option>
                  <option value="BULK_ALIGNMENT_STARTED">Bulk Alignment Started</option>
                  <option value="SYSTEM_SETTINGS_UPDATED">System Settings Updated</option>
                  <option value="BONUS_WINDOW_CREATED">Bonus Window Created</option>
                  <option value="BONUS_WINDOW_UPDATED">Bonus Window Updated</option>
                  <option value="BONUS_WINDOW_DELETED">Bonus Window Deleted</option>
                </select>
              </div>

              {/* Entity Type Filter */}
              <div>
                <label className="block text-sm font-medium mb-2">Entity Type</label>
                <select
                  value={entityTypeFilter}
                  onChange={(e) => {
                    setEntityTypeFilter(e.target.value);
                    setSkip(0);
                  }}
                  className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">All Entities</option>
                  <option value="USER">User</option>
                  <option value="PROJECT">Project</option>
                  <option value="DATA_RECORD">Data Record</option>
                  <option value="SYSTEM_SETTING">System Setting</option>
                  <option value="BONUS_WINDOW">Bonus Window</option>
                </select>
              </div>

              {/* Start Date Filter */}
              <div>
                <label className="block text-sm font-medium mb-2">Start Date</label>
                <input
                  type="datetime-local"
                  value={startDateFilter}
                  onChange={(e) => {
                    setStartDateFilter(e.target.value);
                    setSkip(0);
                  }}
                  className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* End Date Filter */}
              <div>
                <label className="block text-sm font-medium mb-2">End Date</label>
                <input
                  type="datetime-local"
                  value={endDateFilter}
                  onChange={(e) => {
                    setEndDateFilter(e.target.value);
                    setSkip(0);
                  }}
                  className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Reset Filters Button */}
            <button
              onClick={resetFilters}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Logs List */}
      <div className="glass-card p-6">
        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading audit logs...</div>
        ) : error ? (
          <div className="text-center py-8 text-red-400">{error}</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No audit logs found matching your filters.
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                data-testid="audit-log-entry"
                className={`p-4 bg-black/20 rounded-lg border-l-4 ${getActionColor(
                  log.action
                )}`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">{getActionIcon(log.action)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{formatAction(log.action)}</span>
                      <span className="text-xs text-gray-500">
                        {log.entityType}
                        {log.entityId && ` #${log.entityId.slice(0, 8)}`}
                      </span>
                    </div>
                    <div className="text-sm text-gray-400 mb-1">
                      by {log.userEmail}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDate(log.createdAt)}
                    </div>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
                          View metadata
                        </summary>
                        <pre className="mt-2 text-xs bg-black/30 p-2 rounded overflow-auto">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && !error && logs.length > 0 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
            <div className="text-sm text-gray-400">
              Showing {skip + 1} to {Math.min(skip + take, total)} of {total} logs
            </div>
            <div className="flex gap-2">
              <button
                onClick={handlePrevious}
                disabled={skip === 0}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 disabled:text-gray-600 rounded-lg transition-colors"
              >
                Previous
              </button>
              <button
                onClick={handleNext}
                disabled={skip + take >= total}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 disabled:text-gray-600 rounded-lg transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
