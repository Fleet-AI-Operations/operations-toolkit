'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CheckSquare, Filter, X, Calendar, Upload, CheckCircle2, XCircle } from 'lucide-react';

interface WorkerMetrics {
  workerName: string;
  workerEmail: string;
  totalTasks: number;
  totalHours: number;
  avgHoursPerTask: number;
  daysActive: number;
  tasksPerDay: number;
  experienceLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  flagStatus: 'NORMAL' | 'FAST' | 'SLOW' | 'INCONSISTENT';
  flagReason: string | null;
  firstReportDate: string;
  lastReportDate: string;
}

interface Summary {
  totalWorkers: number;
  teamAvgAHT: number;
  teamAvgTasksPerDay: number;
  flaggedWorkers: number;
  lowExperience: number;
  mediumExperience: number;
  highExperience: number;
  slowWorkers: number;
  fastWorkers: number;
  inconsistentWorkers: number;
}

interface Pagination {
  page: number;
  limit: number;
  totalPages: number;
  totalRecords: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

const EXPERIENCE_COLORS = {
  LOW: '#ff6600',
  MEDIUM: '#ffa500',
  HIGH: '#00ff88',
};

const FLAG_COLORS = {
  NORMAL: '#00ff88',
  FAST: '#ffa500',
  SLOW: '#ff4d4d',
  INCONSISTENT: '#ff6600',
};

export default function TimeReportingScreeningPage() {
  const [workers, setWorkers] = useState<WorkerMetrics[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedWorkers, setSelectedWorkers] = useState<Set<string>>(new Set());

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [experienceFilter, setExperienceFilter] = useState('all');
  const [flagFilter, setFlagFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageLimit] = useState(50);

  // Sorting
  const [sortColumn, setSortColumn] = useState<keyof WorkerMetrics>('avgHoursPerTask');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    fetchScreening();
  }, []);

  const fetchScreening = async (page: number = currentPage) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (experienceFilter !== 'all') params.append('experienceLevel', experienceFilter);
      if (flagFilter !== 'all') params.append('flagStatus', flagFilter);
      params.append('page', page.toString());
      params.append('limit', pageLimit.toString());

      const response = await fetch(`/api/time-reporting/screening?${params.toString()}`);
      const data = await response.json();

      setWorkers(data.workers || []);
      setSummary(data.summary || null);
      setPagination(data.pagination || null);
      setCurrentPage(page);
    } catch (error) {
      console.error('Error fetching screening data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportError(null);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/time-reporting/import', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        setImportError(result.error || 'Import failed');
      } else {
        setImportResult(result);
        // Refresh data after successful import
        fetchScreening();
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
      e.target.value = ''; // Reset file input
    }
  };

  const handleSort = (column: keyof WorkerMetrics) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  // Filter by search query
  const searchFilteredWorkers = workers.filter(worker => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      worker.workerName.toLowerCase().includes(query) ||
      worker.workerEmail.toLowerCase().includes(query)
    );
  });

  // Sort filtered workers
  const sortedWorkers = [...searchFilteredWorkers].sort((a, b) => {
    const aVal = a[sortColumn];
    const bVal = b[sortColumn];

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }

    const aStr = String(aVal);
    const bStr = String(bVal);
    return sortDirection === 'asc'
      ? aStr.localeCompare(bStr)
      : bStr.localeCompare(aStr);
  });

  const toggleWorkerSelection = (email: string) => {
    const newSelection = new Set(selectedWorkers);
    if (newSelection.has(email)) {
      newSelection.delete(email);
    } else {
      newSelection.add(email);
    }
    setSelectedWorkers(newSelection);
  };

  const selectAllFlagged = () => {
    // Select flagged workers from current search/filter results
    const flagged = sortedWorkers.filter(w => w.flagStatus !== 'NORMAL').map(w => w.workerEmail);
    setSelectedWorkers(new Set(flagged));
  };

  const clearSelection = () => {
    setSelectedWorkers(new Set());
  };

  const runDeepAnalysis = () => {
    const emails = Array.from(selectedWorkers);
    if (emails.length === 0) {
      alert('Please select at least one worker for deep analysis');
      return;
    }

    // Navigate to deep analysis page with selected workers
    const emailsParam = encodeURIComponent(emails.join(','));
    window.location.href = `/time-reporting-analysis?workers=${emailsParam}`;
  };

  return (
    <div style={{ padding: '40px', maxWidth: '1800px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1
            style={{
              fontSize: '32px',
              fontWeight: 700,
              marginBottom: '8px',
              background: 'linear-gradient(135deg, var(--accent) 0%, #00d4ff 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Quick Screening
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>
            Fast metrics-based analysis to identify workers with unusual patterns. Select workers for{' '}
            <Link href="/time-reporting-analysis" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
              Deep Analysis
            </Link>
            .
          </p>
        </div>
        <button
          onClick={() => setShowImportModal(true)}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Upload className="w-4 h-4" />
          Import CSV
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Filters</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Start Date
            </label>
            <div style={{ position: 'relative' }}>
              <Calendar
                className="w-4 h-4"
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--accent)',
                  pointerEvents: 'none',
                  zIndex: 1
                }}
              />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: '6px',
                  border: '2px solid var(--accent)',
                  backgroundColor: 'rgba(var(--accent-rgb), 0.05)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500 }}>
              End Date
            </label>
            <div style={{ position: 'relative' }}>
              <Calendar
                className="w-4 h-4"
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--accent)',
                  pointerEvents: 'none',
                  zIndex: 1
                }}
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: '6px',
                  border: '2px solid var(--accent)',
                  backgroundColor: 'rgba(var(--accent-rgb), 0.05)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>
              Experience Level
            </label>
            <select
              value={experienceFilter}
              onChange={(e) => setExperienceFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-primary)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="all">All Levels</option>
              <option value="LOW">Low (&lt;50 tasks)</option>
              <option value="MEDIUM">Medium (50-200 tasks)</option>
              <option value="HIGH">High (200+ tasks)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>
              Flag Status
            </label>
            <select
              value={flagFilter}
              onChange={(e) => setFlagFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-primary)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="all">All Statuses</option>
              <option value="NORMAL">Normal</option>
              <option value="SLOW">Slow AHT</option>
              <option value="FAST">Fast AHT</option>
              <option value="INCONSISTENT">Inconsistent</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>
              Search Worker
            </label>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-primary)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        </div>

        <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
          <button
            onClick={() => {
              setCurrentPage(1);
              fetchScreening(1);
            }}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Filter className="w-4 h-4" />
            Apply Filters
          </button>
          <button
            onClick={() => {
              setStartDate('');
              setEndDate('');
              setExperienceFilter('all');
              setFlagFilter('all');
              setSearchQuery('');
              setCurrentPage(1);
              // Trigger fetch after clearing
              setTimeout(() => fetchScreening(1), 0);
            }}
            className="btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              borderColor: 'rgb(239, 68, 68)',
              color: 'rgb(239, 68, 68)'
            }}
          >
            <X className="w-4 h-4" />
            Clear Filters
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Total Workers
            </div>
            <div style={{ fontSize: '32px', fontWeight: 600 }}>
              {summary.totalWorkers}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Flagged Workers
            </div>
            <div style={{ fontSize: '32px', fontWeight: 600, color: summary.flaggedWorkers > 0 ? '#ff6600' : 'inherit' }}>
              {summary.flaggedWorkers}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
              {summary.totalWorkers > 0 ? ((summary.flaggedWorkers / summary.totalWorkers) * 100).toFixed(1) : 0}% of total
            </div>
          </div>

          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Team Avg AHT
            </div>
            <div style={{ fontSize: '32px', fontWeight: 600 }}>
              {summary.teamAvgAHT?.toFixed(2) || '0.00'}h
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
              Hours per task
            </div>
          </div>

          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Avg Tasks/Day
            </div>
            <div style={{ fontSize: '32px', fontWeight: 600 }}>
              {summary.teamAvgTasksPerDay?.toFixed(1) || '0.0'}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Experience Breakdown
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 600, color: EXPERIENCE_COLORS.LOW }}>
                  {summary.lowExperience}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Low</div>
              </div>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 600, color: EXPERIENCE_COLORS.MEDIUM }}>
                  {summary.mediumExperience}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Med</div>
              </div>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 600, color: EXPERIENCE_COLORS.HIGH }}>
                  {summary.highExperience}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>High</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Selection Actions - Sticky Banner */}
      {selectedWorkers.size > 0 && (
        <div
          className="glass-card"
          style={{
            padding: '16px',
            marginBottom: '24px',
            backgroundColor: 'var(--accent)22',
            border: '1px solid var(--accent)44',
            position: 'sticky',
            top: '0',
            zIndex: 100,
            backdropFilter: 'blur(20px)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>
              {selectedWorkers.size} worker{selectedWorkers.size !== 1 ? 's' : ''} selected
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={runDeepAnalysis} className="btn-primary">
                Run Deep Analysis →
              </button>
              <button onClick={clearSelection} className="btn-secondary">
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workers Table */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 600 }}>
              Worker Metrics {loading && '(Loading...)'}
            </h3>
            {searchQuery && (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Showing {sortedWorkers.length} of {workers.length} workers
              </p>
            )}
          </div>
          <button
            onClick={selectAllFlagged}
            className="btn-primary"
            style={{
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <CheckSquare className="w-4 h-4" />
            Select All Flagged
          </button>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
            Loading screening data...
          </p>
        ) : workers.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
            No workers found. Adjust filters or check data availability.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-primary)', textAlign: 'left' }}>
                  <th style={{ padding: '12px', width: '40px' }}>
                    <input
                      type="checkbox"
                      checked={selectedWorkers.size === sortedWorkers.length && sortedWorkers.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedWorkers(new Set(sortedWorkers.map(w => w.workerEmail)));
                        } else {
                          setSelectedWorkers(new Set());
                        }
                      }}
                    />
                  </th>
                  <th
                    style={{ padding: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    onClick={() => handleSort('workerName')}
                  >
                    Worker {sortColumn === 'workerName' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    style={{ padding: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    onClick={() => handleSort('totalTasks')}
                  >
                    Total Tasks {sortColumn === 'totalTasks' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    style={{ padding: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    onClick={() => handleSort('totalHours')}
                  >
                    Total Hours {sortColumn === 'totalHours' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    style={{ padding: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    onClick={() => handleSort('avgHoursPerTask')}
                  >
                    Avg AHT {sortColumn === 'avgHoursPerTask' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    style={{ padding: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    onClick={() => handleSort('tasksPerDay')}
                  >
                    Tasks/Day {sortColumn === 'tasksPerDay' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    style={{ padding: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    onClick={() => handleSort('daysActive')}
                  >
                    Days Active {sortColumn === 'daysActive' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    style={{ padding: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    onClick={() => handleSort('experienceLevel')}
                  >
                    Experience {sortColumn === 'experienceLevel' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    style={{ padding: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    onClick={() => handleSort('flagStatus')}
                  >
                    Status {sortColumn === 'flagStatus' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                    Reason
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedWorkers.map((worker) => (
                  <tr key={worker.workerEmail} style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                    <td style={{ padding: '12px' }}>
                      <input
                        type="checkbox"
                        checked={selectedWorkers.has(worker.workerEmail)}
                        onChange={() => toggleWorkerSelection(worker.workerEmail)}
                      />
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div>{worker.workerName}</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>{worker.workerEmail}</div>
                    </td>
                    <td style={{ padding: '12px', fontFamily: 'monospace' }}>
                      {worker.totalTasks}
                    </td>
                    <td style={{ padding: '12px', fontFamily: 'monospace' }}>
                      {worker.totalHours.toFixed(1)}h
                    </td>
                    <td style={{ padding: '12px', fontFamily: 'monospace', fontWeight: 600 }}>
                      {worker.avgHoursPerTask.toFixed(2)}h
                    </td>
                    <td style={{ padding: '12px', fontFamily: 'monospace' }}>
                      {worker.tasksPerDay.toFixed(1)}
                    </td>
                    <td style={{ padding: '12px', fontFamily: 'monospace' }}>
                      {worker.daysActive}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '13px',
                          fontWeight: 600,
                          backgroundColor: `${EXPERIENCE_COLORS[worker.experienceLevel]}22`,
                          color: EXPERIENCE_COLORS[worker.experienceLevel],
                        }}
                      >
                        {worker.experienceLevel}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '13px',
                          fontWeight: 600,
                          backgroundColor: `${FLAG_COLORS[worker.flagStatus]}22`,
                          color: FLAG_COLORS[worker.flagStatus],
                        }}
                      >
                        {worker.flagStatus}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                      {worker.flagReason || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {pagination && pagination.totalPages > 1 && (
          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              Showing {((currentPage - 1) * pageLimit) + 1} - {Math.min(currentPage * pageLimit, pagination.totalRecords)} of {pagination.totalRecords} workers
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => fetchScreening(1)}
                disabled={!pagination.hasPreviousPage}
                className="btn-secondary"
                style={{
                  padding: '6px 12px',
                  fontSize: '14px',
                  opacity: pagination.hasPreviousPage ? 1 : 0.4,
                  cursor: pagination.hasPreviousPage ? 'pointer' : 'not-allowed'
                }}
              >
                First
              </button>
              <button
                onClick={() => fetchScreening(currentPage - 1)}
                disabled={!pagination.hasPreviousPage}
                className="btn-secondary"
                style={{
                  padding: '6px 12px',
                  fontSize: '14px',
                  opacity: pagination.hasPreviousPage ? 1 : 0.4,
                  cursor: pagination.hasPreviousPage ? 'pointer' : 'not-allowed'
                }}
              >
                Previous
              </button>
              <span style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 500, padding: '0 12px' }}>
                Page {currentPage} of {pagination.totalPages}
              </span>
              <button
                onClick={() => fetchScreening(currentPage + 1)}
                disabled={!pagination.hasNextPage}
                className="btn-secondary"
                style={{
                  padding: '6px 12px',
                  fontSize: '14px',
                  opacity: pagination.hasNextPage ? 1 : 0.4,
                  cursor: pagination.hasNextPage ? 'pointer' : 'not-allowed'
                }}
              >
                Next
              </button>
              <button
                onClick={() => fetchScreening(pagination.totalPages)}
                disabled={!pagination.hasNextPage}
                className="btn-secondary"
                style={{
                  padding: '6px 12px',
                  fontSize: '14px',
                  opacity: pagination.hasNextPage ? 1 : 0.4,
                  cursor: pagination.hasNextPage ? 'pointer' : 'not-allowed'
                }}
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div
          onClick={() => setShowImportModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-card"
            style={{
              padding: '32px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 600 }}>Import Time Reports</h2>
              <button
                onClick={() => setShowImportModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Upload a CSV file with time reporting data. The file should include columns for worker email, date, task count, and hours.
              </p>

              <input
                type="file"
                accept=".csv"
                onChange={handleImport}
                disabled={importing}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px dashed var(--border-primary)',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-secondary)',
                  cursor: 'pointer',
                }}
              />
            </div>

            {importing && (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                Importing...
              </div>
            )}

            {importError && (
              <div
                style={{
                  padding: '16px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgb(239, 68, 68)',
                  borderRadius: '8px',
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgb(239, 68, 68)' }}>
                  <XCircle className="w-5 h-5" />
                  <span style={{ fontWeight: 500 }}>Import Failed</span>
                </div>
                <p style={{ marginTop: '8px', color: 'rgb(239, 68, 68)', fontSize: '14px' }}>{importError}</p>
              </div>
            )}

            {importResult && (
              <div
                style={{
                  padding: '16px',
                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgb(34, 197, 94)',
                  borderRadius: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgb(34, 197, 94)', marginBottom: '12px' }}>
                  <CheckCircle2 className="w-5 h-5" />
                  <span style={{ fontWeight: 500 }}>Import Successful</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '14px' }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Imported:</span>
                    <span style={{ color: 'rgb(34, 197, 94)', fontWeight: 600, marginLeft: '8px' }}>
                      {importResult.imported || 0}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Skipped:</span>
                    <span style={{ color: 'rgb(234, 179, 8)', fontWeight: 600, marginLeft: '8px' }}>
                      {importResult.skipped || 0}
                    </span>
                  </div>
                </div>
                {importResult.message && (
                  <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {importResult.message}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
