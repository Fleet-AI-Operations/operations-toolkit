'use client';

import React, { useEffect, useState } from 'react';
import { Shield, ChevronDown, Settings } from 'lucide-react';

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  userId: string;
  userEmail: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [take] = useState(50);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Filter states
  const [actionFilter, setActionFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [skip, actionFilter, entityTypeFilter, userFilter, startDate, endDate]);

  const fetchLogs = async () => {
    try {
      const params = new URLSearchParams({ skip: skip.toString(), take: take.toString() });
      if (actionFilter) params.append('action', actionFilter);
      if (entityTypeFilter) params.append('entityType', entityTypeFilter);
      if (userFilter) params.append('userId', userFilter);
      if (startDate) params.append('startDate', new Date(startDate).toISOString());
      if (endDate) params.append('endDate', new Date(endDate).toISOString());

      const response = await fetch(`/api/audit-logs?${params}`);
      const data = await response.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    setSkip(0); // Reset to first page when applying filters - useEffect will trigger fetchLogs
  };

  const clearFilters = () => {
    setActionFilter('');
    setEntityTypeFilter('');
    setUserFilter('');
    setStartDate('');
    setEndDate('');
    setSkip(0); // Reset to first page when clearing filters - useEffect will trigger fetchLogs
  };

  const handlePrevious = () => {
    setSkip(Math.max(0, skip - take));
  };

  const handleNext = () => {
    if (skip + take < total) {
      setSkip(skip + take);
    }
  };

  const formatAction = (action: string) => {
    return action.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Audit Logs</h1>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" style={{ padding: '2rem', maxWidth: '100%' }}>
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3 mb-2">
          <Shield className="w-8 h-8 text-blue-400" />
          Audit Logs
        </h1>
        <p className="text-gray-400">
          Track user actions and administrative operations across the system.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white/5 rounded-lg border border-white/10">
        {/* Filter Header */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2" style={{ color: 'white' }}>
            <Settings className="w-5 h-5" style={{ color: 'white' }} />
            <span className="font-semibold" style={{ color: 'white' }}>Filters</span>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-gray-400 transition-transform ${
              showFilters ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Filter Controls */}
        {showFilters && (
          <div className="p-6 pt-0 border-t border-white/10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {/* Action Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Action
                </label>
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded text-white text-sm"
                >
                  <option value="">All Actions</option>
                  <option value="USER_CREATED">User Created</option>
                  <option value="USER_ROLE_CHANGED">User Role Changed</option>
                  <option value="USER_PASSWORD_RESET">Password Reset</option>
                  <option value="PROJECT_CREATED">Project Created</option>
                  <option value="PROJECT_UPDATED">Project Updated</option>
                  <option value="PROJECT_DELETED">Project Deleted</option>
                  <option value="SYSTEM_SETTINGS_UPDATED">Settings Updated</option>
                </select>
              </div>

              {/* Entity Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Entity Type
                </label>
                <select
                  value={entityTypeFilter}
                  onChange={(e) => setEntityTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded text-white text-sm"
                >
                  <option value="">All Types</option>
                  <option value="USER">User</option>
                  <option value="PROJECT">Project</option>
                  <option value="SYSTEM_SETTING">System Setting</option>
                </select>
              </div>

              {/* Start Date Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded text-white text-sm"
                />
              </div>

              {/* End Date Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded text-white text-sm"
                />
              </div>
            </div>

            {/* Filter Buttons */}
            <div className="flex gap-3">
              <button
                onClick={applyFilters}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors"
              >
                Apply Filters
              </button>
              <button
                onClick={clearFilters}
                className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded font-medium transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Logs Table */}
      <div className="bg-white/5 rounded-lg overflow-hidden" style={{ border: '2px solid rgba(255, 255, 255, 0.2)' }}>
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr className="bg-white/10" style={{ borderBottom: '2px solid rgba(255, 255, 255, 0.2)' }}>
              <th
                className="px-6 py-4 font-semibold text-sm text-gray-200"
                style={{ width: '20%', borderRight: '1px solid rgba(255, 255, 255, 0.15)', textAlign: 'center' }}
              >
                Timestamp
              </th>
              <th
                className="px-6 py-4 font-semibold text-sm text-gray-200"
                style={{ width: '45%', borderRight: '1px solid rgba(255, 255, 255, 0.15)', textAlign: 'center' }}
              >
                Action
              </th>
              <th
                className="px-6 py-4 font-semibold text-sm text-gray-200"
                style={{ width: '30%', borderRight: '1px solid rgba(255, 255, 255, 0.15)', textAlign: 'center' }}
              >
                User
              </th>
              <th className="px-6 py-4 font-semibold text-sm text-gray-200" style={{ width: '5%', textAlign: 'center' }}>

              </th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <React.Fragment key={log.id}>
                {/* Main Row */}
                <tr
                  onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  className="hover:bg-white/10 cursor-pointer transition-colors"
                  style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}
                >
                  <td
                    className="px-6 py-4 text-sm text-gray-300 whitespace-nowrap"
                    style={{ borderRight: '1px solid rgba(255, 255, 255, 0.15)', textAlign: 'center' }}
                  >
                    {formatDate(log.createdAt)}
                  </td>
                  <td
                    className="px-6 py-4"
                    style={{ borderRight: '1px solid rgba(255, 255, 255, 0.15)', textAlign: 'center' }}
                  >
                    <div className="space-y-2 inline-block">
                      <div className="font-semibold text-white text-base">
                        {formatAction(log.action)}
                      </div>
                      <div>
                        <span className="inline-block px-3 py-1 bg-gray-700 text-gray-300 text-xs rounded-full">
                          {log.entityType.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td
                    className="px-6 py-4 text-sm text-gray-300"
                    style={{ borderRight: '1px solid rgba(255, 255, 255, 0.15)', textAlign: 'center' }}
                  >
                    {log.userEmail}
                  </td>
                  <td className="px-6 py-4" style={{ textAlign: 'center' }}>
                    <ChevronDown
                      className={`w-5 h-5 text-gray-400 transition-transform inline-block ${
                        expandedId === log.id ? 'rotate-180' : ''
                      }`}
                    />
                  </td>
                </tr>

                {/* Expanded Details Row */}
                {expandedId === log.id && (
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <td colSpan={4} style={{ padding: 0 }}>
                      <div className="bg-black/20" style={{ padding: '2rem' }}>
                        <div style={{ width: '100%' }}>
                          {/* Info Grid - Full Width */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '3rem',
                            marginBottom: '2rem'
                          }}>
                            <div>
                              <div className="text-gray-500 text-xs uppercase mb-2 font-semibold">Entity Type</div>
                              <div className="text-gray-300 text-base">{log.entityType}</div>
                            </div>
                            {log.entityId && (
                              <div>
                                <div className="text-gray-500 text-xs uppercase mb-2 font-semibold">Entity ID</div>
                                <code className="text-blue-400 text-sm break-all">{log.entityId}</code>
                              </div>
                            )}
                            <div>
                              <div className="text-gray-500 text-xs uppercase mb-2 font-semibold">Log ID</div>
                              <code className="text-gray-400 text-sm break-all">{log.id}</code>
                            </div>
                          </div>

                          {/* Metadata - Full Width */}
                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <div style={{ width: '100%' }}>
                              <div className="text-gray-500 text-xs uppercase mb-3 font-semibold">Metadata</div>
                              <pre
                                className="bg-black/50 text-gray-300 overflow-auto border border-white/10"
                                style={{
                                  padding: '1.5rem',
                                  borderRadius: '8px',
                                  fontSize: '0.875rem',
                                  lineHeight: '1.6',
                                  width: '100%'
                                }}
                              >
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}

            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-gray-400">
                  No audit logs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination Controls */}
        {logs.length > 0 && (
          <div style={{
            padding: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.9rem' }}>
              Showing {skip + 1} to {Math.min(skip + take, total)} of {total} logs
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handlePrevious}
                disabled={skip === 0}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 disabled:text-gray-600 rounded transition-colors"
                style={{ fontSize: '0.9rem' }}
              >
                Previous
              </button>
              <button
                onClick={handleNext}
                disabled={skip + take >= total}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 disabled:text-gray-600 rounded transition-colors"
                style={{ fontSize: '0.9rem' }}
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
