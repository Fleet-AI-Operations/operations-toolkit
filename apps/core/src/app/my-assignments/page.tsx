'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    ClipboardList,
    Loader2,
    Calendar,
    ArrowRight,
    CheckCircle2,
    Clock,
    AlertCircle
} from 'lucide-react';

interface AssignmentBatch {
    id: string;
    name: string;
    description: string | null;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    totalRecords: number;
    completedCount: number;
    dueDate: string | null;
    createdAt: string;
    project: { id: string; name: string };
    raterGroup: { id: string; name: string } | null;
    userProgress: {
        total: number;
        completed: number;
        inProgress: number;
        pending: number;
    };
}

export default function MyAssignmentsPage() {
    const router = useRouter();
    const [batches, setBatches] = useState<AssignmentBatch[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

    useEffect(() => {
        fetchMyWork();
    }, []);

    const fetchMyWork = async () => {
        try {
            const res = await fetch('/api/assignments/my-work');
            if (res.ok) {
                const data = await res.json();
                setBatches(data.batches || []);
            }
        } catch (error) {
            console.error('Error fetching my work:', error);
        } finally {
            setLoading(false);
        }
    };

    const getFilteredBatches = () => {
        return batches.filter(b => {
            if (filter === 'pending') return b.userProgress.pending > 0;
            if (filter === 'completed') return b.userProgress.pending === 0 && b.userProgress.total > 0;
            return true;
        });
    };

    const getDueDateStatus = (dueDate: string | null) => {
        if (!dueDate) return null;
        const due = new Date(dueDate);
        const now = new Date();
        const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return { text: 'Overdue', color: '#ff4d4d' };
        if (diffDays === 0) return { text: 'Due today', color: '#ffaa00' };
        if (diffDays <= 2) return { text: `Due in ${diffDays} day(s)`, color: '#ffaa00' };
        return { text: `Due ${due.toLocaleDateString()}`, color: 'rgba(255,255,255,0.5)' };
    };

    const handleStartRating = (batch: AssignmentBatch) => {
        // Navigate to likert scoring with batch context
        router.push(`/likert-scoring?batchId=${batch.id}`);
    };

    const pendingCount = batches.reduce((acc, b) => acc + b.userProgress.pending, 0);
    const completedCount = batches.reduce((acc, b) => acc + b.userProgress.completed, 0);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
                <Loader2 className="animate-spin" size={48} color="var(--accent)" />
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <header style={{ marginBottom: '32px' }}>
                <h1 className="premium-gradient" style={{ fontSize: '2rem', marginBottom: '8px' }}>
                    My Assignments
                </h1>
                <p style={{ color: 'rgba(255,255,255,0.6)' }}>
                    Your assigned records to rate
                </p>
            </header>

            {/* Stats Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div className="glass-card" style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ffaa00' }}>{pendingCount}</div>
                    <div style={{ fontSize: '0.85rem', opacity: 0.6 }}>Pending</div>
                </div>
                <div className="glass-card" style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#00ff88' }}>{completedCount}</div>
                    <div style={{ fontSize: '0.85rem', opacity: 0.6 }}>Completed</div>
                </div>
                <div className="glass-card" style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 700 }}>{batches.length}</div>
                    <div style={{ fontSize: '0.85rem', opacity: 0.6 }}>Active Batches</div>
                </div>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                {(['all', 'pending', 'completed'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '6px',
                            border: 'none',
                            background: filter === f ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                            color: filter === f ? '#000' : 'inherit',
                            cursor: 'pointer',
                            fontWeight: filter === f ? 600 : 400,
                            textTransform: 'capitalize'
                        }}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {/* Batches List */}
            {getFilteredBatches().length === 0 ? (
                <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
                    <ClipboardList size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                    <p style={{ opacity: 0.6 }}>
                        {filter === 'all' ? 'No assignments yet' :
                         filter === 'pending' ? 'No pending assignments' :
                         'No completed assignments'}
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {getFilteredBatches().map(batch => {
                        const dueStatus = getDueDateStatus(batch.dueDate);
                        const progress = batch.userProgress.total > 0
                            ? (batch.userProgress.completed / batch.userProgress.total) * 100
                            : 0;
                        const isComplete = batch.userProgress.pending === 0;

                        return (
                            <div
                                key={batch.id}
                                className="glass-card"
                                style={{
                                    padding: '24px',
                                    cursor: isComplete ? 'default' : 'pointer',
                                    transition: 'transform 0.2s, border-color 0.2s',
                                    border: isComplete ? '1px solid rgba(0,255,136,0.2)' : '1px solid transparent'
                                }}
                                onClick={() => !isComplete && handleStartRating(batch)}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                            {isComplete ? (
                                                <CheckCircle2 size={20} color="#00ff88" />
                                            ) : batch.userProgress.inProgress > 0 ? (
                                                <Clock size={20} color="#0070f3" />
                                            ) : (
                                                <AlertCircle size={20} color="#ffaa00" />
                                            )}
                                            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{batch.name}</h3>
                                        </div>

                                        <div style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '12px' }}>
                                            {batch.project.name}
                                            {batch.raterGroup && ` • ${batch.raterGroup.name}`}
                                        </div>

                                        {/* Progress */}
                                        <div style={{ marginBottom: '8px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                                                <span>{batch.userProgress.completed} of {batch.userProgress.total} completed</span>
                                                <span>{Math.round(progress)}%</span>
                                            </div>
                                            <div style={{
                                                height: '6px',
                                                background: 'rgba(255,255,255,0.1)',
                                                borderRadius: '3px',
                                                overflow: 'hidden'
                                            }}>
                                                <div style={{
                                                    height: '100%',
                                                    width: `${progress}%`,
                                                    background: isComplete ? '#00ff88' : 'var(--accent)',
                                                    transition: 'width 0.3s'
                                                }} />
                                            </div>
                                        </div>

                                        {dueStatus && (
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                fontSize: '0.8rem',
                                                color: dueStatus.color
                                            }}>
                                                <Calendar size={14} />
                                                {dueStatus.text}
                                            </div>
                                        )}
                                    </div>

                                    {!isComplete && (
                                        <button
                                            className="btn-primary"
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                padding: '10px 16px'
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleStartRating(batch);
                                            }}
                                        >
                                            {batch.userProgress.inProgress > 0 ? 'Continue' : 'Start'}
                                            <ArrowRight size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
