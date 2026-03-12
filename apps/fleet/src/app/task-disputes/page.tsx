'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface Dispute {
  id: string;
  externalId: number;
  createdAtSource: string;
  feedbackId: number;
  evalTaskId: string | null;
  disputeStatus: string;
  disputeReason: string | null;
  resolutionReason: string | null;
  resolvedAt: string | null;
  reportText: string | null;
  isHelpful: boolean | null;
  disputerName: string | null;
  disputerEmail: string | null;
  resolverName: string | null;
  teamName: string | null;
  taskKey: string;
  taskLifecycleStatus: string | null;
  envKey: string | null;
  envDataKey: string | null;
  taskModality: string | null;
  disputeData: { category?: string } | null;
  dataRecord: {
    id: string;
    environment: string;
    createdByEmail: string | null;
    createdByName: string | null;
  } | null;
}

interface Stats {
  byStatus: Record<string, number>;
  byEnv: { env: string; count: number }[];
  byModality: Record<string, number>;
  totalMatched: number;
  totalUnmatched: number;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  approved: { label: 'Approved', bg: 'rgba(16,185,129,0.15)', color: '#34d399', dot: '#34d399' },
  rejected:  { label: 'Rejected',  bg: 'rgba(239,68,68,0.15)',  color: '#f87171', dot: '#f87171' },
  pending:   { label: 'Pending',   bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', dot: '#fbbf24' },
  discarded: { label: 'Discarded', bg: 'rgba(113,113,122,0.2)', color: '#a1a1aa', dot: '#a1a1aa' },
};

const STAT_BORDER_COLORS: Record<string, string> = {
  approved: '#10b981',
  rejected: '#ef4444',
  pending: '#f59e0b',
  discarded: '#71717a',
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status];
  if (!cfg) return <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', textTransform: 'capitalize' }}>{status}</span>;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '2px 8px', fontSize: '12px', borderRadius: '6px', fontWeight: 500,
      background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.dot}40`,
    }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

export default function TaskDisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [envFilter, setEnvFilter] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [modalityFilter, setModalityFilter] = useState('');
  const [matchedFilter, setMatchedFilter] = useState('');
  const [taskKeyFilter, setTaskKeyFilter] = useState('');

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const LIMIT = 25;

  const fetchDisputes = useCallback(async (p: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (statusFilter) params.set('status', statusFilter);
      if (envFilter) params.set('env', envFilter);
      if (emailFilter) params.set('email', emailFilter);
      if (modalityFilter) params.set('modality', modalityFilter);
      if (matchedFilter) params.set('matched', matchedFilter);
      if (taskKeyFilter) params.set('taskKey', taskKeyFilter);

      const res = await fetch(`/api/task-disputes?${params}`);
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load');
      const data = await res.json();
      setDisputes(data.disputes);
      setTotal(data.total);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, envFilter, emailFilter, modalityFilter, matchedFilter, taskKeyFilter]);

  useEffect(() => {
    setPage(1);
    fetchDisputes(1);
  }, [fetchDisputes]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchDisputes(newPage);
  };

  const clearFilters = () => {
    setStatusFilter('');
    setEnvFilter('');
    setEmailFilter('');
    setModalityFilter('');
    setMatchedFilter('');
    setTaskKeyFilter('');
  };

  const hasFilters = statusFilter || envFilter || emailFilter || modalityFilter || matchedFilter || taskKeyFilter;
  const totalPages = Math.ceil(total / LIMIT);
  const grandTotal = stats ? stats.totalMatched + stats.totalUnmatched : 0;
  const matchPct = grandTotal > 0 ? Math.round((stats!.totalMatched / grandTotal) * 100) : 0;

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Task Disputes</h1>
        <p className="text-[var(--text-secondary)] text-sm mt-1">
          Review and track feedback disputes matched against data records
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(stats.byStatus).map(([status, count]) => (
            <button
              key={status}
              onClick={() => setStatusFilter(statusFilter === status ? '' : status)}
              style={{
                background: statusFilter === status ? 'rgba(0, 112, 243, 0.12)' : 'rgba(255,255,255,0.06)',
                borderTop: `1px solid ${statusFilter === status ? 'rgba(0,112,243,0.5)' : 'rgba(255,255,255,0.15)'}`,
                borderRight: `1px solid ${statusFilter === status ? 'rgba(0,112,243,0.5)' : 'rgba(255,255,255,0.15)'}`,
                borderBottom: `1px solid ${statusFilter === status ? 'rgba(0,112,243,0.5)' : 'rgba(255,255,255,0.15)'}`,
                borderLeft: `4px solid ${STAT_BORDER_COLORS[status] ?? '#71717a'}`,
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'left',
                transition: 'all 0.15s ease',
                cursor: 'pointer',
                color: 'inherit',
              }}
            >
              <div className="text-2xl font-bold tabular-nums">{count}</div>
              <div className="mt-1">
                <StatusBadge status={status} />
              </div>
            </button>
          ))}
          <div style={{
            background: 'rgba(255,255,255,0.06)',
            borderTop: '1px solid rgba(255,255,255,0.15)',
            borderRight: '1px solid rgba(255,255,255,0.15)',
            borderBottom: '1px solid rgba(255,255,255,0.15)',
            borderLeft: '4px solid #60a5fa',
            borderRadius: '12px',
            padding: '16px',
          }}>
            <div className="text-2xl font-bold tabular-nums">{stats.totalMatched}</div>
            <div className="text-xs text-[var(--text-secondary)] mt-1.5 font-medium">
              Matched <span style={{ color: '#60a5fa', fontWeight: 600 }}>{matchPct}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="glass-card" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'end' }}>
          {/* Email */}
          <div className="flex flex-col gap-1" style={{ width: '200px' }}>
            <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Email</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
              <input
                type="text"
                placeholder="Filter by email"
                value={emailFilter}
                onChange={e => setEmailFilter(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
              />
              {emailFilter && (
                <button onClick={() => setEmailFilter('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="w-3 h-3 text-[var(--text-secondary)]" />
                </button>
              )}
            </div>
          </div>

          {/* Task Key */}
          <div className="flex flex-col gap-1" style={{ width: '220px' }}>
            <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Task Key</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
              <input
                type="text"
                placeholder="Filter by task key"
                value={taskKeyFilter}
                onChange={e => setTaskKeyFilter(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
              />
              {taskKeyFilter && (
                <button onClick={() => setTaskKeyFilter('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="w-3 h-3 text-[var(--text-secondary)]" />
                </button>
              )}
            </div>
          </div>

          {/* Environment */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Environment</label>
            <select
              value={envFilter}
              onChange={e => setEnvFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
            >
              <option value="">All environments</option>
              {stats?.byEnv.map(e => (
                <option key={e.env} value={e.env}>{e.env} ({e.count})</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Status</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="discarded">Discarded</option>
            </select>
          </div>

          {/* Modality */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Modality</label>
            <select
              value={modalityFilter}
              onChange={e => setModalityFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
            >
              <option value="">All modalities</option>
              <option value="computer_use">Computer Use</option>
              <option value="tool_use">Tool Use</option>
            </select>
          </div>

          {/* Record match */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Match</label>
            <select
              value={matchedFilter}
              onChange={e => setMatchedFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
            >
              <option value="">All</option>
              <option value="true">Matched</option>
              <option value="false">Unmatched</option>
            </select>
          </div>

          {/* Clear */}
          {hasFilters ? (
            <button
              onClick={clearFilters}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 12px', fontSize: '13px', fontWeight: 500,
                borderRadius: '8px', cursor: 'pointer',
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.35)',
                color: '#f87171',
                transition: 'background 0.15s',
              }}
            >
              <X style={{ width: '13px', height: '13px' }} />
              Clear
            </button>
          ) : <div />}
        </div>
      </div>

      {/* Table */}
      <div style={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.12)', overflow: 'hidden', background: 'rgba(255,255,255,0.03)' }}>
        {/* Table header row with result count */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)' }}>
          <span className="text-sm font-medium text-[var(--text-secondary)]">
            {isLoading ? 'Loading…' : `${total.toLocaleString()} dispute${total !== 1 ? 's' : ''}`}
            {hasFilters && <span className="ml-1 text-[var(--accent)]">(filtered)</span>}
          </span>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 text-sm" style={{ background: 'rgba(239,68,68,0.1)', borderBottom: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {disputes.length === 0 && !isLoading && !error && (
          <div className="p-12 text-center text-[var(--text-secondary)]">
            {total === 0
              ? 'No disputes imported yet. Navigate to Task Disputes Import in the Admin app to load data.'
              : 'No disputes match the current filters.'}
          </div>
        )}

        {(disputes.length > 0 || isLoading) && (
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '64px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '200px' }} />
              <col style={{ width: '140px' }} />
              <col />
              <col style={{ width: '110px' }} />
              <col style={{ width: '90px' }} />
              <col style={{ width: '96px' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)' }}>
                {(['ID','Status','Disputer','Environment','Task Key','Modality','Match','Date'] as const).map((label, i) => (
                  <th
                    key={label}
                    style={{
                      textAlign: 'left',
                      padding: '10px 16px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'rgba(255,255,255,0.5)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      borderRight: i < 7 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: i % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} style={{ padding: '12px 16px', borderRight: j < 7 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                          <div className="h-3.5 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.1)', width: `${50 + (j * 17) % 50}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                : disputes.map((d, idx) => (
                    <React.Fragment key={d.id}>
                      <tr
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.08)',
                          background: expandedId === d.id
                            ? 'rgba(0,112,243,0.08)'
                            : idx % 2 === 1 ? 'rgba(255,255,255,0.025)' : 'transparent',
                          cursor: 'pointer',
                          transition: 'background 0.1s ease',
                        }}
                        onMouseEnter={e => { if (expandedId !== d.id) (e.currentTarget as HTMLElement).style.background = 'rgba(0,112,243,0.05)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = expandedId === d.id ? 'rgba(0,112,243,0.08)' : idx % 2 === 1 ? 'rgba(255,255,255,0.025)' : 'transparent'; }}
                        onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}
                      >
                        <td style={{ padding: '12px 16px', borderRight: '1px solid rgba(255,255,255,0.06)', fontFamily: 'monospace', fontSize: '12px', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>
                          #{d.externalId}
                        </td>
                        <td style={{ padding: '12px 16px', borderRight: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>
                          <StatusBadge status={d.disputeStatus} />
                        </td>
                        <td style={{ padding: '12px 16px', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ fontWeight: 500, fontSize: '13px', lineHeight: 1.3 }}>{d.disputerName || <span style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>}</div>
                          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{d.disputerEmail || ''}</div>
                        </td>
                        <td style={{ padding: '12px 16px', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 500 }}>{d.envKey || <span style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>}</div>
                          {d.envDataKey && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{d.envDataKey}</div>}
                        </td>
                        <td style={{ padding: '12px 16px', borderRight: '1px solid rgba(255,255,255,0.06)', maxWidth: 0, overflow: 'hidden' }}>
                          <div style={{ fontFamily: 'monospace', fontSize: '12px', color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.taskKey}>
                            {d.taskKey}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', borderRight: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', textTransform: 'capitalize' }}>
                            {d.taskModality?.replace('_', ' ') || '—'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', borderRight: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>
                          {d.dataRecord ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#34d399', fontWeight: 500 }}>
                              <CheckCircle2 style={{ width: '14px', height: '14px' }} />
                              Matched
                            </span>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                              {new Date(d.createdAtSource).toLocaleDateString()}
                            </span>
                            <span style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
                              {expandedId === d.id ? <ChevronUp style={{ width: '14px', height: '14px' }} /> : <ChevronDown style={{ width: '14px', height: '14px' }} />}
                            </span>
                          </div>
                        </td>
                      </tr>

                      {expandedId === d.id && (
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,112,243,0.04)' }}>
                          <td colSpan={8} style={{ padding: '20px 24px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px' }}>

                              {/* Left: dispute detail */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.4)' }}>Dispute Details</div>

                                {d.disputeReason && (
                                  <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Reason</div>
                                    <div style={{ fontSize: '13px', lineHeight: 1.6, color: 'rgba(255,255,255,0.85)' }}>{d.disputeReason}</div>
                                  </div>
                                )}
                                {d.resolutionReason && (
                                  <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Resolution</div>
                                    <div style={{ fontSize: '13px', lineHeight: 1.6, color: 'rgba(255,255,255,0.85)' }}>{d.resolutionReason}</div>
                                  </div>
                                )}
                                {d.reportText && (
                                  <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Report</div>
                                    <div style={{ fontSize: '13px', lineHeight: 1.6, color: 'rgba(255,255,255,0.85)', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{d.reportText}</div>
                                  </div>
                                )}

                                {/* Metadata chips */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                  {d.teamName && (
                                    <div style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>Team </span>
                                      <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{d.teamName}</span>
                                    </div>
                                  )}
                                  {d.disputeData?.category && (
                                    <div style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', textTransform: 'capitalize' }}>
                                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>Category </span>
                                      <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{d.disputeData.category.replace('_', ' ')}</span>
                                    </div>
                                  )}
                                  {d.isHelpful !== null && (
                                    <div style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>Helpful </span>
                                      <span style={{ color: d.isHelpful ? '#34d399' : '#f87171', fontWeight: 500 }}>{d.isHelpful ? 'Yes' : 'No'}</span>
                                    </div>
                                  )}
                                  {d.resolverName && (
                                    <div style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>Resolved by </span>
                                      <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{d.resolverName}</span>
                                      {d.resolvedAt && <span style={{ color: 'rgba(255,255,255,0.4)' }}> · {new Date(d.resolvedAt).toLocaleDateString()}</span>}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Right: linked record */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.4)' }}>Linked Record</div>
                                {d.dataRecord ? (
                                  <div style={{ padding: '14px', borderRadius: '8px', background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.25)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#34d399', fontWeight: 600 }}>
                                      <CheckCircle2 style={{ width: '14px', height: '14px', flexShrink: 0 }} />
                                      Record matched
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                      {[
                                        { label: 'Record ID', value: d.dataRecord.id, mono: true },
                                        { label: 'Environment', value: d.dataRecord.environment, mono: true },
                                        ...(d.dataRecord.createdByName ? [{ label: 'Creator', value: d.dataRecord.createdByName, mono: false }] : []),
                                      ].map(({ label, value, mono }) => (
                                        <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>{label}</span>
                                          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)', fontFamily: mono ? 'monospace' : undefined, wordBreak: 'break-all' }}>{value}</span>
                                        </div>
                                      ))}
                                    </div>
                                    {d.dataRecord.createdByEmail && (
                                      <a
                                        href={`/workforce-monitoring/worker/${encodeURIComponent(d.dataRecord.createdByEmail)}`}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#60a5fa', fontWeight: 500, textDecoration: 'none' }}
                                        onClick={e => e.stopPropagation()}
                                      >
                                        View worker profile
                                        <ExternalLink style={{ width: '11px', height: '11px' }} />
                                      </a>
                                    )}
                                  </div>
                                ) : (
                                  <div style={{ padding: '14px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>No matching record found</div>
                                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>task_key: {d.taskKey}</div>
                                  </div>
                                )}
                              </div>

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
            Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total.toLocaleString()}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              disabled={page === 1}
              onClick={() => handlePageChange(page - 1)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
                border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)',
                color: page === 1 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.85)',
                cursor: page === 1 ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
              <ChevronLeft style={{ width: '15px', height: '15px' }} />
              Prev
            </button>
            <span style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, background: 'rgba(0,112,243,0.2)', border: '1px solid rgba(0,112,243,0.4)', color: 'rgba(255,255,255,0.9)', tabularNums: true } as React.CSSProperties}>
              {page} / {totalPages}
            </span>
            <button
              disabled={page === totalPages}
              onClick={() => handlePageChange(page + 1)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
                border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)',
                color: page === totalPages ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.85)',
                cursor: page === totalPages ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
              Next
              <ChevronRight style={{ width: '15px', height: '15px' }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
