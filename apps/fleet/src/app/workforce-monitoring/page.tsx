'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Loader2, ShieldAlert, AlertTriangle, Search, RefreshCw, Flag, ChevronLeft, ChevronRight } from 'lucide-react';

interface Worker {
  email: string;
  name: string | null;
  taskCount: number;
  feedbackCount: number;
  activeFlags: number;
  lastActivity: string | null;
}

const PAGE_SIZE = 50;

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

type SortCol = 'lastActivity' | 'taskCount' | 'feedbackCount' | 'activeFlags';
type FlagFilter = 'all' | 'flagged' | 'unflagged';

export default function WorkforceMonitoringPage() {
  const router = useRouter();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [environment, setEnvironment] = useState('');
  const [environments, setEnvironments] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortCol | null>(null); // null = server default (flagged first, then last name)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [flagFilter, setFlagFilter] = useState<FlagFilter>('all');

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch('/api/environments')
      .then(r => r.ok ? r.json() : { environments: [] })
      .then(d => setEnvironments(d.environments ?? []));
  }, []);

  useEffect(() => {
    fetchWorkers(1);
  }, [environment, search, sortBy, sortDir, flagFilter]);

  // Debounce search input
  const handleSearchInput = (value: string) => {
    setSearchInput(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearch(value);
    }, 300);
  };

  const fetchWorkers = async (targetPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        limit: String(PAGE_SIZE),
        sortDir,
      });
      if (sortBy) params.set('sortBy', sortBy);
      if (environment) params.set('environment', environment);
      if (search) params.set('search', search);
      if (flagFilter !== 'all') params.set('flagged', flagFilter);

      const res = await fetch(`/api/workforce-monitoring?${params.toString()}`);

      if (res.status === 401) { router.push('/login'); return; }
      if (res.status === 403) { setAuthorized(false); setLoading(false); return; }
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(data.error || `Server error: ${res.status}`);
      }

      const data = await res.json();
      setWorkers(data.workers ?? []);
      setTotal(data.total ?? 0);
      setPage(targetPage);
      setAuthorized(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workers');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (col: SortCol) => {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  };

  const handleFlagFilter = (f: FlagFilter) => {
    setFlagFilter(f);
    // Reset to default sort when switching flag filter so flagged-first ordering applies
    if (f !== 'flagged') {
      setSortBy(null);
      setSortDir('desc');
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const SortIndicator = ({ col }: { col: SortCol }) => {
    if (sortBy !== col) return <span style={{ opacity: 0.3 }}> ↕</span>;
    return <span style={{ color: 'var(--accent)' }}>{sortDir === 'desc' ? ' ↓' : ' ↑'}</span>;
  };

  const flagFilterBtnStyle = (f: FlagFilter) => ({
    padding: '8px 14px',
    borderRadius: '8px',
    border: `1px solid ${flagFilter === f ? 'rgba(251,113,33,0.5)' : 'rgba(255,255,255,0.1)'}`,
    background: flagFilter === f ? 'rgba(251,113,33,0.15)' : 'rgba(255,255,255,0.05)',
    color: flagFilter === f ? 'rgba(251,191,36,0.9)' : 'rgba(255,255,255,0.6)',
    cursor: 'pointer' as const,
    fontSize: '0.875rem',
    fontWeight: flagFilter === f ? 600 : 400,
    whiteSpace: 'nowrap' as const,
  });

  if (!authorized && !loading && !error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', textAlign: 'center' }}>
        <div style={{ padding: '16px', background: 'rgba(255,77,77,0.1)', borderRadius: '16px', marginBottom: '24px' }}>
          <ShieldAlert size={64} color="#ff4d4d" />
        </div>
        <h1 style={{ fontSize: '2rem', marginBottom: '16px' }}>Access Denied</h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '24px' }}>
          Workforce Monitoring is only accessible to Fleet users and above.
        </p>
        <button onClick={() => router.push('/')} className="btn-primary" style={{ padding: '12px 32px' }}>
          Return to Dashboard
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '48px' }}>
        <div style={{ padding: '24px', background: 'rgba(255,77,77,0.1)', borderRadius: '12px', marginBottom: '24px', maxWidth: '500px', margin: '0 auto' }}>
          <AlertTriangle size={48} color="#ff4d4d" style={{ marginBottom: '16px' }} />
          <p style={{ color: '#ff4d4d' }}>{error}</p>
        </div>
        <button onClick={() => fetchWorkers(1)} className="btn-primary" style={{ padding: '12px 32px', marginTop: '24px' }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', background: 'rgba(var(--accent-rgb),0.15)', borderRadius: '12px' }}>
            <Users size={28} color="var(--accent)" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>Workforce Monitoring</h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', margin: 0, fontSize: '0.875rem' }}>
              {loading ? 'Loading…' : `${total.toLocaleString()} worker${total !== 1 ? 's' : ''} · click a row to investigate`}
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchWorkers(page)}
          disabled={loading}
          style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '8px 16px', color: 'rgba(255,255,255,0.7)', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', opacity: loading ? 0.5 : 1 }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 260px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }} />
          <input
            type="text"
            placeholder="Search by name or email…"
            value={searchInput}
            onChange={e => handleSearchInput(e.target.value)}
            style={{ width: '100%', paddingLeft: '36px', paddingRight: '12px', paddingTop: '10px', paddingBottom: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', outline: 'none', fontSize: '0.875rem', boxSizing: 'border-box' }}
          />
        </div>
        <select
          value={environment}
          onChange={e => setEnvironment(e.target.value)}
          style={{ flex: '0 0 auto', padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '0.875rem' }}
        >
          <option value="">All environments</option>
          {environments.map(env => (
            <option key={env} value={env}>{env}</option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', padding: '3px' }}>
          <button onClick={() => handleFlagFilter('all')} style={flagFilterBtnStyle('all')}>All</button>
          <button onClick={() => handleFlagFilter('flagged')} style={flagFilterBtnStyle('flagged')}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><Flag size={12} />Flagged</span>
          </button>
          <button onClick={() => handleFlagFilter('unflagged')} style={flagFilterBtnStyle('unflagged')}>Unflagged</button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
          <Loader2 className="animate-spin" size={36} color="var(--accent)" />
        </div>
      ) : workers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px', color: 'rgba(255,255,255,0.4)' }}>
          <Users size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
          <p>No workers found{search ? ` matching "${search}"` : ''}.</p>
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ textAlign: 'left', padding: '12px 16px', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Worker</th>
                  <th
                    style={{ textAlign: 'right', padding: '12px 16px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    onClick={() => handleSort('taskCount')}
                  >
                    Tasks<SortIndicator col="taskCount" />
                  </th>
                  <th
                    style={{ textAlign: 'right', padding: '12px 16px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    onClick={() => handleSort('feedbackCount')}
                  >
                    Feedback<SortIndicator col="feedbackCount" />
                  </th>
                  <th
                    style={{ textAlign: 'center', padding: '12px 16px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    onClick={() => handleSort('activeFlags')}
                  >
                    Active Flags<SortIndicator col="activeFlags" />
                  </th>
                  <th
                    style={{ textAlign: 'right', padding: '12px 16px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    onClick={() => handleSort('lastActivity')}
                  >
                    Last Activity<SortIndicator col="lastActivity" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {workers.map((worker, i) => (
                  <tr
                    key={worker.email}
                    onClick={() => router.push(`/workforce-monitoring/worker/${encodeURIComponent(worker.email)}`)}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      cursor: 'pointer',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                    onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)')}
                  >
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 500 }}>{worker.name ?? <span style={{ color: 'rgba(255,255,255,0.4)' }}>Unknown</span>}</div>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', marginTop: '2px' }}>{worker.email}</div>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {worker.taskCount.toLocaleString()}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {worker.feedbackCount.toLocaleString()}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      {worker.activeFlags > 0 ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: 'rgba(251,113,33,0.15)',
                          border: '1px solid rgba(251,113,33,0.3)',
                          borderRadius: '12px',
                          padding: '2px 10px',
                          fontSize: '0.8rem',
                          color: 'rgba(251,113,33,0.9)',
                          fontWeight: 600,
                        }}>
                          <Flag size={11} />
                          {worker.activeFlags}
                        </span>
                      ) : (
                        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.8rem' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatDate(worker.lastActivity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>
                Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}
              </span>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button
                  onClick={() => fetchWorkers(1)}
                  disabled={page === 1}
                  style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: page === 1 ? 'rgba(255,255,255,0.2)' : 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: '0.8rem' }}
                >
                  First
                </button>
                <button
                  onClick={() => fetchWorkers(page - 1)}
                  disabled={page === 1}
                  style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: page === 1 ? 'rgba(255,255,255,0.2)' : 'white', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
                >
                  <ChevronLeft size={14} />
                </button>
                <span style={{ padding: '6px 12px', fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)', minWidth: '80px', textAlign: 'center' }}>
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => fetchWorkers(page + 1)}
                  disabled={page === totalPages}
                  style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: page === totalPages ? 'rgba(255,255,255,0.2)' : 'white', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
                >
                  <ChevronRight size={14} />
                </button>
                <button
                  onClick={() => fetchWorkers(totalPages)}
                  disabled={page === totalPages}
                  style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: page === totalPages ? 'rgba(255,255,255,0.2)' : 'white', cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: '0.8rem' }}
                >
                  Last
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
