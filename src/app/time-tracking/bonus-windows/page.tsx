'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Target, Loader2, Plus, Edit2, Trash2, ChevronDown, ChevronUp, Calendar, ShieldAlert, RefreshCw } from 'lucide-react';

interface BonusWindow {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
    targetTaskCount: number;
    targetFeedbackCount: number;
    targetTaskCountTier2?: number;
    targetFeedbackCountTier2?: number;
    actualTaskCount?: number;
    actualFeedbackCount?: number;
    taskProgress?: number;
    feedbackProgress?: number;
    taskProgressTier2?: number;
    feedbackProgressTier2?: number;
    createdAt: string;
}

interface UserRecordSummary {
    email: string;
    taskCount: number;
    feedbackCount: number;
    totalCount: number;
    taskTier?: number | null;
    feedbackTier?: number | null;
}

export default function BonusWindowsPage() {
    const router = useRouter();
    const [windows, setWindows] = useState<BonusWindow[]>([]);
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [expandedWindow, setExpandedWindow] = useState<string | null>(null);
    const [windowRecords, setWindowRecords] = useState<{ [key: string]: UserRecordSummary[] }>({});
    const [loadingRecords, setLoadingRecords] = useState<string | null>(null);
    const [refreshingWindow, setRefreshingWindow] = useState<string | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [targetTaskCount, setTargetTaskCount] = useState('');
    const [targetFeedbackCount, setTargetFeedbackCount] = useState('');
    const [targetTaskCountTier2, setTargetTaskCountTier2] = useState('');
    const [targetFeedbackCountTier2, setTargetFeedbackCountTier2] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Edit state
    const [editingWindow, setEditingWindow] = useState<BonusWindow | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const windowsRes = await fetch('/api/admin/bonus-windows');

            // Check authorization
            if (windowsRes.status === 403) {
                setAuthorized(false);
                setLoading(false);
                return;
            }

            if (windowsRes.status === 401) {
                router.push('/auth/login');
                return;
            }

            const windowsData = await windowsRes.json();

            if (Array.isArray(windowsData)) setWindows(windowsData);

            setAuthorized(true);
        } catch (err) {
            console.error('Failed to fetch data', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateWindow = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const res = await fetch('/api/admin/bonus-windows', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name || 'Bonus Window',
                    startTime,
                    endTime,
                    targetTaskCount: parseInt(targetTaskCount) || 0,
                    targetFeedbackCount: parseInt(targetFeedbackCount) || 0,
                    targetTaskCountTier2: parseInt(targetTaskCountTier2) || 0,
                    targetFeedbackCountTier2: parseInt(targetFeedbackCountTier2) || 0
                })
            });

            if (res.ok) {
                await fetchData();
                setShowCreateForm(false);
                resetForm();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to create bonus window');
            }
        } catch (err) {
            console.error('Create window error:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateWindow = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingWindow) return;

        setIsSubmitting(true);

        try {
            const res = await fetch('/api/admin/bonus-windows', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingWindow.id,
                    name: name || 'Bonus Window',
                    startTime,
                    endTime,
                    targetTaskCount: parseInt(targetTaskCount) || 0,
                    targetFeedbackCount: parseInt(targetFeedbackCount) || 0,
                    targetTaskCountTier2: parseInt(targetTaskCountTier2) || 0,
                    targetFeedbackCountTier2: parseInt(targetFeedbackCountTier2) || 0
                })
            });

            if (res.ok) {
                await fetchData();
                setEditingWindow(null);
                resetForm();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to update bonus window');
            }
        } catch (err) {
            console.error('Update window error:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteWindow = async (id: string) => {
        if (!confirm('Are you sure you want to delete this bonus window?')) return;

        try {
            const res = await fetch(`/api/admin/bonus-windows?id=${id}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                await fetchData();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to delete bonus window');
            }
        } catch (err) {
            console.error('Delete window error:', err);
        }
    };

    const handleRefreshWindow = async (windowId: string) => {
        setRefreshingWindow(windowId);
        try {
            // Refetch all windows to get updated counts
            await fetchData();

            // If the window is expanded, also refresh the user breakdown
            if (expandedWindow === windowId) {
                setLoadingRecords(windowId);
                const res = await fetch(`/api/admin/bonus-windows/records?windowId=${windowId}`);
                const data = await res.json();
                setWindowRecords(prev => ({ ...prev, [windowId]: data }));
                setLoadingRecords(null);
            }
        } catch (err) {
            console.error('Failed to refresh window', err);
        } finally {
            setRefreshingWindow(null);
        }
    };

    const toggleWindowExpand = async (windowId: string) => {
        if (expandedWindow === windowId) {
            setExpandedWindow(null);
            return;
        }

        setExpandedWindow(windowId);

        // Fetch records if not already loaded
        if (!windowRecords[windowId]) {
            setLoadingRecords(windowId);
            try {
                const res = await fetch(`/api/admin/bonus-windows/records?windowId=${windowId}`);
                const data = await res.json();
                setWindowRecords(prev => ({ ...prev, [windowId]: data }));
            } catch (err) {
                console.error('Failed to fetch window records', err);
            } finally {
                setLoadingRecords(null);
            }
        }
    };

    const startEdit = (window: BonusWindow) => {
        setEditingWindow(window);
        setName(window.name);
        setStartTime(window.startTime.slice(0, 16)); // Format for datetime-local input
        setEndTime(window.endTime.slice(0, 16));
        setTargetTaskCount(window.targetTaskCount.toString());
        setTargetFeedbackCount(window.targetFeedbackCount.toString());
        setTargetTaskCountTier2(window.targetTaskCountTier2?.toString() || '');
        setTargetFeedbackCountTier2(window.targetFeedbackCountTier2?.toString() || '');
        setShowCreateForm(false);
    };

    const resetForm = () => {
        setName('');
        setStartTime('');
        setEndTime('');
        setTargetTaskCount('');
        setTargetFeedbackCount('');
        setTargetTaskCountTier2('');
        setTargetFeedbackCountTier2('');
        setEditingWindow(null);
    };

    const getProgressColor = (progress: number) => {
        if (progress >= 100) return '#00ff88';
        if (progress >= 75) return '#00d2ff';
        if (progress >= 50) return '#ffab00';
        return '#ff4d4d';
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

    return (
        <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                        <h1 className="premium-gradient" style={{ fontSize: '2.5rem', marginBottom: '8px' }}>
                            Bonus Windows
                        </h1>
                        <p style={{ color: 'rgba(255,255,255,0.6)' }}>
                            Configure performance windows and track collective record creation
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            setShowCreateForm(!showCreateForm);
                            if (editingWindow) resetForm();
                        }}
                        className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px' }}
                    >
                        <Plus size={18} /> {showCreateForm ? 'Cancel' : 'New Bonus Window'}
                    </button>
                </div>
            </div>

            {/* Create/Edit Form */}
            {(showCreateForm || editingWindow) && (
                <section className="glass-card" style={{ padding: '32px', marginBottom: '32px', border: '1px solid var(--accent)' }}>
                    <h2 style={{ fontSize: '1.25rem', marginBottom: '24px' }}>
                        {editingWindow ? 'Edit Bonus Window' : 'Create New Bonus Window'}
                    </h2>
                    <form onSubmit={editingWindow ? handleUpdateWindow : handleCreateWindow} style={{ display: 'grid', gap: '20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>Window Name</label>
                            <input
                                type="text"
                                className="input-field"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., Q1 2024 Bonus Period"
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>Start Time</label>
                                <input
                                    type="datetime-local"
                                    required
                                    className="input-field"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>End Time</label>
                                <input
                                    type="datetime-local"
                                    required
                                    className="input-field"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>Target Task Count (Tier 1)</label>
                                <input
                                    type="number"
                                    min="0"
                                    className="input-field"
                                    value={targetTaskCount}
                                    onChange={(e) => setTargetTaskCount(e.target.value)}
                                    placeholder="e.g., 100"
                                />
                                <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                                    Set to 0 to skip task requirement
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>Target Feedback Count (Tier 1)</label>
                                <input
                                    type="number"
                                    min="0"
                                    className="input-field"
                                    value={targetFeedbackCount}
                                    onChange={(e) => setTargetFeedbackCount(e.target.value)}
                                    placeholder="e.g., 50"
                                />
                                <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                                    Set to 0 to skip feedback requirement
                                </span>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>Target Task Count (Tier 2 - Optional)</label>
                                <input
                                    type="number"
                                    min="0"
                                    className="input-field"
                                    value={targetTaskCountTier2}
                                    onChange={(e) => setTargetTaskCountTier2(e.target.value)}
                                    placeholder="e.g., 200"
                                />
                                <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                                    Optional higher tier for enhanced bonus
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>Target Feedback Count (Tier 2 - Optional)</label>
                                <input
                                    type="number"
                                    min="0"
                                    className="input-field"
                                    value={targetFeedbackCountTier2}
                                    onChange={(e) => setTargetFeedbackCountTier2(e.target.value)}
                                    placeholder="e.g., 100"
                                />
                                <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                                    Optional higher tier for enhanced bonus
                                </span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                onClick={resetForm}
                                style={{
                                    padding: '10px 24px',
                                    background: 'rgba(255,255,255,0.05)',
                                    color: 'white',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button type="submit" className="btn-primary" disabled={isSubmitting} style={{ padding: '10px 32px' }}>
                                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (editingWindow ? 'Update Window' : 'Create Window')}
                            </button>
                        </div>
                    </form>
                </section>
            )}

            {/* Bonus Windows List */}
            <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <div style={{ padding: '8px', background: 'rgba(0, 112, 243, 0.1)', borderRadius: '8px' }}>
                        <Target size={20} color="var(--accent)" />
                    </div>
                    <h2 style={{ fontSize: '1.25rem' }}>Active Bonus Windows ({windows.length})</h2>
                </div>

                {windows.length === 0 ? (
                    <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
                        <Clock size={48} color="rgba(255,255,255,0.3)" style={{ margin: '0 auto 16px' }} />
                        <p style={{ color: 'rgba(255,255,255,0.5)' }}>No bonus windows configured yet.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {windows.map(window => (
                            <BonusWindowCard
                                key={window.id}
                                window={window}
                                onEdit={() => startEdit(window)}
                                onDelete={() => handleDeleteWindow(window.id)}
                                onRefresh={() => handleRefreshWindow(window.id)}
                                onToggleExpand={() => toggleWindowExpand(window.id)}
                                isExpanded={expandedWindow === window.id}
                                isRefreshing={refreshingWindow === window.id}
                                records={windowRecords[window.id] || []}
                                loadingRecords={loadingRecords === window.id}
                                getProgressColor={getProgressColor}
                            />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

function BonusWindowCard({
    window,
    onEdit,
    onDelete,
    onRefresh,
    onToggleExpand,
    isExpanded,
    isRefreshing,
    records,
    loadingRecords,
    getProgressColor
}: {
    window: BonusWindow;
    onEdit: () => void;
    onDelete: () => void;
    onRefresh: () => void;
    onToggleExpand: () => void;
    isExpanded: boolean;
    isRefreshing: boolean;
    records: UserRecordSummary[];
    loadingRecords: boolean;
    getProgressColor: (progress: number) => string;
}) {
    const taskProgress = window.taskProgress || 0;
    const feedbackProgress = window.feedbackProgress || 0;
    const taskProgressTier2 = window.taskProgressTier2 || 0;
    const feedbackProgressTier2 = window.feedbackProgressTier2 || 0;
    const taskProgressColor = getProgressColor(taskProgress);
    const feedbackProgressColor = getProgressColor(feedbackProgress);
    const taskProgressTier2Color = getProgressColor(taskProgressTier2);
    const feedbackProgressTier2Color = getProgressColor(feedbackProgressTier2);

    return (
        <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px' }}>
                        {window.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Calendar size={14} />
                            {new Date(window.startTime).toLocaleString()} - {new Date(window.endTime).toLocaleString()}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={onRefresh}
                        disabled={isRefreshing}
                        style={{
                            padding: '8px',
                            background: 'rgba(0, 112, 243, 0.1)',
                            border: '1px solid rgba(0, 112, 243, 0.3)',
                            borderRadius: '6px',
                            cursor: isRefreshing ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            color: 'var(--accent)',
                            opacity: isRefreshing ? 0.5 : 1
                        }}
                        title="Refresh results"
                    >
                        <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={onEdit}
                        style={{
                            padding: '8px',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                        title="Edit window"
                    >
                        <Edit2 size={16} />
                    </button>
                    <button
                        onClick={onDelete}
                        style={{
                            padding: '8px',
                            background: 'rgba(255, 77, 77, 0.1)',
                            border: '1px solid rgba(255, 77, 77, 0.3)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            color: '#ff4d4d'
                        }}
                        title="Delete window"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {/* Progress Bars */}
            <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Task Progress Tier 1 */}
                {window.targetTaskCount > 0 && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>Tasks (Tier 1)</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: taskProgressColor }}>
                                {window.actualTaskCount || 0} / {window.targetTaskCount} ({taskProgress}%)
                            </span>
                        </div>
                        <div style={{
                            width: '100%',
                            height: '6px',
                            background: 'rgba(255,255,255,0.1)',
                            borderRadius: '3px',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                width: `${Math.min(100, taskProgress)}%`,
                                height: '100%',
                                background: taskProgressColor,
                                transition: 'width 0.3s ease'
                            }} />
                        </div>
                    </div>
                )}

                {/* Feedback Progress Tier 1 */}
                {window.targetFeedbackCount > 0 && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>Feedback (Tier 1)</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: feedbackProgressColor }}>
                                {window.actualFeedbackCount || 0} / {window.targetFeedbackCount} ({feedbackProgress}%)
                            </span>
                        </div>
                        <div style={{
                            width: '100%',
                            height: '6px',
                            background: 'rgba(255,255,255,0.1)',
                            borderRadius: '3px',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                width: `${Math.min(100, feedbackProgress)}%`,
                                height: '100%',
                                background: feedbackProgressColor,
                                transition: 'width 0.3s ease'
                            }} />
                        </div>
                    </div>
                )}

                {/* Task Progress Tier 2 */}
                {(window.targetTaskCountTier2 || 0) > 0 && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>Tasks (Tier 2)</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: taskProgressTier2Color }}>
                                {window.actualTaskCount || 0} / {window.targetTaskCountTier2} ({taskProgressTier2}%)
                            </span>
                        </div>
                        <div style={{
                            width: '100%',
                            height: '6px',
                            background: 'rgba(255,255,255,0.1)',
                            borderRadius: '3px',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                width: `${Math.min(100, taskProgressTier2)}%`,
                                height: '100%',
                                background: taskProgressTier2Color,
                                transition: 'width 0.3s ease'
                            }} />
                        </div>
                    </div>
                )}

                {/* Feedback Progress Tier 2 */}
                {(window.targetFeedbackCountTier2 || 0) > 0 && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>Feedback (Tier 2)</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: feedbackProgressTier2Color }}>
                                {window.actualFeedbackCount || 0} / {window.targetFeedbackCountTier2} ({feedbackProgressTier2}%)
                            </span>
                        </div>
                        <div style={{
                            width: '100%',
                            height: '6px',
                            background: 'rgba(255,255,255,0.1)',
                            borderRadius: '3px',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                width: `${Math.min(100, feedbackProgressTier2)}%`,
                                height: '100%',
                                background: feedbackProgressTier2Color,
                                transition: 'width 0.3s ease'
                            }} />
                        </div>
                    </div>
                )}
            </div>

            {/* Expand/Collapse User Summary */}
            <button
                onClick={onToggleExpand}
                style={{
                    width: '100%',
                    padding: '8px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontSize: '0.85rem',
                    color: 'rgba(255,255,255,0.7)'
                }}
            >
                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                {isExpanded ? 'Hide User Breakdown' : 'View User Breakdown'}
            </button>

            {/* Expanded User Summary View */}
            {isExpanded && (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    {loadingRecords ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
                            <Loader2 className="animate-spin" size={24} color="var(--accent)" />
                        </div>
                    ) : records.length === 0 ? (
                        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', padding: '24px' }}>
                            No records created in this time window
                        </p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '2fr 1fr 1fr 1fr',
                                gap: '8px',
                                padding: '8px 12px',
                                fontSize: '0.75rem',
                                color: 'rgba(255,255,255,0.5)',
                                fontWeight: 600,
                                borderBottom: '1px solid rgba(255,255,255,0.1)'
                            }}>
                                <div>USER EMAIL</div>
                                <div style={{ textAlign: 'center' }}>TASKS</div>
                                <div style={{ textAlign: 'center' }}>FEEDBACK</div>
                                <div style={{ textAlign: 'center' }}>TOTAL</div>
                            </div>
                            {records.map((userSummary, index) => {
                                const hasTier2 = userSummary.taskTier === 2 || userSummary.feedbackTier === 2;

                                return (
                                    <div
                                        key={index}
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '2fr 1fr 1fr 1fr',
                                            gap: '12px',
                                            padding: '12px',
                                            background: hasTier2 ? 'rgba(0, 255, 136, 0.05)' : 'rgba(255,255,255,0.03)',
                                            border: hasTier2 ? '1px solid rgba(0, 255, 136, 0.2)' : 'none',
                                            borderRadius: '6px',
                                            fontSize: '0.9rem',
                                            alignItems: 'center',
                                            position: 'relative'
                                        }}
                                    >
                                        <div style={{
                                            color: userSummary.email === 'Unknown' ? 'rgba(255,255,255,0.4)' : '#fff',
                                            fontWeight: 500
                                        }}>
                                            {userSummary.email}
                                        </div>
                                        <div style={{
                                            textAlign: 'center',
                                            color: 'rgba(255,255,255,0.7)',
                                            fontWeight: 500,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px'
                                        }}>
                                            <span>{userSummary.taskCount}</span>
                                            {userSummary.taskTier && (
                                                <span style={{
                                                    fontSize: '0.65rem',
                                                    fontWeight: 700,
                                                    color: userSummary.taskTier === 2 ? '#00ff88' : '#00d2ff',
                                                    background: userSummary.taskTier === 2 ? 'rgba(0, 255, 136, 0.15)' : 'rgba(0, 210, 255, 0.15)',
                                                    padding: '2px 6px',
                                                    borderRadius: '3px',
                                                    border: userSummary.taskTier === 2 ? '1px solid rgba(0, 255, 136, 0.3)' : '1px solid rgba(0, 210, 255, 0.3)',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.5px'
                                                }}>
                                                    T{userSummary.taskTier}
                                                </span>
                                            )}
                                        </div>
                                        <div style={{
                                            textAlign: 'center',
                                            color: 'rgba(255,255,255,0.7)',
                                            fontWeight: 500,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px'
                                        }}>
                                            <span>{userSummary.feedbackCount}</span>
                                            {userSummary.feedbackTier && (
                                                <span style={{
                                                    fontSize: '0.65rem',
                                                    fontWeight: 700,
                                                    color: userSummary.feedbackTier === 2 ? '#00ff88' : '#00d2ff',
                                                    background: userSummary.feedbackTier === 2 ? 'rgba(0, 255, 136, 0.15)' : 'rgba(0, 210, 255, 0.15)',
                                                    padding: '2px 6px',
                                                    borderRadius: '3px',
                                                    border: userSummary.feedbackTier === 2 ? '1px solid rgba(0, 255, 136, 0.3)' : '1px solid rgba(0, 210, 255, 0.3)',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.5px'
                                                }}>
                                                    T{userSummary.feedbackTier}
                                                </span>
                                            )}
                                        </div>
                                        <div style={{
                                            color: hasTier2 ? '#00ff88' : 'var(--accent)',
                                            fontWeight: 600,
                                            fontSize: '1rem',
                                            textAlign: 'center',
                                            padding: '4px 12px',
                                            background: hasTier2 ? 'rgba(0, 255, 136, 0.1)' : 'rgba(0, 112, 243, 0.1)',
                                            borderRadius: '4px'
                                        }}>
                                            {userSummary.totalCount}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
