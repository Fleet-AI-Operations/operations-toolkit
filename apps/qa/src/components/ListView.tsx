'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, LayoutDashboard, AlertCircle, Inbox } from 'lucide-react';
import Link from 'next/link';
import { useProjects } from '@/hooks/useProjects';

interface Record {
    id: string;
    content: string;
    type: string;
    category: string;
    metadata: any;
    createdAt: string;
}

export default function ListView() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ListContent />
        </Suspense>
    );
}

function ListContent() {
    const searchParams = useSearchParams();
    const {
        projects,
        selectedProjectId,
        setSelectedProjectId,
        loading: projectsLoading,
        error: projectsError
    } = useProjects({
        autoSelectFirst: true,
        initialProjectId: searchParams.get('projectId') || ''
    });

    const [selectedType, setSelectedType] = useState<string>(searchParams.get('type') || 'TASK');
    const [selectedCategory, setSelectedCategory] = useState<string>(searchParams.get('category') || 'ALL');

    const [records, setRecords] = useState<Record[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);

    const pageSize = 10;

    useEffect(() => {
        if (selectedProjectId && selectedType) {
            fetchRecords();
        } else {
            // No project selected: clear records and stop loading
            setRecords([]);
            setTotal(0);
            setLoading(false);
        }
    }, [selectedProjectId, selectedType, selectedCategory, page]);

    const fetchRecords = async () => {
        setLoading(true);
        try {
            const skip = (page - 1) * pageSize;
            // Only include category parameter if not 'ALL'
            const categoryParam = selectedCategory !== 'ALL' ? `&category=${selectedCategory}` : '';
            const res = await fetch(`/api/records?projectId=${selectedProjectId}&type=${selectedType}${categoryParam}&skip=${skip}&take=${pageSize}`);
            const data = await res.json();
            setRecords(data.records || []);
            setTotal(data.total || 0);
        } catch (err) {
            console.error('Failed to fetch records', err);
            setRecords([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Reset page when filters change
        setPage(1);
    }, [selectedProjectId, selectedType, selectedCategory]);

    const totalPages = Math.ceil(total / pageSize);

    return (
        <div style={{ width: '100%', maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ marginBottom: '24px' }}>
                <h1 className="premium-gradient" style={{ fontSize: '1.5rem', marginBottom: '8px', textTransform: 'capitalize' }}>
                    {selectedCategory === 'ALL' ? 'All' : selectedCategory?.replace('_', ' ').toLowerCase()} {selectedType === 'TASK' ? 'Tasks' : 'Feedback'}
                </h1>
                <p style={{ color: 'rgba(255,255,255,0.6)' }}>Exploration View • {total} Total Records</p>
            </div>

            {projectsError && (
                <div className="glass-card" style={{
                    padding: '16px 20px',
                    marginBottom: '24px',
                    background: 'rgba(255, 68, 68, 0.05)',
                    border: '1px solid rgba(255, 68, 68, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    <AlertCircle size={20} color="#ff4444" />
                    <div>
                        <div style={{ fontWeight: 600, color: '#ff4444', marginBottom: '4px' }}>Failed to load projects</div>
                        <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>{projectsError}</div>
                    </div>
                </div>
            )}

            <div className="glass-card" style={{ padding: '12px 16px', marginBottom: '16px', display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
                {/* Project selection is handled globally via ProjectContext in the header */}

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Record Type</label>
                    <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '4px', border: '1px solid var(--border)' }}>
                        <button
                            onClick={() => setSelectedType('TASK')}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: 'none',
                                background: selectedType === 'TASK' ? 'var(--accent)' : 'transparent',
                                color: selectedType === 'TASK' ? '#000' : 'rgba(255,255,255,0.6)',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >Tasks</button>
                        <button
                            onClick={() => setSelectedType('FEEDBACK')}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: 'none',
                                background: selectedType === 'FEEDBACK' ? 'var(--accent)' : 'transparent',
                                color: selectedType === 'FEEDBACK' ? '#000' : 'rgba(255,255,255,0.6)',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >Feedback</button>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</label>
                    <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '4px', border: '1px solid var(--border)' }}>
                        <button
                            onClick={() => setSelectedCategory('ALL')}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: 'none',
                                background: selectedCategory === 'ALL' ? 'var(--accent)' : 'transparent',
                                color: selectedCategory === 'ALL' ? '#000' : 'rgba(255,255,255,0.6)',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >All</button>
                        <button
                            onClick={() => setSelectedCategory('TOP_10')}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: 'none',
                                background: selectedCategory === 'TOP_10' ? 'var(--accent)' : 'transparent',
                                color: selectedCategory === 'TOP_10' ? '#000' : 'rgba(255,255,255,0.6)',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >Top 10%</button>
                        <button
                            onClick={() => setSelectedCategory('BOTTOM_10')}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: 'none',
                                background: selectedCategory === 'BOTTOM_10' ? 'var(--accent)' : 'transparent',
                                color: selectedCategory === 'BOTTOM_10' ? '#000' : 'rgba(255,255,255,0.6)',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >Bottom 10%</button>
                        <button
                            onClick={() => setSelectedCategory('STANDARD')}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: 'none',
                                background: selectedCategory === 'STANDARD' ? 'var(--accent)' : 'transparent',
                                color: selectedCategory === 'STANDARD' ? '#000' : 'rgba(255,255,255,0.6)',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >Standard</button>
                    </div>
                </div>
            </div>

            <main>
                <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                    <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', opacity: 0.6 }}>Showing {total > 0 ? ((page - 1) * pageSize) + 1 : 0} - {Math.min(page * pageSize, total)} of {total}</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                className="btn-outline"
                                style={{ padding: '6px 12px' }}
                                disabled={page === 1}
                                onClick={() => setPage(p => p - 1)}
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <button
                                className="btn-outline"
                                style={{ padding: '6px 12px' }}
                                disabled={page === totalPages || totalPages === 0}
                                onClick={() => setPage(p => p + 1)}
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>

                    <div style={{ maxHeight: 'calc(100vh - 440px)', overflowY: 'auto', padding: '8px 12px', boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {records.map((record, i) => (
                            <div key={record.id} style={{
                                padding: '24px',
                                borderBottom: i === records.length - 1 ? 'none' : '1px solid var(--border)',
                                background: 'rgba(255,255,255,0.01)',
                                transition: 'all 0.2s'
                            }} className="record-hover">
                                <div style={{ fontSize: '1rem', lineHeight: '1.6', color: 'rgba(255,255,255,0.9)', marginBottom: '16px' }}>
                                    {record.content}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                        {(record.metadata?.environment_name || record.metadata?.env_key) && (
                                            <div style={{
                                                fontSize: '0.7rem',
                                                background: 'rgba(147, 51, 234, 0.1)',
                                                color: '#a78bfa',
                                                fontWeight: 700,
                                                padding: '4px 10px',
                                                borderRadius: '20px',
                                                border: '1px solid rgba(147, 51, 234, 0.2)',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}>
                                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#a78bfa' }}></div>
                                                {record.metadata.environment_name || record.metadata.env_key}
                                            </div>
                                        )}
                                        <span style={{ fontSize: '0.75rem', opacity: 0.4, marginLeft: '8px' }}>{new Date(record.createdAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                            ))}
                            {records.length === 0 && !loading && (
                            <div style={{ padding: '80px', textAlign: 'center' }}>
                                <Inbox size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                                <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px', opacity: 0.6 }}>
                                    {!selectedProjectId ? 'No project selected' : 'No records found'}
                                </div>
                                <div style={{ fontSize: '0.9rem', opacity: 0.4 }}>
                                    {!selectedProjectId
                                        ? 'Select a project from the dropdown above to view records'
                                        : `No ${selectedCategory === 'ALL' ? '' : selectedCategory?.replace('_', ' ').toLowerCase() + ' '}${selectedType.toLowerCase()}s found for this project`
                                    }
                                </div>
                            </div>
                        )}
                        {loading && (
                            <div style={{ padding: '80px', textAlign: 'center', opacity: 0.4 }}>Loading...</div>
                        )}
                        </div>
                    </div>

                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '16px',
                        background: 'rgba(255,255,255,0.02)',
                        borderTop: '1px solid var(--border)'
                    }}>
                        <button
                            className="btn-outline"
                            disabled={page === 1}
                            onClick={() => setPage(p => p - 1)}
                            style={{
                                padding: '10px 20px',
                                fontSize: '0.95rem',
                                fontWeight: 600,
                                background: page === 1 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)',
                                border: '1px solid rgba(255,255,255,0.15)',
                                color: '#ffffff',
                                opacity: page === 1 ? 0.4 : 1
                            }}
                        >Previous</button>

                        <div style={{ display: 'flex', gap: '8px', margin: '0 8px' }}>
                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                                .map((pageNum, i, arr) => {
                                    const elements = [];
                                    if (i > 0 && arr[i - 1] !== pageNum - 1) {
                                        elements.push(
                                            <span
                                                key={`sep-${pageNum}`}
                                                style={{
                                                    opacity: 0.6,
                                                    fontSize: '1rem',
                                                    padding: '0 4px',
                                                    color: 'rgba(255,255,255,0.5)'
                                                }}
                                            >...</span>
                                        );
                                    }
                                    elements.push(
                                        <button
                                            key={pageNum}
                                            onClick={() => setPage(pageNum)}
                                            className={page === pageNum ? 'btn-primary' : 'btn-outline'}
                                            style={{
                                                width: '44px',
                                                height: '44px',
                                                padding: 0,
                                                fontSize: '0.95rem',
                                                fontWeight: 600,
                                                background: page === pageNum ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
                                                border: page === pageNum ? 'none' : '1px solid rgba(255,255,255,0.15)',
                                                color: page === pageNum ? '#000' : 'rgba(255,255,255,0.9)'
                                            }}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                    return elements;
                                })}
                        </div>

                        <button
                            className="btn-outline"
                            disabled={totalPages === 0 || page >= totalPages}
                            onClick={() => setPage(p => p + 1)}
                            style={{
                                padding: '10px 20px',
                                fontSize: '0.95rem',
                                fontWeight: 600,
                                background: (totalPages === 0 || page >= totalPages) ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)',
                                border: '1px solid rgba(255,255,255,0.15)',
                                color: '#ffffff',
                                opacity: (totalPages === 0 || page >= totalPages) ? 0.4 : 1
                            }}
                        >Next</button>
                    </div>
                </div>
            </main>
        </div>
    );
}