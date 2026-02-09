'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, Loader2, ShieldAlert, RefreshCw, Calendar } from 'lucide-react';

interface DailyActivity {
    date: string;
    taskCount: number;
    feedbackCount: number;
    totalCount: number;
}

interface ActivityData {
    dailyActivity: DailyActivity[];
    startDate: string;
    endDate: string;
}

export default function ActivityOverTimePage() {
    const router = useRouter();
    const [data, setData] = useState<ActivityData | null>(null);
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Date range state
    const getDefaultStartDate = () => {
        const date = new Date();
        date.setDate(date.getDate() - 29);
        return date.toISOString().split('T')[0];
    };

    const getDefaultEndDate = () => {
        return new Date().toISOString().split('T')[0];
    };

    const [startDate, setStartDate] = useState(getDefaultStartDate());
    const [endDate, setEndDate] = useState(getDefaultEndDate());
    const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; date: string; tasks: number; feedback: number } | null>(null);
    const [showTasks, setShowTasks] = useState(true);
    const [showFeedback, setShowFeedback] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async (customStart?: string, customEnd?: string) => {
        setRefreshing(true);
        setError(null);
        try {
            const start = customStart || startDate;
            const end = customEnd || endDate;
            const res = await fetch(`/api/admin/activity-over-time?start=${start}&end=${end}`);

            if (res.status === 403) {
                setAuthorized(false);
                setLoading(false);
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

            const activityData = await res.json();

            // Validate response structure
            if (!activityData ||
                !Array.isArray(activityData.dailyActivity) ||
                !activityData.startDate ||
                !activityData.endDate) {
                throw new Error('Invalid response format from server');
            }

            setData(activityData);
            setAuthorized(true);
        } catch (err) {
            console.error('Failed to fetch activity data', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to load activity data. Please check your connection and try again.';
            setError(errorMessage);
        } finally {
            setLoading(false);
            setRefreshing(false);
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
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '60vh',
                textAlign: 'center'
            }}>
                <div style={{ padding: '16px', background: 'rgba(255, 77, 77, 0.1)', borderRadius: '16px', marginBottom: '24px' }}>
                    <ShieldAlert size={64} color="#ff4d4d" />
                </div>
                <h1 style={{ fontSize: '2rem', marginBottom: '16px' }}>Access Denied</h1>
                <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '24px' }}>
                    This page is only accessible to Managers and Administrators.
                </p>
                <button
                    onClick={() => router.push('/')}
                    className="btn-primary"
                    style={{ padding: '12px 32px' }}
                >
                    Return to Dashboard
                </button>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ textAlign: 'center', padding: '48px' }}>
                <div style={{
                    padding: '24px',
                    background: 'rgba(255, 77, 77, 0.1)',
                    borderRadius: '12px',
                    marginBottom: '24px',
                    maxWidth: '500px',
                    margin: '0 auto'
                }}>
                    <ShieldAlert size={48} color="#ff4d4d" style={{ marginBottom: '16px' }} />
                    <p style={{ color: '#ff4d4d', marginBottom: '16px', fontSize: '1.1rem' }}>{error}</p>
                    <button
                        onClick={() => fetchData()}
                        className="btn-primary"
                        style={{ padding: '12px 32px' }}
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div style={{ textAlign: 'center', padding: '48px' }}>
                <p style={{ color: 'rgba(255,255,255,0.5)' }}>No activity data available</p>
            </div>
        );
    }

    const maxCount = Math.max(...data.dailyActivity.map(d => d.totalCount), 1);

    // Calculate summary statistics
    const totalTasks = data.dailyActivity.reduce((sum, d) => sum + d.taskCount, 0);
    const totalFeedback = data.dailyActivity.reduce((sum, d) => sum + d.feedbackCount, 0);
    const dayCount = data.dailyActivity.length;
    const avgDaily = dayCount > 0 ? Math.round((totalTasks + totalFeedback) / dayCount) : 0;

    const handleDateRangeChange = () => {
        if (!startDate || !endDate) {
            alert('Please select both start and end dates');
            return;
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (start > end) {
            alert('Start date must be before end date');
            return;
        }

        fetchData(startDate, endDate);
    };

    const setQuickRange = (days: number) => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - (days - 1));

        const startStr = start.toISOString().split('T')[0];
        const endStr = end.toISOString().split('T')[0];

        setStartDate(startStr);
        setEndDate(endStr);
        fetchData(startStr, endStr);
    };

    return (
        <div style={{ padding: '40px', minHeight: 'calc(100vh - 73px)' }}>
            <div style={{ width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
                <div style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                    <div>
                        <h1 className="premium-gradient" style={{ fontSize: '2.5rem', marginBottom: '8px' }}>
                            Activity Over Time
                        </h1>
                        <p style={{ color: 'rgba(255,255,255,0.6)' }}>
                            Daily task and feedback creation trends
                        </p>
                    </div>
                </div>

                {/* Date Range Controls */}
                <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        {/* Date Inputs */}
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>Start Date</label>
                                <input
                                    type="date"
                                    className="input-field"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    style={{ width: '160px' }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>End Date</label>
                                <input
                                    type="date"
                                    className="input-field"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    style={{ width: '160px' }}
                                />
                            </div>
                            <button
                                onClick={handleDateRangeChange}
                                disabled={refreshing}
                                className="btn-primary"
                                style={{ padding: '10px 24px', whiteSpace: 'nowrap' }}
                            >
                                Apply Range
                            </button>
                        </div>

                        {/* Quick Select Buttons */}
                        <div style={{
                            display: 'flex',
                            gap: '8px',
                            alignItems: 'center',
                            paddingLeft: '16px',
                            borderLeft: '1px solid rgba(255,255,255,0.1)'
                        }}>
                            <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginRight: '4px' }}>
                                Quick Select:
                            </span>
                            <button
                                onClick={() => setQuickRange(7)}
                                disabled={refreshing}
                                style={{
                                    padding: '8px 16px',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '6px',
                                    color: 'rgba(255,255,255,0.8)',
                                    fontSize: '0.85rem',
                                    cursor: refreshing ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                    if (!refreshing) {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                                        e.currentTarget.style.borderColor = 'var(--accent)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                                }}
                            >
                                7 Days
                            </button>
                            <button
                                onClick={() => setQuickRange(30)}
                                disabled={refreshing}
                                style={{
                                    padding: '8px 16px',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '6px',
                                    color: 'rgba(255,255,255,0.8)',
                                    fontSize: '0.85rem',
                                    cursor: refreshing ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                    if (!refreshing) {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                                        e.currentTarget.style.borderColor = 'var(--accent)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                                }}
                            >
                                30 Days
                            </button>
                            <button
                                onClick={() => setQuickRange(90)}
                                disabled={refreshing}
                                style={{
                                    padding: '8px 16px',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '6px',
                                    color: 'rgba(255,255,255,0.8)',
                                    fontSize: '0.85rem',
                                    cursor: refreshing ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                    if (!refreshing) {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                                        e.currentTarget.style.borderColor = 'var(--accent)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                                }}
                            >
                                90 Days
                            </button>
                            <button
                                onClick={() => fetchData()}
                                disabled={refreshing}
                                style={{
                                    padding: '8px 12px',
                                    background: 'rgba(0, 112, 243, 0.1)',
                                    border: '1px solid rgba(0, 112, 243, 0.3)',
                                    borderRadius: '6px',
                                    color: 'var(--accent)',
                                    fontSize: '0.85rem',
                                    cursor: refreshing ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                                title="Refresh data"
                            >
                                <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary Statistics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                <div className="glass-card" style={{ padding: '20px' }}>
                    <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>Total Tasks</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent)' }}>{totalTasks}</div>
                </div>
                <div className="glass-card" style={{ padding: '20px' }}>
                    <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>Total Feedback</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#00d2ff' }}>{totalFeedback}</div>
                </div>
                <div className="glass-card" style={{ padding: '20px' }}>
                    <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>Total Items</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#00ff88' }}>{totalTasks + totalFeedback}</div>
                </div>
                <div className="glass-card" style={{ padding: '20px' }}>
                    <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>Daily Average</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ffab00' }}>{avgDaily}</div>
                </div>
                <div className="glass-card" style={{ padding: '20px' }}>
                    <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>Days in Range</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ff6b9d' }}>{dayCount}</div>
                </div>
            </div>

            {/* Chart */}
            <section className="glass-card" style={{ padding: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ padding: '8px', background: 'rgba(0, 112, 243, 0.1)', borderRadius: '8px' }}>
                        <BarChart3 size={20} color="var(--accent)" />
                    </div>
                    <h2 style={{ fontSize: '1.25rem' }}>Daily Activity Chart</h2>
                    <div style={{ marginLeft: 'auto', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>
                        {dayCount} days | Max: {maxCount} items/day
                    </div>
                </div>
                {maxCount === 1 && (
                    <div style={{
                        padding: '12px',
                        background: 'rgba(255, 171, 0, 0.1)',
                        border: '1px solid rgba(255, 171, 0, 0.3)',
                        borderRadius: '8px',
                        marginBottom: '16px',
                        fontSize: '0.9rem',
                        color: '#ffab00'
                    }}>
                        Note: All days have 0 or 1 items. Bars may be very small.
                    </div>
                )}

                {/* Interactive Legend */}
                <div style={{ display: 'flex', gap: '24px', marginBottom: '24px', fontSize: '0.9rem' }}>
                    <button
                        onClick={() => setShowTasks(!showTasks)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            opacity: showTasks ? 1 : 0.4,
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                        <div style={{
                            width: '16px',
                            height: '16px',
                            background: showTasks ? 'var(--accent)' : 'rgba(0,112,243,0.3)',
                            borderRadius: '3px',
                            border: showTasks ? 'none' : '2px solid var(--accent)'
                        }} />
                        <span style={{ color: showTasks ? '#fff' : 'rgba(255,255,255,0.5)' }}>Tasks</span>
                    </button>
                    <button
                        onClick={() => setShowFeedback(!showFeedback)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            opacity: showFeedback ? 1 : 0.4,
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                        <div style={{
                            width: '16px',
                            height: '16px',
                            background: showFeedback ? '#00d2ff' : 'rgba(0,210,255,0.3)',
                            borderRadius: '3px',
                            border: showFeedback ? 'none' : '2px solid #00d2ff'
                        }} />
                        <span style={{ color: showFeedback ? '#fff' : 'rgba(255,255,255,0.5)' }}>Feedback</span>
                    </button>
                </div>

                {/* Chart Container */}
                <div style={{
                    width: '100%',
                    paddingBottom: '16px',
                    position: 'relative',
                    paddingLeft: '50px'
                }}>
                    {/* Y-axis labels */}
                    <div style={{
                        position: 'absolute',
                        left: '0',
                        top: '20px',
                        bottom: '60px',
                        width: '45px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        alignItems: 'flex-end',
                        fontSize: '0.75rem',
                        color: 'rgba(255,255,255,0.4)',
                        paddingRight: '8px'
                    }}>
                        <div>{maxCount}</div>
                        <div>{Math.round(maxCount * 0.75)}</div>
                        <div>{Math.round(maxCount * 0.5)}</div>
                        <div>{Math.round(maxCount * 0.25)}</div>
                        <div>0</div>
                    </div>

                    <div style={{
                        width: '100%',
                        height: '400px',
                        padding: '20px 0',
                        position: 'relative',
                        background: 'rgba(255,255,255,0.02)'
                    }}>

                        {/* SVG Line Chart */}
                        <svg
                            viewBox="0 0 1000 380"
                            width="100%"
                            height="380"
                            style={{ position: 'absolute', top: 0, left: 0 }}
                            preserveAspectRatio="none"
                        >
                            {/* Grid lines */}
                            {[0, 0.25, 0.5, 0.75, 1].map((percent, i) => (
                                <line
                                    key={i}
                                    x1="0"
                                    y1={percent * 380}
                                    x2="1000"
                                    y2={percent * 380}
                                    stroke="rgba(255,255,255,0.05)"
                                    strokeWidth="1"
                                    vectorEffect="non-scaling-stroke"
                                />
                            ))}

                            {/* Task line path */}
                            {showTasks && (
                                <path
                                    d={data.dailyActivity.map((day, index) => {
                                        const x = dayCount > 1 ? (index / (dayCount - 1)) * 1000 : 500;
                                        const y = 380 - ((day.taskCount / maxCount) * 380);
                                        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
                                    }).join(' ')}
                                    fill="none"
                                    stroke="var(--accent)"
                                    strokeWidth="2"
                                    strokeLinejoin="round"
                                    strokeLinecap="round"
                                    vectorEffect="non-scaling-stroke"
                                />
                            )}

                            {/* Feedback line path */}
                            {showFeedback && (
                                <path
                                    d={data.dailyActivity.map((day, index) => {
                                        const x = dayCount > 1 ? (index / (dayCount - 1)) * 1000 : 500;
                                        const y = 380 - ((day.feedbackCount / maxCount) * 380);
                                        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
                                    }).join(' ')}
                                    fill="none"
                                    stroke="#00d2ff"
                                    strokeWidth="2"
                                    strokeLinejoin="round"
                                    strokeLinecap="round"
                                    vectorEffect="non-scaling-stroke"
                                />
                            )}

                            {/* Data point circles for tasks */}
                            {showTasks && data.dailyActivity.map((day, index) => {
                                if (day.taskCount === 0) return null;
                                const x = dayCount > 1 ? (index / (dayCount - 1)) * 1000 : 500;
                                const y = 380 - ((day.taskCount / maxCount) * 380);
                                const [, month, dayNum] = day.date.split('-').map(Number);
                                const dateLabel = `${month}/${dayNum}`;

                                return (
                                    <circle
                                        key={`task-${index}`}
                                        cx={x}
                                        cy={y}
                                        r="5"
                                        fill="var(--accent)"
                                        stroke="rgba(0,0,0,0.5)"
                                        strokeWidth="2"
                                        style={{ cursor: 'pointer' }}
                                        onMouseEnter={(e) => {
                                            const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                                            setHoveredPoint({
                                                x: rect ? e.clientX - rect.left : e.clientX,
                                                y: rect ? e.clientY - rect.top : e.clientY,
                                                date: dateLabel,
                                                tasks: day.taskCount,
                                                feedback: day.feedbackCount
                                            });
                                        }}
                                        onMouseLeave={() => setHoveredPoint(null)}
                                    />
                                );
                            })}

                            {/* Data point circles for feedback */}
                            {showFeedback && data.dailyActivity.map((day, index) => {
                                if (day.feedbackCount === 0) return null;
                                const x = dayCount > 1 ? (index / (dayCount - 1)) * 1000 : 500;
                                const y = 380 - ((day.feedbackCount / maxCount) * 380);
                                const [, month, dayNum] = day.date.split('-').map(Number);
                                const dateLabel = `${month}/${dayNum}`;

                                return (
                                    <circle
                                        key={`feedback-${index}`}
                                        cx={x}
                                        cy={y}
                                        r="5"
                                        fill="#00d2ff"
                                        stroke="rgba(0,0,0,0.5)"
                                        strokeWidth="2"
                                        style={{ cursor: 'pointer' }}
                                        onMouseEnter={(e) => {
                                            const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                                            setHoveredPoint({
                                                x: rect ? e.clientX - rect.left : e.clientX,
                                                y: rect ? e.clientY - rect.top : e.clientY,
                                                date: dateLabel,
                                                tasks: day.taskCount,
                                                feedback: day.feedbackCount
                                            });
                                        }}
                                        onMouseLeave={() => setHoveredPoint(null)}
                                    />
                                );
                            })}
                        </svg>

                        {/* Hover Tooltip */}
                        {hoveredPoint && (
                            <div
                                style={{
                                    position: 'fixed',
                                    left: `${hoveredPoint.x}px`,
                                    top: `${hoveredPoint.y - 80}px`,
                                    transform: 'translateX(-50%)',
                                    background: 'rgba(0,0,0,0.95)',
                                    padding: '12px 16px',
                                    borderRadius: '8px',
                                    fontSize: '0.85rem',
                                    whiteSpace: 'nowrap',
                                    zIndex: 1000,
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                                    pointerEvents: 'none'
                                }}
                            >
                                <div style={{ fontWeight: 600, marginBottom: '8px', color: '#fff', fontSize: '0.9rem' }}>
                                    {hoveredPoint.date}
                                </div>
                                {showTasks && hoveredPoint.tasks > 0 && (
                                    <div style={{ color: 'var(--accent)', marginBottom: '4px' }}>
                                        Tasks: {hoveredPoint.tasks}
                                    </div>
                                )}
                                {showFeedback && hoveredPoint.feedback > 0 && (
                                    <div style={{ color: '#00d2ff', marginBottom: '4px' }}>
                                        Feedback: {hoveredPoint.feedback}
                                    </div>
                                )}
                                <div style={{
                                    color: '#00ff88',
                                    marginTop: '6px',
                                    paddingTop: '6px',
                                    borderTop: '1px solid rgba(255,255,255,0.1)',
                                    fontWeight: 600
                                }}>
                                    Total: {hoveredPoint.tasks + hoveredPoint.feedback}
                                </div>
                            </div>
                        )}

                        {/* Date labels */}
                        <div style={{
                            position: 'absolute',
                            bottom: '-30px',
                            left: 0,
                            right: 0,
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '0.75rem',
                            color: 'rgba(255,255,255,0.4)',
                            paddingRight: '10px'
                        }}>
                            {data.dailyActivity.map((day, index) => {
                                // Parse date without timezone conversion
                                const [, month, dayNum] = day.date.split('-').map(Number);
                                const dateLabel = `${month}/${dayNum}`;

                                // Show every nth label based on total days
                                const labelInterval = dayCount <= 14 ? 1 : dayCount <= 30 ? 3 : dayCount <= 60 ? 5 : 7;
                                const showLabel = index % labelInterval === 0 || index === dayCount - 1;

                                return showLabel ? (
                                    <div key={day.date} style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                                        {dateLabel}
                                    </div>
                                ) : <div key={day.date} />;
                            })}
                        </div>
                    </div>
                </div>

                {/* Date Range */}
                <div style={{
                    marginTop: '24px',
                    padding: '16px',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontSize: '0.9rem',
                    color: 'rgba(255,255,255,0.6)'
                }}>
                    <Calendar size={16} />
                    <span>
                        Showing data from {new Date(data.startDate).toLocaleDateString()} to {new Date(data.endDate).toLocaleDateString()}
                    </span>
                </div>
            </section>
            </div>

        </div>
    );
}
