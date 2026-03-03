'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Inbox, FileCheck, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { EnvironmentFilter } from '@repo/ui/components';

interface Record {
    id: string;
    content: string;
    type: string;
    category: string;
    metadata: any;
    alignmentAnalysis?: string | null;
    createdAt: string;
}

interface Guideline {
    id: string;
    name: string;
    environments: string[];
}

const extractAlignmentScore = (analysis: string | null | undefined): string | null => {
    if (!analysis) return null;
    const regex = /(?:Alignment Score \(0-100\)|Score)[:\s\n]*(\d+)/i;
    const match = analysis.match(regex);
    return match ? match[1] : null;
};

export default function AlignmentScoring() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <AlignmentContent />
        </Suspense>
    );
}

function AlignmentContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [environment, setEnvironment] = useState<string>(searchParams.get('environment') || '');
    const [selectedType, setSelectedType] = useState<string>(searchParams.get('type') || 'TASK');
    const [selectedCategory, setSelectedCategory] = useState<string>(searchParams.get('category') || 'ALL');

    const [records, setRecords] = useState<Record[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [recordsError, setRecordsError] = useState<string | null>(null);

    const [modalRecord, setModalRecord] = useState<Record | null>(null);
    const [guidelines, setGuidelines] = useState<Guideline[]>([]);
    const [guidelinesLoading, setGuidelinesLoading] = useState(false);
    const [guidelinesError, setGuidelinesError] = useState<string | null>(null);
    const [hasLoadedGuidelines, setHasLoadedGuidelines] = useState(false);
    const [selectedGuidelineId, setSelectedGuidelineId] = useState('');

    const pageSize = 10;

    useEffect(() => {
        if (selectedType) {
            fetchRecords();
        }
    }, [environment, selectedType, selectedCategory, page]);

    const fetchRecords = async () => {
        setLoading(true);
        setRecordsError(null);
        try {
            const skip = (page - 1) * pageSize;
            // Build query parameters
            const params = new URLSearchParams({
                type: selectedType,
                skip: skip.toString(),
                take: pageSize.toString()
            });

            // Optional environment filter
            if (environment) {
                params.append('environment', environment);
            }

            // Only include category parameter if not 'ALL'
            if (selectedCategory !== 'ALL') {
                params.append('category', selectedCategory);
            }

            const res = await fetch(`/api/records?${params.toString()}`);
            if (!res.ok) {
                setRecordsError('Failed to load records. Please try again.');
                setRecords([]);
                setTotal(0);
                return;
            }
            const data = await res.json();
            setRecords(data.records || []);
            setTotal(data.total || 0);
        } catch (err) {
            console.error('Failed to fetch records', err);
            setRecordsError('Failed to load records. Please try again.');
            setRecords([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Reset page when filters change
        setPage(1);
    }, [environment, selectedType, selectedCategory]);

    const openGuidelineModal = async (record: Record) => {
        setModalRecord(record);
        setSelectedGuidelineId('');
        setGuidelinesError(null);
        if (!hasLoadedGuidelines) {
            setGuidelinesLoading(true);
            try {
                const res = await fetch('/api/guidelines');
                if (!res.ok) {
                    setGuidelinesError('Failed to load guidelines. Please try again.');
                } else {
                    const data = await res.json();
                    setGuidelines(data.guidelines || []);
                    setHasLoadedGuidelines(true);
                }
            } catch {
                setGuidelinesError('Failed to load guidelines. Please try again.');
            } finally {
                setGuidelinesLoading(false);
            }
        }
    };

    const runAnalysis = () => {
        if (!modalRecord || !selectedGuidelineId) return;
        router.push(`/alignment-scoring/compare?id=${modalRecord.id}&guidelineId=${selectedGuidelineId}`);
        setModalRecord(null);
    };

    const totalPages = Math.ceil(total / pageSize);

    return (
        <>
        <div style={{ width: '100%', maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ marginBottom: '24px' }}>
                <h1 className="premium-gradient" style={{ fontSize: '1.5rem', marginBottom: '8px', textTransform: 'capitalize' }}>
                    {selectedCategory === 'ALL' ? 'All' : selectedCategory?.replace('_', ' ').toLowerCase()} {selectedType === 'TASK' ? 'Tasks' : 'Feedback'}
                </h1>
                <p style={{ color: 'rgba(255,255,255,0.6)' }}>Exploration View • {total} Total Records</p>
            </div>

            {/* Environment Filter - Optional */}
            <div className="glass-card" style={{ padding: '16px 20px', marginBottom: '16px' }}>
                <EnvironmentFilter
                    value={environment}
                    onChange={setEnvironment}
                    apiUrl="/api/environments"
                    label="Filter by Environment (optional)"
                    includeAll={true}
                />
            </div>

            <div className="glass-card" style={{ padding: '12px 16px', marginBottom: '16px', display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>

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

                                        {record.alignmentAnalysis ? (
                                            <Link
                                                href={`/alignment-scoring/compare?id=${record.id}`}
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
                                            <button
                                                onClick={() => openGuidelineModal(record)}
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
                                                    cursor: 'pointer'
                                                }}
                                                className="hover-bright"
                                            >
                                                <FileCheck size={12} /> Generate Alignment Score
                                            </button>
                                        )}

                                        <span style={{ fontSize: '0.75rem', opacity: 0.4, marginLeft: '8px' }}>{new Date(record.createdAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                            ))}
                            {recordsError && !loading && (
                                <div style={{ padding: '80px', textAlign: 'center', color: 'var(--error)', opacity: 0.8 }}>{recordsError}</div>
                            )}
                            {records.length === 0 && !loading && !recordsError && (
                            <div style={{ padding: '80px', textAlign: 'center' }}>
                                <Inbox size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                                <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px', opacity: 0.6 }}>
                                    No records found
                                </div>
                                <div style={{ fontSize: '0.9rem', opacity: 0.4 }}>
                                    {`No ${selectedCategory === 'ALL' ? '' : selectedCategory?.replace('_', ' ').toLowerCase() + ' '}${selectedType.toLowerCase()}s found${environment ? ` for environment "${environment}"` : ''}`}
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

        {modalRecord && (
            <div style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000
            }}>
                <div className="glass-card" style={{ width: '480px', maxWidth: '90vw', padding: '32px' }}>
                    <h3 style={{ marginBottom: '8px', fontSize: '1.1rem', fontWeight: 700 }}>Select Guidelines</h3>
                    <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: '24px' }}>
                        Choose which guidelines to run the alignment check against.
                    </p>

                    {guidelinesLoading ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', opacity: 0.5 }}>Loading guidelines...</div>
                    ) : guidelinesError ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--error)', opacity: 0.8 }}>{guidelinesError}</div>
                    ) : guidelines.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', opacity: 0.5 }}>
                            No guidelines found. Upload guidelines in the Fleet app.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                            {guidelines.map(g => (
                                <button
                                    key={g.id}
                                    onClick={() => setSelectedGuidelineId(g.id)}
                                    style={{
                                        padding: '12px 16px',
                                        borderRadius: '8px',
                                        border: `1px solid ${selectedGuidelineId === g.id ? 'var(--accent)' : 'var(--border)'}`,
                                        background: selectedGuidelineId === g.id ? 'rgba(0, 112, 243, 0.1)' : 'rgba(255,255,255,0.02)',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s',
                                        width: '100%'
                                    }}
                                >
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'white', marginBottom: '4px' }}>{g.name}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                                        {g.environments.length === 0 ? 'Global (all environments)' : g.environments.join(', ')}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                        <button
                            onClick={() => setModalRecord(null)}
                            className="btn-outline"
                            style={{ padding: '8px 16px' }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={runAnalysis}
                            className="btn-primary"
                            disabled={!selectedGuidelineId}
                            style={{ padding: '8px 16px', opacity: selectedGuidelineId ? 1 : 0.4 }}
                        >
                            Run Analysis
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}