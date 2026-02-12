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

  // Expanded rows state
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (logId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedRows(newExpanded);
  };

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
    const iconClass = "w-5 h-5";
    switch (action) {
      case 'USER_CREATED':
        return <UserPlus className={iconClass} />;
      case 'USER_ROLE_CHANGED':
        return <UserCog className={iconClass} />;
      case 'USER_PASSWORD_RESET':
        return <KeyRound className={iconClass} />;
      case 'PROJECT_CREATED':
        return <FolderPlus className={iconClass} />;
      case 'PROJECT_UPDATED':
        return <FolderEdit className={iconClass} />;
      case 'PROJECT_DELETED':
        return <FolderMinus className={iconClass} />;
      case 'DATA_CLEARED':
      case 'ANALYTICS_CLEARED':
        return <Trash2 className={iconClass} />;
      case 'BULK_ALIGNMENT_STARTED':
        return <Sparkles className={iconClass} />;
      case 'SYSTEM_SETTINGS_UPDATED':
        return <Settings className={iconClass} />;
      case 'BONUS_WINDOW_CREATED':
      case 'BONUS_WINDOW_UPDATED':
      case 'BONUS_WINDOW_DELETED':
        return <Calendar className={iconClass} />;
      default:
        return <AlertCircle className={iconClass} />;
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
      <div className="glass-card bg-black/30">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors rounded-lg"
        >
          <span className="font-semibold text-white text-base flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Filters
          </span>
          {showFilters ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
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
          <div className="divide-y divide-white/5">
            {logs.map((log) => {
              const isExpanded = expandedRows.has(log.id);
              return (
                <div key={log.id} data-testid="audit-log-entry" className="group">
                  {/* Main Row - Clickable */}
                  <div
                    onClick={() => toggleRow(log.id)}
                    className={`flex items-center gap-4 p-4 cursor-pointer hover:bg-white/5 transition-colors border-l-4 ${getActionColor(
                      log.action
                    )}`}
                  >
                    {/* Icon */}
                    <div className="flex-shrink-0 p-2 bg-white/5 rounded-lg">
                      {getActionIcon(log.action)}
                    </div>

                    {/* Action & Entity */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-white">
                          {formatAction(log.action)}
                        </h3>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-700 text-gray-300">
                          {log.entityType.replace('_', ' ')}
                        </span>
                        {log.entityId && (
                          <code className="px-1.5 py-0.5 text-xs bg-black/40 rounded font-mono text-blue-400">
                            #{log.entityId.slice(0, 8)}
                          </code>
                        )}
                      </div>
                    </div>

                    {/* User */}
                    <div className="hidden md:flex items-center text-sm text-gray-400 min-w-[200px]">
                      <span className="text-gray-300 font-medium truncate">
                        {log.userEmail}
                      </span>
                    </div>

                    {/* Timestamp */}
                    <div className="hidden lg:block text-sm text-gray-500 min-w-[180px]">
                      {formatDate(log.createdAt)}
                    </div>

                    {/* Expand Indicator */}
                    <div className="flex-shrink-0">
                      <ChevronDown
                        className={`w-5 h-5 text-gray-400 transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="bg-black/20 border-l-4 border-transparent px-4 py-4 space-y-3">
                      {/* Mobile-only: Show user and timestamp */}
                      <div className="md:hidden space-y-2 pb-3 border-b border-white/5">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-500">User:</span>
                          <span className="text-gray-300 font-medium">{log.userEmail}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-500">Time:</span>
                          <span className="text-gray-400">{formatDate(log.createdAt)}</span>
                        </div>
                      </div>

                      {/* Metadata */}
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div>
                          <div className="text-sm font-medium text-gray-400 mb-2">
                            Metadata
                          </div>
                          <pre className="text-xs bg-black/50 p-3 rounded-lg overflow-auto border border-white/5 text-gray-300 leading-relaxed">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Additional Details */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        <div>
                          <div className="text-gray-500 text-xs mb-1">Log ID</div>
                          <code className="text-xs text-gray-400 font-mono break-all">
                            {log.id}
                          </code>
                        </div>
                        {log.projectId && (
                          <div>
                            <div className="text-gray-500 text-xs mb-1">Project ID</div>
                            <code className="text-xs text-gray-400 font-mono break-all">
                              {log.projectId}
                            </code>
                          </div>
                        )}
                        {log.entityId && (
                          <div>
                            <div className="text-gray-500 text-xs mb-1">Entity ID</div>
                            <code className="text-xs text-gray-400 font-mono break-all">
                              {log.entityId}
                            </code>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
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
