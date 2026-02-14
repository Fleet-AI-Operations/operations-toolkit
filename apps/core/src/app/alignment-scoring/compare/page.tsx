'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { FileCheck, ArrowLeft, RefreshCcw, Sparkles, Target, MessageSquare, Coins } from 'lucide-react';
import Link from 'next/link';

function CompareContent() {
    const searchParams = useSearchParams();
    const recordId = searchParams.get('id');

    const [loading, setLoading] = useState(true);
    const [evaluation, setEvaluation] = useState<string | null>(null);
    const [recordData, setRecordData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [usage, setUsage] = useState<{
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        cost?: number;
    } | null>(null);
    const [provider, setProvider] = useState<string>('');

    const fetchComparison = async (force = false) => {
        if (!recordId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/analysis/compare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recordId, forceRegenerate: force }),
            });
            const data = await res.json();
            if (res.ok) {
                setEvaluation(data.evaluation);
                setRecordData(data);
                setUsage(data.usage || null);
                setProvider(data.provider || '');
            } else {
                setError(data.error || 'Failed to generate comparison');
            }
        } catch (err) {
            setError('A network error occurred.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchComparison();
    }, [recordId]);

    if (!recordId) {
        return (
            <div className="container" style={{ maxWidth: '600px', textAlign: 'center', padding: '100px' }}>
                <div className="glass-card" style={{ padding: '40px' }}>
                    <FileCheck size={48} color="var(--accent)" style={{ margin: '0 auto 24px' }} />
                    <h2 style={{ marginBottom: '16px' }}>No Record Selected</h2>
                    <p style={{ opacity: 0.6, marginBottom: '32px' }}>
                        The Compare page requires a record ID to analyze. Please select a record from the Records page.
                    </p>
                    <Link href="/alignment-scoring" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <ArrowLeft size={18} />
                        Back to Records
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="container" style={{ maxWidth: '1000px' }}>
            <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="premium-gradient" style={{ fontSize: '2.5rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <FileCheck size={32} color="var(--accent)" /> Alignment Check
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.6)' }}>Comparison against project guidelines</p>
                </div>
                <Link href="/alignment-scoring" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ArrowLeft size={18} /> Back to Records
                </Link>
            </header>

            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px', gap: '24px' }}>
                    <RefreshCcw className="spinner" size={48} color="var(--accent)" />
                    <p style={{ opacity: 0.6, fontSize: '1.1rem' }}>Extracting guidelines and analyzing alignment...</p>
                </div>
            ) : error ? (
                <div className="glass-card" style={{ padding: '40px', textAlign: 'center', border: '1px solid var(--error)' }}>
                    <h3 style={{ color: 'var(--error)', marginBottom: '16px' }}>Analysis Failed</h3>
                    <p style={{ opacity: 0.8, marginBottom: '24px' }}>{error}</p>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                        <button onClick={() => fetchComparison()} className="btn-primary">Try Again</button>
                        <Link href="/manage" className="btn-primary" style={{ background: 'rgba(255,255,255,0.05)' }}>Upload Guidelines</Link>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    {/* Source Item Card */}
                    <div className="glass-card" style={{ padding: '32px', borderLeft: '4px solid var(--accent)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {recordData?.recordType === 'TASK' ? <Target size={20} color="var(--accent)" /> : <MessageSquare size={20} color="#00ff88" />}
                                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)' }}>
                                    ORIGINAL {recordData?.recordType}
                                </span>
                            </div>
                            {recordData?.metadata?.avg_score !== undefined && (
                                <div style={{ fontSize: '0.8rem', background: 'rgba(0, 255, 136, 0.1)', color: '#00ff88', padding: '4px 12px', borderRadius: '12px', border: '1px solid rgba(0, 255, 136, 0.2)', fontWeight: 700 }}>
                                    Quality Score: {(parseFloat(recordData.metadata.avg_score) * 1).toFixed(0)}%
                                </div>
                            )}
                        </div>
                        <p style={{ fontSize: '1.1rem', lineHeight: '1.6', color: 'rgba(255,255,255,0.9)' }}>
                            {recordData?.recordContent}
                        </p>
                    </div>

                    {/* Evaluation Results */}
                    <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                        <div style={{ background: 'rgba(0, 112, 243, 0.1)', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <Sparkles size={20} color="var(--accent)" />
                                    <span style={{ fontWeight: 700, letterSpacing: '1px', color: 'var(--accent)' }}>AI EVALUATION REPORT</span>
                                </div>
                                {usage && provider === 'openrouter' && (
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        fontSize: '0.75rem',
                                        color: 'rgba(255,255,255,0.5)',
                                        paddingLeft: '16px',
                                        borderLeft: '1px solid rgba(255,255,255,0.1)'
                                    }}>
                                        <span>Tokens: {usage.totalTokens.toLocaleString()}</span>
                                        {usage.cost !== undefined && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#00ff88' }}>
                                                <Coins size={12} />
                                                ${usage.cost.toFixed(6)}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => fetchComparison(true)}
                                disabled={loading}
                                style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'white',
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                                className="hover-bright"
                            >
                                <RefreshCcw size={12} className="" />
                                Regenerate Analysis
                            </button>
                        </div>
                        <div style={{ padding: '32px' }}>
                            <div className="markdown-content" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.8' }}>
                                {evaluation}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <Link href="/alignment-scoring" style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.6, transition: 'opacity 0.2s' }} className="hover-opacity">
                            <ArrowLeft size={16} /> Back to Records
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function ComparePage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <CompareContent />
        </Suspense>
    );
}
