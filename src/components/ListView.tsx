'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, LayoutDashboard, FileCheck, Sparkles, AlertCircle, Inbox } from 'lucide-react';
import Link from 'next/link';
import { useProjects } from '@/hooks/useProjects';

interface Record {
    id: string;
    content: string;
    type: string;
    category: string;
    metadata: any;
    alignmentAnalysis?: string | null;
    createdAt: string;
}

const extractAlignmentScore = (analysis: string | null | undefined): string | null => {
    if (!analysis) return null;
    // Look for patterns like "Alignment Score (0-100): 85" or "Score (0-100)\n85"
    const regex = /(?:Alignment Score \(0-100\)|Score)[:\s\n]*(\d+)/i;
    const match = analysis.match(regex);
    return match ? match[1] : null;
};

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
    const [selectedCategory, setSelectedCategory] = useState<string>(searchParams.get('category') || 'TOP_10');

    const [records, setRecords] = useState<Record[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);

    const pageSize = 10;

    useEffect(() => {
        if (selectedProjectId && selectedType && selectedCategory) {
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
            const res = await fetch(`/api/records?projectId=${selectedProjectId}&type=${selectedType}&category=${selectedCategory}&skip=${skip}&take=${pageSize}`);
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
                    {selectedCategory?.replace('_', ' ').toLowerCase()} {selectedType === 'TASK' ? 'Tasks' : 'Feedback'}
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
                                        {selectedType === 'TASK' && (
                                            <div style={{
                                                fontSize: '0.7rem',
                                                background: record.metadata?.avg_score !== undefined ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                                                color: record.metadata?.avg_score !== undefined ? '#00ff88' : 'rgba(255, 255, 255, 0.4)',
                                                fontWeight: 700,
                                                padding: '4px 10px',
                                                borderRadius: '20px',
                                                border: `1px solid ${record.metadata?.avg_score !== undefined ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 255, 255, 0.1)'}`,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}>
                                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: record.metadata?.avg_score !== undefined ? '#00ff88' : 'rgba(255, 255, 255, 0.3)' }}></div>
                                                Quality: {record.metadata?.avg_score !== undefined
                                                    ? `${(parseFloat(record.metadata.avg_score) * 1).toFixed(0)}%`
                                                    : 'N/A'}
                                            </div>
                                        )}

                                        {record.alignmentAnalysis ? (
                                            <Link
                                                href={`/compare?id=${record.id}`}
                                                style={{
                                                    fontSize: '0.7rem',
                                                    background: 'rgba(0, 112, 243, 0.1)',
                                                    color: 'var(--accent)',
                                                    fontWeight: 700,
                                                    padding: '4px 10px',
                                                    borderRadius: '20px',
                                                    border: '1px solid rgba(0, 112, 243, 0.2)',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    textDecoration: 'none',
                                                    transition: 'all 0.2s'
                                                }}
                                                className="hover-bright"
                                            >
                                                <Sparkles size={10} />
                                                Alignment: {extractAlignmentScore(record.alignmentAnalysis)}%
                                            </Link>
                                        ) : (
                                            <Link
                                                href={`/compare?id=${record.id}`}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    fontSize: '0.7rem',
                                                    color: 'var(--accent)',
                                                    fontWeight: 600,
                                                    padding: '4px 10px',
                                                    borderRadius: '20px',
                                                    background: 'rgba(0, 112, 243, 0.05)',
                                                    border: '1px solid rgba(0, 112, 243, 0.1)',
                                                    transition: 'all 0.2s',
                                                    textDecoration: 'none'
                                                }}
                                                className="hover-bright"
                                            >
                                                <FileCheck size={12} /> Generate Alignment Score
                                            </Link>
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
                                        : `No ${selectedCategory?.replace('_', ' ').toLowerCase()} ${selectedType.toLowerCase()}s found for this project`
                                    }
                                </div>
                            </div>
                        )}
                        {loading && (
                            <div style={{ padding: '80px', textAlign: 'center', opacity: 0.4 }}>Loading...</div>
                        )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '12px' }}>
                        <button
                            className="btn-outline"
                            disabled={page === 1}
                            onClick={() => setPage(p => p - 1)}
                            style={{ padding: '8px 16px', fontSize: '0.9rem' }}
                        >Previous</button>

                        <div style={{ display: 'flex', gap: '8px', margin: '0 16px' }}>
                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                                .map((pageNum, i, arr) => {
                                    const elements = [];
                                    if (i > 0 && arr[i - 1] !== pageNum - 1) {
                                        elements.push(<span key={`sep-${pageNum}`} style={{ opacity: 0.3 }}>...</span>);
                                    }
                                    elements.push(
                                        <button
                                            key={pageNum}
                                            onClick={() => setPage(pageNum)}
                                            className={page === pageNum ? 'btn-primary' : 'btn-outline'}
                                            style={{ width: '40px', height: '40px', padding: 0 }}
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
                            style={{ padding: '8px 16px', fontSize: '0.9rem' }}
                        >Next</button>
                    </div>
                </div>
            </main>
        </div>
    );
}