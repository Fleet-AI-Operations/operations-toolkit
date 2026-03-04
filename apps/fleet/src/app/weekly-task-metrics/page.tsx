'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, Loader2, ShieldAlert, RefreshCw, Copy, Check, ChevronDown } from 'lucide-react';

interface EnvironmentCount {
    environment: string;
    count: number;
}

interface WeeklyMetrics {
    uniqueTasksCreated: number;
    uniqueTasksCreatedByEnvironment: EnvironmentCount[];
    totalTasksApproved: number;
    totalTasksApprovedByEnvironment: EnvironmentCount[];
    totalRevisions: number;
    dateRange: { start: string; end: string };
}

function getDefaultDates() {
    const end = new Date();
    end.setDate(end.getDate() - 1);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
    };
}

function formatDate(dateStr: string) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
    });
}

export default function WeeklyTaskMetricsPage() {
    const router = useRouter();
    const defaults = getDefaultDates();
    const [metrics, setMetrics] = useState<WeeklyMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [startDate, setStartDate] = useState(defaults.start);
    const [endDate, setEndDate] = useState(defaults.end);
    const [copied, setCopied] = useState(false);
    const [environments, setEnvironments] = useState<string[]>([]);
    const [selectedEnvironments, setSelectedEnvironments] = useState<Set<string>>(new Set());
    const [envDropdownOpen, setEnvDropdownOpen] = useState(false);
    const envDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchData(defaults.start, defaults.end);
        fetch('/api/environments')
            .then(r => r.ok ? r.json() : { environments: [] })
            .then(d => setEnvironments(d.environments ?? []));
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (envDropdownRef.current && !envDropdownRef.current.contains(e.target as Node)) {
                setEnvDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const fetchData = async (start = startDate, end = endDate, envs = selectedEnvironments) => {
        setRefreshing(true);
        setError(null);
        try {
            const params = new URLSearchParams({ start, end });
            if (envs.size > 0) params.set('environments', [...envs].join(','));
            const res = await fetch(`/api/admin/weekly-task-metrics?${params}`);

            if (res.status === 403) {
                setAuthorized(false);
                setLoading(false);
                setRefreshing(false);
                return;
            }

            if (res.status === 401) {
                router.push('/auth/login');
                return;
            }

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(errorData.error || `Server error: ${res.status}`);
            }

            setMetrics(await res.json());
            setAuthorized(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load metrics.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleApply = () => {
        if (!startDate || !endDate) return;
        const s = new Date(startDate);
        const e = new Date(endDate);
        if (s > e) { alert('Start date must be before end date'); return; }
        fetchData(startDate, endDate, selectedEnvironments);
    };

    const toggleEnvironment = (env: string) => {
        setSelectedEnvironments(prev => {
            const next = new Set(prev);
            next.has(env) ? next.delete(env) : next.add(env);
            return next;
        });
    };

    const copyToClipboard = () => {
        if (!metrics) return;
        const { dateRange, uniqueTasksCreated, totalTasksApproved, totalRevisions,
            uniqueTasksCreatedByEnvironment, totalTasksApprovedByEnvironment } = metrics;

        const lines: string[] = [
            `📊 Weekly Task Metrics (${formatDate(dateRange.start)} – ${formatDate(dateRange.end)})`,
            '',
            `Unique tasks created: ${uniqueTasksCreated.toLocaleString()}`,
        ];

        if (uniqueTasksCreatedByEnvironment.length > 0) {
            uniqueTasksCreatedByEnvironment.forEach(e => {
                lines.push(`  • ${e.environment}: ${e.count.toLocaleString()}`);
            });
        }

        lines.push('');
        lines.push(`Tasks approved: ${totalTasksApproved.toLocaleString()}`);

        if (totalTasksApprovedByEnvironment.length > 0) {
            totalTasksApprovedByEnvironment.forEach(e => {
                lines.push(`  • ${e.environment}: ${e.count.toLocaleString()}`);
            });
        }

        lines.push('');
        lines.push(`Task revisions made: ${totalRevisions.toLocaleString()}`);

        navigator.clipboard.writeText(lines.join('\n')).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <Loader2 className="animate-spin" size={48} color="var(--accent)" />
            </div>
        );
    }

    if (!authorized) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', textAlign: 'center' }}>
                <div style={{ padding: '16px', background: 'rgba(255, 77, 77, 0.1)', borderRadius: '16px', marginBottom: '24px' }}>
                    <ShieldAlert size={64} color="#ff4d4d" />
                </div>
                <h1 style={{ fontSize: '2rem', marginBottom: '16px' }}>Access Denied</h1>
                <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '24px' }}>
                    This page is only accessible to Fleet users, Managers, and Administrators.
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
                <div style={{ padding: '24px', background: 'rgba(255, 77, 77, 0.1)', borderRadius: '12px', marginBottom: '24px', maxWidth: '500px', margin: '0 auto' }}>
                    <ShieldAlert size={48} color="#ff4d4d" style={{ marginBottom: '16px' }} />
                    <p style={{ color: '#ff4d4d', marginBottom: '16px', fontSize: '1.1rem' }}>{error}</p>
                    <button onClick={() => fetchData()} className="btn-primary" style={{ padding: '12px 32px' }}>Retry</button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: '40px', minHeight: 'calc(100vh - 73px)' }}>
            <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
                    <div>
                        <h1 className="premium-gradient" style={{ fontSize: '2.5rem', marginBottom: '8px' }}>
                            Weekly Task Metrics
                        </h1>
                        <p style={{ color: 'rgba(255,255,255,0.6)' }}>
                            {metrics
                                ? `${formatDate(metrics.dateRange.start)} – ${formatDate(metrics.dateRange.end)}`
                                : 'Task creation, approvals, and revisions for the selected period'}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            onClick={copyToClipboard}
                            disabled={!metrics}
                            className="btn-secondary"
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
                        >
                            {copied ? <Check size={16} /> : <Copy size={16} />}
                            {copied ? 'Copied!' : 'Copy Summary'}
                        </button>
                        <button
                            onClick={() => fetchData()}
                            disabled={refreshing}
                            className="btn-secondary"
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
                        >
                            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Date Range Controls */}
                <div className="glass-card" style={{ padding: '24px', marginBottom: '32px', position: 'relative', zIndex: 10 }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>Start Date</label>
                                <input
                                    type="date"
                                    className="input-field"
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                    style={{ width: '160px' }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>End Date</label>
                                <input
                                    type="date"
                                    className="input-field"
                                    value={endDate}
                                    onChange={e => setEndDate(e.target.value)}
                                    style={{ width: '160px' }}
                                />
                            </div>
                        </div>

                        {/* Environment multi-select */}
                        {environments.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} ref={envDropdownRef}>
                                <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>Environments</label>
                                <div style={{ position: 'relative' }}>
                                    <button
                                        onClick={() => setEnvDropdownOpen(o => !o)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '8px',
                                            padding: '9px 14px', minWidth: '200px',
                                            background: 'rgba(255,255,255,0.06)',
                                            border: '1px solid rgba(255,255,255,0.15)',
                                            borderRadius: '8px', color: 'rgba(255,255,255,0.85)',
                                            cursor: 'pointer', fontSize: '0.9rem',
                                        }}
                                    >
                                        <span style={{ flex: 1, textAlign: 'left' }}>
                                            {selectedEnvironments.size === 0
                                                ? 'All environments'
                                                : selectedEnvironments.size === 1
                                                    ? [...selectedEnvironments][0]
                                                    : `${selectedEnvironments.size} selected`}
                                        </span>
                                        <ChevronDown size={14} style={{ opacity: 0.6, flexShrink: 0, transform: envDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                                    </button>
                                    {envDropdownOpen && (
                                        <div style={{
                                            position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 1000,
                                            minWidth: '240px', maxHeight: '280px', overflowY: 'auto',
                                            background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.15)',
                                            borderRadius: '10px', padding: '6px',
                                            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                                        }}>
                                            {selectedEnvironments.size > 0 && (
                                                <button
                                                    onClick={() => setSelectedEnvironments(new Set())}
                                                    style={{
                                                        width: '100%', textAlign: 'left', padding: '7px 10px',
                                                        background: 'none', border: 'none',
                                                        color: 'rgba(255,100,100,0.8)', cursor: 'pointer',
                                                        fontSize: '0.8rem', borderRadius: '6px',
                                                        marginBottom: '4px',
                                                    }}
                                                >
                                                    Clear selection
                                                </button>
                                            )}
                                            {environments.map(env => (
                                                <label
                                                    key={env}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: '10px',
                                                        padding: '7px 10px', borderRadius: '6px', cursor: 'pointer',
                                                        background: selectedEnvironments.has(env) ? 'rgba(255,255,255,0.08)' : 'none',
                                                        color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem',
                                                    }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedEnvironments.has(env)}
                                                        onChange={() => toggleEnvironment(env)}
                                                        style={{ accentColor: 'var(--accent)', width: '14px', height: '14px', flexShrink: 0 }}
                                                    />
                                                    {env}
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <button onClick={handleApply} className="btn-primary" style={{ padding: '10px 24px' }}>
                            Apply
                        </button>
                        <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                            {[7, 14, 30].map(days => (
                                <button
                                    key={days}
                                    onClick={() => {
                                        const end = new Date();
                                        end.setDate(end.getDate() - 1);
                                        const start = new Date(end);
                                        start.setDate(start.getDate() - (days - 1));
                                        const s = start.toISOString().split('T')[0];
                                        const e = end.toISOString().split('T')[0];
                                        setStartDate(s);
                                        setEndDate(e);
                                        fetchData(s, e, selectedEnvironments);
                                    }}
                                    style={{
                                        padding: '8px 16px',
                                        fontSize: '0.85rem',
                                        background: 'rgba(255,255,255,0.12)',
                                        border: '1px solid rgba(255,255,255,0.25)',
                                        borderRadius: '8px',
                                        color: 'rgba(255,255,255,0.9)',
                                        cursor: 'pointer',
                                        fontWeight: 500,
                                    }}
                                >
                                    Last {days}d
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {!metrics ? null : (
                    <>
                        {/* Summary Stat Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '32px' }}>
                            <div className="glass-card" style={{ padding: '28px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                                    <BarChart3 size={32} color="var(--accent)" />
                                </div>
                                <div style={{ fontSize: '3rem', fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>
                                    {metrics.uniqueTasksCreated.toLocaleString()}
                                </div>
                                <div style={{ marginTop: '8px', color: 'rgba(255,255,255,0.7)', fontSize: '0.95rem' }}>
                                    Unique Tasks Created
                                </div>
                            </div>

                            <div className="glass-card" style={{ padding: '28px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                                    <Check size={32} color="#00ff88" />
                                </div>
                                <div style={{ fontSize: '3rem', fontWeight: 700, color: '#00ff88', lineHeight: 1 }}>
                                    {metrics.totalTasksApproved.toLocaleString()}
                                </div>
                                <div style={{ marginTop: '8px', color: 'rgba(255,255,255,0.7)', fontSize: '0.95rem' }}>
                                    Tasks Approved
                                </div>
                            </div>

                            <div className="glass-card" style={{ padding: '28px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                                    <RefreshCw size={32} color="#ffa500" />
                                </div>
                                <div style={{ fontSize: '3rem', fontWeight: 700, color: '#ffa500', lineHeight: 1 }}>
                                    {metrics.totalRevisions.toLocaleString()}
                                </div>
                                <div style={{ marginTop: '8px', color: 'rgba(255,255,255,0.7)', fontSize: '0.95rem' }}>
                                    Task Revisions Made
                                </div>
                            </div>
                        </div>

                        {/* Environment Breakdowns */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                            {/* Tasks Created by Environment */}
                            <div className="glass-card" style={{ padding: '24px' }}>
                                <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '20px', color: 'rgba(255,255,255,0.9)' }}>
                                    Tasks Created by Environment
                                </h2>
                                {metrics.uniqueTasksCreatedByEnvironment.length === 0 ? (
                                    <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '24px 0' }}>No data</p>
                                ) : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                                    Environment
                                                </th>
                                                <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                                    Tasks
                                                </th>
                                                <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                                    %
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {metrics.uniqueTasksCreatedByEnvironment.map((row, i) => (
                                                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                                    <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem' }}>
                                                        {row.environment}
                                                    </td>
                                                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--accent)' }}>
                                                        {row.count.toLocaleString()}
                                                    </td>
                                                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
                                                        {metrics.uniqueTasksCreated > 0
                                                            ? `${Math.round((row.count / metrics.uniqueTasksCreated) * 100)}%`
                                                            : '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            {/* Tasks Approved by Environment */}
                            <div className="glass-card" style={{ padding: '24px' }}>
                                <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '20px', color: 'rgba(255,255,255,0.9)' }}>
                                    Tasks Approved by Environment
                                </h2>
                                {metrics.totalTasksApprovedByEnvironment.length === 0 ? (
                                    <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '24px 0' }}>No data</p>
                                ) : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                                    Environment
                                                </th>
                                                <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                                    Approved
                                                </th>
                                                <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                                    %
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {metrics.totalTasksApprovedByEnvironment.map((row, i) => (
                                                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                                    <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem' }}>
                                                        {row.environment}
                                                    </td>
                                                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#00ff88' }}>
                                                        {row.count.toLocaleString()}
                                                    </td>
                                                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
                                                        {metrics.totalTasksApproved > 0
                                                            ? `${Math.round((row.count / metrics.totalTasksApproved) * 100)}%`
                                                            : '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>

                        <p style={{ marginTop: '24px', color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>
                            Excludes records created by @fleet.so addresses. Revisions are tasks with task_version &gt; 1.
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
