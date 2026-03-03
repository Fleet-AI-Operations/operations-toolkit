'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Calendar, X, RefreshCw } from 'lucide-react';

interface Flag {
  id: string;
  workerName: string;
  workerEmail: string;
  workDate: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';
  flagReason: string;
  actualHours: number;
  expectedHours: number;
  discrepancyPercentage: number;
  averageQualityScore: number;
  meetingHoursVerified: number;
  reviewedBy?: {
    email: string;
    id: string;
  };
  reviewedAt?: string;
  resolutionNotes?: string;
}

interface Summary {
  totalReports: number;
  totalFlags: number;
  flagsBySeverity: Record<string, number>;
  averageDiscrepancy: number;
  averageQuality: number;
}

interface WorkerDetails {
  workerEmail: string;
  workerName: string;
  summary: {
    totalReports: number;
    totalHoursWorked: number;
    totalEstimatedHours: number;
    totalMeetingHoursClaimed: number;
    totalMeetingHoursVerified: number;
    averageQualityScore: number;
    totalFlags: number;
    flagsBySeverity: Record<string, number>;
    flagsByStatus: Record<string, number>;
  };
  timeReports: any[];
}

const SEVERITY_COLORS = {
  LOW: '#00ff88',
  MEDIUM: '#ffaa00',
  HIGH: '#ff6600',
  CRITICAL: '#ff4d4d',
};

