'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldAlert, RefreshCw, ArrowLeft, Star, Sparkles } from 'lucide-react';

interface SpotlightRecord {
    id: string;
    environment: string;
    content: string;
    createdByName: string | null;
    createdByEmail: string | null;
    isDailyGreat?: boolean;
}

interface SpotlightData {
    tasks: SpotlightRecord[];
    feedback: SpotlightRecord[];
    dateRange: { start: string; end: string };
}

function formatDate(dateStr: string) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
    });
}

function RecordCard({
    record,
    index,
    onToggleDailyGreat,
    togglingId,
}: {
    record: SpotlightRecord;
    index: number;
    onToggleDailyGreat?: (id: string, current: boolean) => void;
    togglingId?: string | null;
}) {
    const isDailyGreat = record.isDailyGreat ?? false;
    const isToggling = togglingId === record.id;

    return (
        <div
            className="glass-card"
            style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                <span style={{
                    fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em',
                    color: 'var(--accent)', background: 'rgba(var(--accent-rgb, 100,120,255),0.12)',
                    padding: '3px 10px', borderRadius: '20px', flexShrink: 0,
                }}>
                    #{index + 1}
                </span>
                <span style={{
                    fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)',
                    background: 'rgba(255,255,255,0.06)', padding: '3px 10px',
                    borderRadius: '20px', whiteSpace: 'nowrap',
                }}>
                    {record.environment}
                </span>
            </div>

            <p style={{
                margin: 0, color: 'rgba(255,255,255,0.85)', fontSize: '0.95rem',
                lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
                {record.content}
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {(record.createdByName || record.createdByEmail) ? (
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)' }}>
                        {record.createdByName ?? record.createdByEmail}
                    </p>
                ) : <span />}

                {onToggleDailyGreat && (
                    <button
                        onClick={() => onToggleDailyGreat(record.id, isDailyGreat)}
                        disabled={isToggling}
                        title={isDailyGreat ? 'Remove Great Example Task flag' : 'Flag as Great Example Task'}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '5px 12px', borderRadius: '20px', border: 'none',
                            cursor: isToggling ? 'not-allowed' : 'pointer',
                            fontSize: '0.78rem', fontWeight: 600,
                            background: isDailyGreat ? 'rgba(255,180,0,0.18)' : 'rgba(255,255,255,0.07)',
                            color: isDailyGreat ? '#ffb400' : 'rgba(255,255,255,0.4)',
                            transition: 'background 0.15s ease, color 0.15s ease',
                            opacity: isToggling ? 0.5 : 1,
                        }}
                    >
                        {isToggling
                            ? <Loader2 size={13} className="animate-spin" />
                            : <Sparkles size={13} />}
                        {isDailyGreat ? 'Great Example' : 'Mark as Great Example'}
                    </button>
                )}
            </div>
        </div>
    );
}