export default function TimeReportingAnalysisPage() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [startDate, setStartDate] = useState('2026-02-01');
  const [endDate, setEndDate] = useState('2026-02-15');
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);
  const [workerDetails, setWorkerDetails] = useState<WorkerDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [selectedWorkerEmails, setSelectedWorkerEmails] = useState<string[]>([]);
  const [forceReanalyze, setForceReanalyze] = useState(false);

  // Notes modal state
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notesModalData, setNotesModalData] = useState<{ flagId: string; status: string; actionLabel: string } | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  const fetchFlags = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (severityFilter !== 'all') params.append('severity', severityFilter);

      const response = await fetch(`/api/time-reporting/flags?${params}`);
      if (response.ok) {
        const data = await response.json();
        let flagsData = data.flags || [];

        // Filter by selected workers if coming from Quick Screening
        if (selectedWorkerEmails.length > 0) {
          flagsData = flagsData.filter((flag: Flag) =>
            selectedWorkerEmails.includes(flag.workerEmail)
          );

          // Calculate summary from filtered flags instead of fetching from server
          const flagsBySeverity: Record<string, number> = {};
          let totalDiscrepancy = 0;
          let totalQuality = 0;
          let qualityCount = 0;

          flagsData.forEach((flag: Flag) => {
            flagsBySeverity[flag.severity] = (flagsBySeverity[flag.severity] || 0) + 1;
            totalDiscrepancy += flag.discrepancyPercentage || 0;
            if (flag.averageQualityScore) {
              totalQuality += flag.averageQualityScore;
              qualityCount++;
            }
          });

          setSummary({
            totalReports: flagsData.length,
            totalFlags: flagsData.length,
            flagsBySeverity,
            averageDiscrepancy: flagsData.length > 0 ? totalDiscrepancy / flagsData.length : 0,
            averageQuality: qualityCount > 0 ? totalQuality / qualityCount : 0,
          });
        }

        setFlags(flagsData);
      }
    } catch (error) {
      console.error('Error fetching flags:', error);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, statusFilter, severityFilter]);
  // Note: selectedWorkerEmails intentionally not in deps to avoid infinite loop
  // It's read directly from state inside the function

  const fetchSummary = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`/api/time-reporting/analyze?${params}`);
      if (response.ok) {
        const data = await response.json();
        setSummary(data);
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  }, [startDate, endDate]);

  // Read URL parameters once on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const workersParam = params.get('workers');
    if (workersParam) {
      const emails = workersParam.split(',').map(e => e.trim()).filter(Boolean);
      setSelectedWorkerEmails(emails);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Don't fetch flags automatically - only after running analysis
  // Flags will be fetched after runAnalysis completes

  const runAnalysis = async () => {
    if (!startDate || !endDate) {
      setMessage({ type: 'error', text: 'Please select date range' });
      return;
    }

    setAnalyzing(true);
    setMessage(null);

    try {
      const payload: any = { startDate, endDate, forceReanalyze };

      // Include selected workers if filtering from screening page
      if (selectedWorkerEmails.length > 0) {
        payload.workerEmails = selectedWorkerEmails;
      }

      const response = await fetch('/api/time-reporting/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        const uniqueWorkers = new Set(data.results.filter((r: any) => r.shouldFlag).map((r: any) => r.workerEmail));
        const cacheMessage = data.usedCache ? ' (using existing analysis)' : '';
        setMessage({
          type: 'success',
          text: `Analysis complete! Analyzed ${data.analyzed} reports, flagged ${uniqueWorkers.size} worker${uniqueWorkers.size !== 1 ? 's' : ''}${cacheMessage}`,
        });
        fetchFlags();
        // Only fetch full summary if no workers are selected (otherwise calculate from filtered flags)
        if (selectedWorkerEmails.length === 0) {
          fetchSummary();
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'Analysis failed' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Network error' });
    } finally {
      setAnalyzing(false);
    }
  };

  const openNotesModal = (flagId: string, status: string, actionLabel: string) => {
    setNotesModalData({ flagId, status, actionLabel });
    setResolutionNotes('');
    setShowNotesModal(true);
  };

  const closeNotesModal = () => {
    setShowNotesModal(false);
    setNotesModalData(null);
    setResolutionNotes('');
  };

  const submitFlagUpdate = async () => {
    if (!notesModalData) return;

    await updateFlagStatus(notesModalData.flagId, notesModalData.status, resolutionNotes);
    closeNotesModal();
  };

  const updateFlagStatus = async (flagId: string, status: string, notes?: string) => {
    try {
      const response = await fetch('/api/time-reporting/flags', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flagId, status, resolutionNotes: notes || null }),
      });

      const data = await response.json();

      if (response.ok) {
        // Success - show message and refresh the flags list
        const statusLabels: Record<string, string> = {
          UNDER_REVIEW: 'marked for review',
          RESOLVED: 'resolved',
          DISMISSED: 'dismissed',
        };
        const statusLabel = statusLabels[status] || 'updated';

        setMessage({
          type: 'success',
          text: `Flag ${statusLabel} successfully`,
        });

        fetchFlags();

        // If worker details modal is open, refresh it to show updated flag status
        if (selectedWorker) {
          viewWorkerDetails(selectedWorker);
        }

        // Clear message after 3 seconds
        setTimeout(() => setMessage(null), 3000);
      } else {
        // Error - show message with details
        const errorMessage = response.status === 404
          ? 'Flag not found. It may have been deleted.'
          : `Failed to update flag: ${data.error || 'Unknown error'}`;

        setMessage({
          type: 'error',
          text: errorMessage,
        });

        // Refresh flags list to show current state
        fetchFlags();
      }
    } catch (error) {
      console.error('Error updating flag:', error);
      alert('Network error: Failed to update flag. Please check your connection and try again.');
    }
  };

  const viewWorkerDetails = async (workerEmail: string) => {
    // Clear previous worker details before fetching new ones
    setWorkerDetails(null);
    setSelectedWorker(workerEmail);
    setLoadingDetails(true);

    try {
      const params = new URLSearchParams();
      params.append('workerEmail', workerEmail);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      params.append('_t', Date.now().toString()); // Cache busting

      const response = await fetch(`/api/time-reporting/worker-details?${params}`, {
        cache: 'no-store',
      });
      if (response.ok) {
        const data = await response.json();
        setWorkerDetails(data);
      } else {
        console.error('Failed to fetch worker details:', response.status);
        setWorkerDetails(null);
      }
    } catch (error) {
      console.error('Error fetching worker details:', error);
      setWorkerDetails(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeModal = () => {
    setSelectedWorker(null);
    setWorkerDetails(null);
  };

  // Aggregate flags by worker (one row per worker)
  const aggregatedWorkers = flags.reduce((acc, flag) => {
    const existing = acc.find(w => w.workerEmail === flag.workerEmail);

    if (existing) {
      existing.flagCount++;
      existing.flags.push(flag);

      // Track worst severity
      const severityOrder: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      if ((severityOrder[flag.severity] || 0) > (severityOrder[existing.worstSeverity] || 0)) {
        existing.worstSeverity = flag.severity;
      }

      // Track earliest and latest dates
      const flagDate = new Date(flag.workDate);
      if (flagDate < new Date(existing.earliestDate)) {
        existing.earliestDate = flag.workDate;
      }
      if (flagDate > new Date(existing.latestDate)) {
        existing.latestDate = flag.workDate;
      }

      // Count by status
      existing.statusCounts[flag.status] = (existing.statusCounts[flag.status] || 0) + 1;
    } else {
      acc.push({
        workerName: flag.workerName,
        workerEmail: flag.workerEmail,
        flagCount: 1,
        worstSeverity: flag.severity,
        earliestDate: flag.workDate,
        latestDate: flag.workDate,
        flags: [flag],
        statusCounts: { [flag.status]: 1 },
      });
    }

    return acc;
  }, [] as Array<{
    workerName: string;
    workerEmail: string;
    flagCount: number;
    worstSeverity: string;
    earliestDate: string;
    latestDate: string;
    flags: Flag[];
    statusCounts: Record<string, number>;
  }>);

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-main)',
        color: 'var(--text-primary)',
        padding: '40px',
      }}
    >

      <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
        <div style={{ marginBottom: '40px' }}>
          <h1
            style={{
              fontSize: '32px',
              fontWeight: 600,
              marginBottom: '8px',
              background: 'linear-gradient(135deg, var(--accent) 0%, #00d4ff 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Time Reporting - Deep Analysis
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>
            Comprehensive LLM-based analysis of time reports with quality scoring and meeting verification.{' '}
            <a href="/time-reporting-screening" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
              ← Back to Quick Screening
            </a>
          </p>
        </div>

        {/* Info banner for filtered workers */}
        {selectedWorkerEmails.length > 0 && (
          <div
            className="glass-card"
            style={{
              padding: '16px',
              marginBottom: '24px',
              backgroundColor: 'var(--accent)22',
              border: '1px solid var(--accent)44',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '20px' }}>ℹ️</span>
              <div>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                  Analyzing {selectedWorkerEmails.length} selected worker{selectedWorkerEmails.length !== 1 ? 's' : ''}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Deep analysis will run on workers selected from Quick Screening.{' '}
                  <button
                    onClick={() => {
                      setSelectedWorkerEmails([]);
                      window.history.replaceState({}, '', '/time-reporting-analysis');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent)',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Clear filter
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {summary && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '20px', marginBottom: '32px' }}>
            <div className="glass-card" style={{ padding: '24px' }}>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Total Reports
              </div>
              <div style={{ fontSize: '32px', fontWeight: 600 }}>{summary.totalReports}</div>
            </div>

            <div className="glass-card" style={{ padding: '24px' }}>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Total Flags
              </div>
              <div style={{ fontSize: '32px', fontWeight: 600, color: summary.totalFlags > 0 ? '#ff6600' : 'inherit' }}>
                {summary.totalFlags}
              </div>
            </div>

            <div className="glass-card" style={{ padding: '24px' }}>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Avg Discrepancy
              </div>
              <div style={{ fontSize: '32px', fontWeight: 600 }}>
                {Number(summary.averageDiscrepancy).toFixed(1)}%
              </div>
            </div>

            <div className="glass-card" style={{ padding: '24px' }}>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Avg Quality
              </div>
              <div style={{ fontSize: '32px', fontWeight: 600 }}>
                {Number(summary.averageQuality).toFixed(1)}/10
              </div>
            </div>

            <div className="glass-card" style={{ padding: '24px' }}>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Critical
              </div>
              <div style={{ fontSize: '32px', fontWeight: 600, color: SEVERITY_COLORS.CRITICAL }}>
                {summary.flagsBySeverity.CRITICAL || 0}
              </div>
            </div>
          </div>
        )}

        <div className="glass-card" style={{ padding: '32px', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '24px' }}>Run Analysis</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '16px', alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontWeight: 500 }}>
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
                    padding: '12px 12px 12px 36px',
                    backgroundColor: 'rgba(var(--accent-rgb), 0.05)',
                    border: '2px solid var(--accent)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontWeight: 500 }}>
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
                    padding: '12px 12px 12px 36px',
                    backgroundColor: 'rgba(var(--accent-rgb), 0.05)',
                    border: '2px solid var(--accent)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={runAnalysis}
                disabled={analyzing}
                className="btn-primary"
                style={{ width: '100%', padding: '12px' }}
              >
                {analyzing ? 'Analyzing...' : '▶ Run Analysis'}
              </button>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={forceReanalyze}
                  onChange={(e) => setForceReanalyze(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                Force re-analysis
              </label>
            </div>

            <div>
              <button
                onClick={fetchFlags}
                disabled={loading}
                className="btn-primary"
                style={{
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'rgba(var(--accent-rgb), 0.15)',
                  borderColor: 'var(--accent)',
                  color: 'var(--accent)',
                  opacity: loading ? 0.5 : 1,
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>

            <div>
              <button
                onClick={() => {
                  setFlags([]);
                  setSummary(null);
                  setMessage({ type: 'success', text: 'Results cleared' });
                  setTimeout(() => setMessage(null), 2000);
                }}
                className="btn-primary"
                style={{
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  borderColor: 'rgb(239, 68, 68)',
                  color: 'rgb(239, 68, 68)'
                }}
              >
                <X className="w-4 h-4" />
                Clear Results
              </button>
            </div>
          </div>

          {message && (
            <div
              style={{
                marginTop: '16px',
                padding: '12px',
                borderRadius: '6px',
                backgroundColor: message.type === 'success' ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 77, 77, 0.1)',
                border: `1px solid ${message.type === 'success' ? '#00ff88' : '#ff4d4d'}`,
                color: message.type === 'success' ? '#00ff88' : '#ff4d4d',
              }}
            >
              {message.text}
            </div>
          )}
        </div>

        <div className="glass-card" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600 }}>Flagged Workers</h2>

            <div style={{ display: 'flex', gap: '12px' }}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="all">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="RESOLVED">Resolved</option>
                <option value="DISMISSED">Dismissed</option>
              </select>

              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="all">All Severity</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          </div>

          {loading ? (
            <p style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
              Loading flags...
            </p>
          ) : flags.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
              {selectedWorkerEmails.length > 0
                ? `Click "▶ Run Analysis" to analyze the ${selectedWorkerEmails.length} selected worker${selectedWorkerEmails.length !== 1 ? 's' : ''}.`
                : 'No flags found. Run analysis to identify discrepancies.'}
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-primary)', textAlign: 'left' }}>
                    <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Worker</th>
                    <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Total Flags</th>
                    <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Worst Severity</th>
                    <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Date Range</th>
                    <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Status Summary</th>
                    <th
                      style={{
                        padding: '12px',
                        color: 'var(--text-secondary)',
                        position: 'sticky',
                        right: 0,
                        backgroundColor: 'var(--bg-primary)',
                        boxShadow: '-4px 0 8px rgba(0, 0, 0, 0.3)',
                      }}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {aggregatedWorkers.map((worker) => (
                    <tr key={worker.workerEmail} style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: 600 }}>{worker.workerName}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>{worker.workerEmail}</div>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--accent)' }}>
                          {worker.flagCount}
                        </div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '13px',
                            fontWeight: 600,
                            backgroundColor: `${SEVERITY_COLORS[worker.worstSeverity as keyof typeof SEVERITY_COLORS]}22`,
                            color: SEVERITY_COLORS[worker.worstSeverity as keyof typeof SEVERITY_COLORS],
                          }}
                        >
                          {worker.worstSeverity}
                        </span>
                      </td>
                      <td style={{ padding: '12px', fontSize: '13px' }}>
                        <div>{new Date(worker.earliestDate).toLocaleDateString()}</div>
                        {worker.earliestDate !== worker.latestDate && (
                          <div style={{ color: 'var(--text-tertiary)' }}>
                            to {new Date(worker.latestDate).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px', fontSize: '13px' }}>
                        {Object.entries(worker.statusCounts).map(([status, count]) => (
                          <div key={status} style={{ marginBottom: '4px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>
                              {status.replace('_', ' ')}:
                            </span>{' '}
                            <span style={{ fontWeight: 600 }}>{count}</span>
                          </div>
                        ))}
                      </td>
                      <td
                        style={{
                          padding: '12px',
                          position: 'sticky',
                          right: 0,
                          backgroundColor: 'var(--bg-primary)',
                          boxShadow: '-4px 0 8px rgba(0, 0, 0, 0.3)',
                        }}
                      >
                        <button
                          onClick={() => viewWorkerDetails(worker.workerEmail)}
                          className="btn-primary"
                          style={{
                            padding: '6px 12px',
                            fontSize: '13px',
                            fontWeight: 600,
                            whiteSpace: 'nowrap'
                          }}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Worker Detail Modal */}
        {selectedWorker && (
          <div
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
              padding: '40px',
            }}
            onClick={closeModal}
          >
            <div
              className="glass-card"
              style={{
                width: '100%',
                maxWidth: '1200px',
                maxHeight: '90vh',
                overflow: 'auto',
                padding: '32px',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 600 }}>Worker Details</h2>
                <button onClick={closeModal} className="btn-secondary" style={{ padding: '8px 16px' }}>
                  ✕ Close
                </button>
              </div>

              {loadingDetails ? (
                <p style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                  Loading worker details...
                </p>
              ) : workerDetails ? (
                <>
                  {/* Worker Summary */}
                  <div style={{ marginBottom: '32px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
                      {workerDetails.workerName}
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
                      {workerDetails.workerEmail}
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                      <div className="glass-card" style={{ padding: '16px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          Total Reports
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: 600 }}>
                          {workerDetails.summary.totalReports}
                        </div>
                      </div>

                      <div className="glass-card" style={{ padding: '16px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          Hours Worked
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: 600 }}>
                          {Number(workerDetails.summary.totalHoursWorked).toFixed(1)}h
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                          Est: {Number(workerDetails.summary.totalEstimatedHours).toFixed(1)}h
                        </div>
                      </div>

                      <div className="glass-card" style={{ padding: '16px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          Avg Quality
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: 600 }}>
                          {Number(workerDetails.summary.averageQualityScore).toFixed(1)}/10
                        </div>
                      </div>

                      <div className="glass-card" style={{ padding: '16px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          Total Flags
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: 600, color: workerDetails.summary.totalFlags > 0 ? '#ff6600' : 'inherit' }}>
                          {workerDetails.summary.totalFlags}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Meeting Summary */}
                  <div style={{ marginBottom: '32px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Meeting Summary</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                      <div className="glass-card" style={{ padding: '16px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          Claimed Hours
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: 600 }}>
                          {Number(workerDetails.summary.totalMeetingHoursClaimed).toFixed(1)}h
                        </div>
                      </div>

                      <div className="glass-card" style={{ padding: '16px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          Verified Hours
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: 600, color: '#00ff88' }}>
                          {Number(workerDetails.summary.totalMeetingHoursVerified).toFixed(1)}h
                        </div>
                      </div>

                      <div className="glass-card" style={{ padding: '16px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          Verification Rate
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: 600 }}>
                          {workerDetails.summary.totalMeetingHoursClaimed > 0
                            ? ((workerDetails.summary.totalMeetingHoursVerified / workerDetails.summary.totalMeetingHoursClaimed) * 100).toFixed(0)
                            : 0}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Flag Summary */}
                  {workerDetails.summary.totalFlags > 0 && (
                    <div style={{ marginBottom: '32px' }}>
                      <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Flag Summary</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                        {Object.entries(workerDetails.summary.flagsBySeverity).map(([severity, count]) => (
                          <div key={severity} className="glass-card" style={{ padding: '16px' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                              {severity}
                            </div>
                            <div
                              style={{
                                fontSize: '20px',
                                fontWeight: 600,
                                color: SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS],
                              }}
                            >
                              {count}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Time Reports Table */}
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Time Reports</h3>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-primary)', textAlign: 'left' }}>
                            <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Date</th>
                            <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Hours</th>
                            <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Estimated</th>
                            <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Meetings</th>
                            <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Quality</th>
                            <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Flags</th>
                          </tr>
                        </thead>
                        <tbody>
                          {workerDetails.timeReports.map((report) => (
                            <tr key={report.id} style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                              <td style={{ padding: '12px' }}>
                                {new Date(report.workDate).toLocaleDateString()}
                              </td>
                              <td style={{ padding: '12px', fontFamily: 'monospace' }}>
                                {Number(report.hoursWorked).toFixed(1)}h
                              </td>
                              <td style={{ padding: '12px', fontFamily: 'monospace' }}>
                                {Number(report.estimatedHours).toFixed(1)}h
                              </td>
                              <td style={{ padding: '12px', fontFamily: 'monospace' }}>
                                <div>{Number(report.meetingHoursClaimed).toFixed(1)}h claimed</div>
                                <div style={{ fontSize: '11px', color: '#00ff88' }}>
                                  {Number(report.meetingHoursVerified).toFixed(1)}h verified
                                </div>
                              </td>
                              <td style={{ padding: '12px', fontFamily: 'monospace' }}>
                                {report.averageQualityScore > 0 ? Number(report.averageQualityScore).toFixed(1) : 'N/A'}/10
                              </td>
                              <td style={{ padding: '12px' }}>
                                {report.flags.length > 0 ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {report.flags.map((flag: any) => (
                                      <div
                                        key={flag.id}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '8px',
                                        }}
                                      >
                                        <span
                                          style={{
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            backgroundColor: `${SEVERITY_COLORS[flag.severity as keyof typeof SEVERITY_COLORS]}22`,
                                            color: SEVERITY_COLORS[flag.severity as keyof typeof SEVERITY_COLORS],
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          {flag.severity}
                                        </span>
                                        <span
                                          style={{
                                            padding: '2px 6px',
                                            borderRadius: '3px',
                                            fontSize: '10px',
                                            fontWeight: 500,
                                            backgroundColor: 'var(--bg-secondary)',
                                            color: 'var(--text-secondary)',
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          {flag.status.replace('_', ' ')}
                                        </span>
                                        {flag.status !== 'RESOLVED' && flag.status !== 'DISMISSED' && (
                                          <button
                                            onClick={() => openNotesModal(flag.id, 'RESOLVED', 'Review')}
                                            style={{
                                              padding: '4px 10px',
                                              fontSize: '11px',
                                              fontWeight: 600,
                                              borderRadius: '4px',
                                              border: 'none',
                                              backgroundColor: '#00ff88',
                                              color: '#000',
                                              cursor: 'pointer',
                                              whiteSpace: 'nowrap',
                                            }}
                                            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#33ffaa')}
                                            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#00ff88')}
                                          >
                                            ✅ Review
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>None</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* Notes Modal */}
      {showNotesModal && notesModalData && (
        <div
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
            zIndex: 2000,
            padding: '20px',
          }}
          onClick={closeNotesModal}
        >
          <div
            className="glass-card"
            style={{
              maxWidth: '600px',
              width: '100%',
              padding: '32px',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>
              Review & Resolve Flag
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
              Add notes about your review and mark this flag as resolved
            </p>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>
                Review Notes (Optional)
              </label>
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Record your review notes (optional): What did you find? What action was taken? Any patterns or concerns?"
                rows={6}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-primary)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={closeNotesModal} className="btn-secondary">
                Cancel
              </button>
              <button onClick={submitFlagUpdate} className="btn-primary">
                ✅ Mark as Resolved
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