export default function SpotlightPage() {
    const router = useRouter();
    const [data, setData] = useState<SpotlightData | null>(null);
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [toggleError, setToggleError] = useState<string | null>(null);
    const [rerollError, setRerollError] = useState<string | null>(null);

    const fetchData = async (isReroll = false) => {
        setRefreshing(true);
        setRerollError(null);
        if (!isReroll) setError(null);
        try {
            const res = await fetch('/api/admin/weekly-task-metrics/spotlight');

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

            setData(await res.json());
            setAuthorized(true);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to load spotlight.';
            if (isReroll) {
                setRerollError(msg);
            } else {
                setError(msg);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleToggleDailyGreat = async (id: string, current: boolean) => {
        setTogglingId(id);
        setToggleError(null);
        try {
            const res = await fetch(`/api/daily-great-tasks/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isDailyGreat: !current }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'Unknown error' }));
                console.error('[Spotlight] Failed to toggle Great Example flag:', err.error);
                setToggleError('Failed to update flag. Please try again.');
                return;
            }
            // Update confirmed: apply state change after server success
            setData(prev => prev ? {
                ...prev,
                tasks: prev.tasks.map(t => t.id === id ? { ...t, isDailyGreat: !current } : t),
            } : prev);
        } catch (err) {
            console.error('[Spotlight] Network error toggling Great Example flag:', err instanceof Error ? err.message : String(err));
            setToggleError('Network error. Please check your connection and try again.');
        } finally {
            setTogglingId(null);
        }
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
                    <button onClick={fetchData} className="btn-primary" style={{ padding: '12px 32px' }}>Retry</button>
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
                        <div style={{ marginBottom: '12px' }}>
                            <button
                                onClick={() => router.push('/weekly-task-metrics')}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', padding: 0,
                                }}
                            >
                                <ArrowLeft size={14} />
                                Weekly Task Metrics
                            </button>
                        </div>
                        <h1 className="premium-gradient" style={{ fontSize: '2.5rem', marginBottom: '8px' }}>
                            Top 10 Spotlight
                        </h1>
                        <p style={{ color: 'rgba(255,255,255,0.6)' }}>
                            {data
                                ? `5 random highlights from ${formatDate(data.dateRange.start)} – ${formatDate(data.dateRange.end)}`
                                : 'Loading...'}
                        </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                        <button
                            onClick={() => fetchData(true)}
                            disabled={refreshing}
                            className="btn-secondary"
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
                        >
                            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                            Re-roll
                        </button>
                        {rerollError && (
                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#ff4d4d', textAlign: 'right', maxWidth: '260px' }}>
                                {rerollError}
                            </p>
                        )}
                    </div>
                </div>

                {toggleError && (
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 16px', marginBottom: '16px',
                        background: 'rgba(255, 77, 77, 0.1)', border: '1px solid rgba(255, 77, 77, 0.25)',
                        borderRadius: '8px', fontSize: '0.85rem', color: '#ff4d4d',
                    }}>
                        {toggleError}
                        <button
                            onClick={() => setToggleError(null)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff4d4d', padding: '0 0 0 12px', fontSize: '1rem', lineHeight: 1 }}
                        >
                            ×
                        </button>
                    </div>
                )}

                {data && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                        {/* Tasks column */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                                <Star size={20} color="var(--accent)" />
                                <h2 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0, color: 'rgba(255,255,255,0.9)' }}>
                                    Top Tasks
                                </h2>
                                <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', marginLeft: 'auto' }}>
                                    {data.tasks.length} selected
                                </span>
                            </div>
                            {data.tasks.length === 0 ? (
                                <div className="glass-card" style={{ padding: '40px', textAlign: 'center' }}>
                                    <p style={{ color: 'rgba(255,255,255,0.4)', margin: 0 }}>
                                        No TOP_10 tasks found for this period.
                                    </p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {data.tasks.map((record, i) => (
                                        <RecordCard
                                            key={record.id}
                                            record={record}
                                            index={i}
                                            onToggleDailyGreat={handleToggleDailyGreat}
                                            togglingId={togglingId}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Feedback column */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                                <Star size={20} color="#00ff88" />
                                <h2 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0, color: 'rgba(255,255,255,0.9)' }}>
                                    Top Feedback
                                </h2>
                                <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', marginLeft: 'auto' }}>
                                    {data.feedback.length} selected
                                </span>
                            </div>
                            {data.feedback.length === 0 ? (
                                <div className="glass-card" style={{ padding: '40px', textAlign: 'center' }}>
                                    <p style={{ color: 'rgba(255,255,255,0.4)', margin: 0 }}>
                                        No TOP_10 feedback found for this period.
                                    </p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {data.feedback.map((record, i) => (
                                        <RecordCard key={record.id} record={record} index={i} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {data && (
                    <p style={{ marginTop: '32px', color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>
                        Randomly selected from TOP_10 records. At most 1 result per user per list. Excludes @fleet.so addresses.
                    </p>
                )}
            </div>
        </div>
    );
}
