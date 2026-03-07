'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, RefreshCw, Sparkles } from 'lucide-react';
import type { MatchType } from '@repo/types';

interface SimilarityFlag {
    id: string;
    similarityJobId: string;
    sourceRecordId: string;
    matchedRecordId: string;
    similarityScore: number;
    userEmail: string | null;
    userName: string | null;
    environment: string;
    status: 'OPEN' | 'CLAIMED';
    claimedByEmail: string | null;
    claimedAt: string | null;
    notifiedAt: string | null;
    matchType: MatchType;
    createdAt: string;
    sourceSnippet: string | null;
    matchedSnippet: string | null;
    matchedTaskKey: string | null;
}

type StatusFilter = '' | 'OPEN' | 'CLAIMED';
type MatchTypeFilter = '' | MatchType;

const LIMIT = 10;

export default function SimilarityFlagsPage() {
    const [flags, setFlags] = useState<SimilarityFlag[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [environments, setEnvironments] = useState<string[]>([]);
    const [selectedEnv, setSelectedEnv] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
    const [matchTypeFilter, setMatchTypeFilter] = useState<MatchTypeFilter>('');
    const [mineOnly, setMineOnly] = useState(false);
    const [claimingId, setClaimingId] = useState<string | null>(null);
    const [modal, setModal] = useState<{ recordId: string; label: string } | null>(null);
    const [aiModal, setAiModal] = useState<{ sourceRecordId: string; matchedRecordId: string } | null>(null);
    const [aiAnalysis, setAiAnalysis] = useState<{ analysis: string; cost: string | null; provider: string } | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [modalRecord, setModalRecord] = useState<{
        id: string; content: string; metadata: Record<string, unknown> | null;
        environment: string; type: string;
        createdByName: string | null; createdByEmail: string | null; createdAt: string;
    } | null>(null);
    const [modalLoading, setModalLoading] = useState(false);
    const [modalError, setModalError] = useState<string | null>(null);

    const totalPages = Math.max(1, Math.ceil(total / LIMIT));

    const fetchFlags = useCallback(async (p: number, env: string, status: StatusFilter, mine: boolean, matchType: MatchTypeFilter) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
            if (env) params.set('environment', env);
            if (status) params.set('status', status);
            if (status === 'CLAIMED' && mine) params.set('claimedBy', 'me');
            if (matchType) params.set('matchType', matchType);
            const res = await fetch(`/api/similarity-flags?${params}`);
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to fetch flags');
            }
            const data = await res.json();
            setFlags(data.flags);
            setTotal(data.total);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'An unexpected error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetch('/api/environments')
            .then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then(d => setEnvironments(d.environments || []))
            .catch(err => {
                console.error('[SimilarityFlags] Failed to load environments for filter:', err);
            });
    }, []);

    useEffect(() => {
        fetchFlags(page, selectedEnv, statusFilter, mineOnly, matchTypeFilter);
    }, [page, selectedEnv, statusFilter, mineOnly, matchTypeFilter, fetchFlags]);

    function handleEnvChange(env: string) {
        setSelectedEnv(env);
        setPage(1);
    }

    function handleStatusFilter(status: StatusFilter) {
        setStatusFilter(status);
        setMineOnly(false);
        setPage(1);
    }

    function handleMatchTypeFilter(mt: MatchTypeFilter) {
        setMatchTypeFilter(mt);
        setPage(1);
    }

    async function handleClaim(flagId: string) {
        setClaimingId(flagId);
        try {
            const res = await fetch(`/api/similarity-flags/${flagId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'claim' }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to claim flag');
            }
            const updated = await res.json();
            setFlags(prev => prev.map(f =>
                f.id === flagId
                    ? { ...f, status: updated.status, claimedByEmail: updated.claimedByEmail, claimedAt: updated.claimedAt }
                    : f
            ));
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'An unexpected error occurred. Please try again.');
        } finally {
            setClaimingId(null);
        }
    }

    async function openModal(recordId: string, label: string) {
        setModal({ recordId, label });
        setModalRecord(null);
        setModalError(null);
        setModalLoading(true);
        try {
            const res = await fetch(`/api/records/${recordId}`);
            if (res.status === 404) {
                setModalError('Record not found. It may have been deleted.');
            } else if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setModalError((data as any).error || `Failed to load record (HTTP ${res.status}). Please try again.`);
            } else {
                setModalRecord(await res.json());
            }
        } catch {
            setModalError('Network error loading record. Check your connection and try again.');
        } finally {
            setModalLoading(false);
        }
    }

    async function openAiModal(sourceRecordId: string, matchedRecordId: string) {
        setAiModal({ sourceRecordId, matchedRecordId });
        setAiAnalysis(null);
        setAiError(null);
        setAiLoading(true);
        try {
            const res = await fetch('/api/similarity-flags/ai-compare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sourceRecordId, matchedRecordId }),
            });
            let data: Record<string, unknown> = {};
            try {
                data = await res.json();
            } catch {
                console.error('[SimilarityFlags] AI compare: failed to parse response body', { status: res.status, contentType: res.headers.get('content-type') });
            }
            if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : `Server error (HTTP ${res.status}). Please try again.`);
            setAiAnalysis({
                analysis: typeof data.analysis === 'string' ? data.analysis : '',
                cost: typeof data.cost === 'string' ? data.cost : null,
                provider: typeof data.provider === 'string' ? data.provider : '',
            });
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'An unexpected error occurred. Please try again.';
            console.error('[SimilarityFlags] AI analysis failed:', { sourceRecordId, matchedRecordId, error: e });
            setAiError(message);
        } finally {
            setAiLoading(false);
        }
    }

    function scoreColor(score: number): string {
        if (score >= 0.95) return '#ef4444';
        if (score >= 0.90) return '#f97316';
        return '#eab308';
    }

    return (
        <div style={{ padding: '32px', maxWidth: '1400px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <AlertTriangle size={24} style={{ color: '#f97316' }} />
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Similarity Flags</h1>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '24px', marginTop: '4px' }}>
                Prompt pairs automatically detected as similar (≥80%) during ingestion
            </p>

            {/* Status tabs */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '20px' }}>
                {(['', 'OPEN', 'CLAIMED'] as StatusFilter[]).map(s => (
                    <button
                        key={s || 'all'}
                        onClick={() => handleStatusFilter(s)}
                        style={{
                            padding: '6px 16px',
                            borderRadius: '6px',
                            border: '1px solid',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: 500,
                            transition: 'all 0.15s',
                            borderColor: statusFilter === s ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
                            background: statusFilter === s ? 'rgba(255,255,255,0.1)' : 'transparent',
                            color: statusFilter === s ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)',
                        }}
                    >
                        {s === '' ? 'All' : s === 'OPEN' ? 'Open' : 'Claimed'}
                    </button>
                ))}
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                {statusFilter === 'CLAIMED' && (
                    <button
                        onClick={() => { setMineOnly(m => !m); setPage(1); }}
                        style={{
                            padding: '8px 14px',
                            borderRadius: '8px',
                            border: '1px solid',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: 500,
                            borderColor: mineOnly ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.15)',
                            background: mineOnly ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.05)',
                            color: mineOnly ? '#a78bfa' : 'rgba(255,255,255,0.6)',
                        }}
                    >
                        Mine only
                    </button>
                )}
                <select
                    value={selectedEnv}
                    onChange={e => handleEnvChange(e.target.value)}
                    style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '8px',
                        color: 'inherit',
                        padding: '8px 12px',
                        fontSize: '0.9rem',
                        minWidth: '200px',
                    }}
                >
                    <option value="">All environments</option>
                    {environments.map(env => (
                        <option key={env} value={env}>{env}</option>
                    ))}
                </select>

                <div style={{ display: 'flex', gap: '4px' }}>
                    {([
                        { value: '', label: 'All types' },
                        { value: 'USER_HISTORY', label: 'User History' },
                        { value: 'DAILY_GREAT', label: 'Daily Great Task' },
                    ] as { value: MatchTypeFilter; label: string }[]).map(({ value, label }) => (
                        <button
                            key={value || 'all'}
                            onClick={() => handleMatchTypeFilter(value)}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: '1px solid',
                                cursor: 'pointer',
                                fontSize: '0.82rem',
                                fontWeight: 500,
                                transition: 'all 0.15s',
                                borderColor: matchTypeFilter === value
                                    ? (value === 'DAILY_GREAT' ? 'rgba(217,119,6,0.5)' : 'rgba(255,255,255,0.3)')
                                    : 'rgba(255,255,255,0.1)',
                                background: matchTypeFilter === value
                                    ? (value === 'DAILY_GREAT' ? 'rgba(217,119,6,0.12)' : 'rgba(255,255,255,0.1)')
                                    : 'transparent',
                                color: matchTypeFilter === value
                                    ? (value === 'DAILY_GREAT' ? '#d97706' : 'rgba(255,255,255,0.9)')
                                    : 'rgba(255,255,255,0.5)',
                            }}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <button
                    onClick={() => fetchFlags(page, selectedEnv, statusFilter, mineOnly, matchTypeFilter)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '8px', color: 'inherit', padding: '8px 14px',
                        cursor: 'pointer', fontSize: '0.9rem',
                    }}
                >
                    <RefreshCw size={14} />
                    Refresh
                </button>

                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', marginLeft: 'auto' }}>
                    {total} total flag{total !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Table */}
            {error ? (
                <div style={{
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: '8px', padding: '16px', color: '#ef4444'
                }}>
                    {error}
                </div>
            ) : loading ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'rgba(255,255,255,0.4)' }}>
                    Loading...
                </div>
            ) : flags.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: '48px',
                    color: 'rgba(255,255,255,0.4)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '12px',
                }}>
                    No similarity flags found
                    {selectedEnv ? ` for environment "${selectedEnv}"` : ''}
                    {statusFilter ? ` with status "${statusFilter}"` : ''}.
                </div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                {['Status', 'User', 'Score', 'Source (snippet)', 'Match (snippet)', 'Environment', 'Date', ''].map(h => (
                                    <th key={h} style={{
                                        padding: '10px 14px', textAlign: 'left',
                                        color: 'rgba(255,255,255,0.5)', fontWeight: 600,
                                        fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em',
                                        whiteSpace: 'nowrap',
                                    }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {flags.map(flag => (
                                <tr
                                    key={flag.id}
                                    style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                                >
                                    {/* Status */}
                                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                                        {flag.status === 'OPEN' ? (
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                background: 'rgba(249,115,22,0.15)',
                                                color: '#f97316',
                                                border: '1px solid rgba(249,115,22,0.3)',
                                            }}>
                                                Open
                                            </span>
                                        ) : (
                                            <div>
                                                <span style={{
                                                    display: 'inline-block',
                                                    padding: '2px 8px',
                                                    borderRadius: '4px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                    background: 'rgba(139,92,246,0.15)',
                                                    color: '#a78bfa',
                                                    border: '1px solid rgba(139,92,246,0.3)',
                                                }}>
                                                    Claimed
                                                </span>
                                                {flag.claimedByEmail && (
                                                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', marginTop: '3px' }}>
                                                        {flag.claimedByEmail}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                    {/* User */}
                                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                                        <div style={{ fontWeight: 500 }}>
                                            {flag.userName || '—'}
                                        </div>
                                        {flag.userEmail && (
                                            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)' }}>
                                                {flag.userEmail}
                                            </div>
                                        )}
                                    </td>
                                    {/* Score */}
                                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                                        <span style={{
                                            fontWeight: 700,
                                            color: scoreColor(flag.similarityScore),
                                            fontSize: '1rem',
                                        }}>
                                            {(flag.similarityScore * 100).toFixed(1)}%
                                        </span>
                                    </td>
                                    {/* Source snippet */}
                                    <td style={{ padding: '12px 14px', maxWidth: '260px' }}>
                                        <button onClick={() => openModal(flag.sourceRecordId, 'Source')} style={snippetBtn}>
                                            <div style={snippetText}>
                                                {flag.sourceSnippet || flag.sourceRecordId}
                                            </div>
                                            <div style={snippetId}>
                                                ID: {flag.sourceRecordId.slice(0, 8)}…
                                            </div>
                                        </button>
                                    </td>
                                    {/* Match snippet */}
                                    <td style={{ padding: '12px 14px', maxWidth: '260px' }}>
                                        <button onClick={() => openModal(flag.matchedRecordId, 'Match')} style={snippetBtn}>
                                            {flag.matchType === 'DAILY_GREAT' && (
                                                <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{
                                                        fontSize: '0.72rem',
                                                        fontWeight: 700,
                                                        color: '#d97706',
                                                        background: 'rgba(217,119,6,0.12)',
                                                        border: '1px solid rgba(217,119,6,0.3)',
                                                        borderRadius: '4px',
                                                        padding: '1px 6px',
                                                    }}>
                                                        Daily Great Task
                                                    </span>
                                                    {flag.matchedTaskKey && (
                                                        <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'rgba(165,180,252,0.8)' }}>
                                                            {flag.matchedTaskKey}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            <div style={snippetText}>
                                                {flag.matchedSnippet || flag.matchedRecordId}
                                            </div>
                                            <div style={snippetId}>
                                                ID: {flag.matchedRecordId.slice(0, 8)}…
                                            </div>
                                        </button>
                                    </td>
                                    {/* Environment */}
                                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: 'rgba(255,255,255,0.6)' }}>
                                        {flag.environment}
                                    </td>
                                    {/* Date */}
                                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>
                                        {new Date(flag.createdAt).toLocaleDateString()}
                                    </td>
                                    {/* Actions */}
                                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                            <button
                                                onClick={() => openAiModal(flag.sourceRecordId, flag.matchedRecordId)}
                                                title="Run AI similarity analysis"
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '5px',
                                                    padding: '4px 10px',
                                                    borderRadius: '6px',
                                                    border: '1px solid rgba(99,102,241,0.4)',
                                                    background: 'rgba(99,102,241,0.1)',
                                                    color: '#818cf8',
                                                    cursor: 'pointer',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 500,
                                                }}
                                            >
                                                <Sparkles size={13} />
                                                Analyse
                                            </button>
                                            {flag.status === 'OPEN' && (
                                                <button
                                                    onClick={() => handleClaim(flag.id)}
                                                    disabled={claimingId === flag.id}
                                                    style={{
                                                        padding: '4px 12px',
                                                        borderRadius: '6px',
                                                        border: '1px solid rgba(139,92,246,0.4)',
                                                        background: 'rgba(139,92,246,0.1)',
                                                        color: '#a78bfa',
                                                        cursor: claimingId === flag.id ? 'not-allowed' : 'pointer',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 500,
                                                        opacity: claimingId === flag.id ? 0.5 : 1,
                                                    }}
                                                >
                                                    {claimingId === flag.id ? 'Claiming…' : 'Claim'}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination */}
            {!loading && flags.length > 0 && (
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: '8px', marginTop: '24px',
                }}>
                    <button onClick={() => setPage(1)} disabled={page === 1} style={paginationBtn(page === 1)}>
                        <ChevronsLeft size={16} />
                    </button>
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={paginationBtn(page === 1)}>
                        <ChevronLeft size={16} />
                    </button>
                    <span style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)', padding: '0 8px' }}>
                        Page {page} of {totalPages}
                    </span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={paginationBtn(page === totalPages)}>
                        <ChevronRight size={16} />
                    </button>
                    <button onClick={() => setPage(totalPages)} disabled={page === totalPages} style={paginationBtn(page === totalPages)}>
                        <ChevronsRight size={16} />
                    </button>
                </div>
            )}

            {/* AI analysis modal */}
            {aiModal && (
                <div
                    onClick={() => setAiModal(null)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 300,
                        background: 'rgba(0,0,0,0.6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '24px',
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: '#1a1a22',
                            border: '1px solid rgba(99,102,241,0.25)',
                            borderRadius: '12px',
                            padding: '28px',
                            maxWidth: '720px',
                            width: '100%',
                            maxHeight: '80vh',
                            overflowY: 'auto',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                        }}
                    >
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Sparkles size={18} style={{ color: '#818cf8' }} />
                                <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
                                    AI Similarity Analysis
                                </h2>
                            </div>
                            <button
                                onClick={() => setAiModal(null)}
                                style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'rgba(255,255,255,0.4)', fontSize: '1.4rem', lineHeight: 1,
                                    padding: '0 4px',
                                }}
                            >
                                ×
                            </button>
                        </div>

                        {aiLoading ? (
                            <div style={{ textAlign: 'center', padding: '48px 0', color: 'rgba(255,255,255,0.4)' }}>
                                <div style={{ marginBottom: '12px' }}>
                                    <Sparkles size={24} style={{ color: '#818cf8', opacity: 0.6 }} />
                                </div>
                                Analysing prompts…
                            </div>
                        ) : aiError ? (
                            <div style={{ color: '#f87171', padding: '16px 0' }}>
                                {aiError}
                            </div>
                        ) : aiAnalysis ? (
                            <div>
                                <div style={{
                                    whiteSpace: 'pre-wrap',
                                    lineHeight: 1.7,
                                    fontSize: '0.9rem',
                                    color: 'rgba(255,255,255,0.85)',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '8px',
                                    padding: '16px 18px',
                                }}>
                                    {aiAnalysis.analysis}
                                </div>
                                <div style={{
                                    display: 'flex', gap: '16px', marginTop: '14px',
                                    fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)',
                                }}>
                                    <span>Provider: {aiAnalysis.provider}</span>
                                    {aiAnalysis.cost && <span>Cost: {aiAnalysis.cost}</span>}
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>
            )}

            {/* Record detail modal */}
            {modal && (
                <div
                    onClick={() => setModal(null)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 300,
                        background: 'rgba(0,0,0,0.6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '24px',
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: '#1a1a22',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: '12px',
                            padding: '28px',
                            maxWidth: '680px',
                            width: '100%',
                            maxHeight: '80vh',
                            overflowY: 'auto',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                        }}
                    >
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
                                    {modal.label} Record
                                </h2>
                                {modal.label === 'Source' && modalRecord && Boolean(modalRecord.metadata?.task_id || modalRecord.metadata?.task_key) && (
                                    <a
                                        href={`/task-search?q=${encodeURIComponent(String(modalRecord.metadata?.task_id ?? modalRecord.metadata?.task_key ?? ''))}`}
                                        style={{
                                            fontSize: '0.78rem',
                                            color: '#818cf8',
                                            textDecoration: 'none',
                                            border: '1px solid rgba(129,140,248,0.3)',
                                            borderRadius: '5px',
                                            padding: '2px 8px',
                                            background: 'rgba(129,140,248,0.08)',
                                        }}
                                    >
                                        View in Task Search ↗
                                    </a>
                                )}
                            </div>
                            <button
                                onClick={() => setModal(null)}
                                style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'rgba(255,255,255,0.4)', fontSize: '1.4rem', lineHeight: 1,
                                    padding: '0 4px',
                                }}
                            >
                                ×
                            </button>
                        </div>

                        {modalLoading ? (
                            <div style={{ textAlign: 'center', padding: '32px', color: 'rgba(255,255,255,0.4)' }}>
                                Loading…
                            </div>
                        ) : modalRecord ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {/* Task ID */}
                                {Boolean(modalRecord.metadata?.task_id || modalRecord.metadata?.task_key) && (
                                    <div>
                                        <div style={modalLabel}>Task ID</div>
                                        <div style={modalValue}>
                                            {String(modalRecord.metadata?.task_id ?? modalRecord.metadata?.task_key ?? '')}
                                        </div>
                                    </div>
                                )}
                                {/* Full prompt */}
                                <div>
                                    <div style={modalLabel}>Prompt</div>
                                    <div style={{
                                        ...modalValue,
                                        lineHeight: 1.6,
                                        whiteSpace: 'pre-wrap',
                                        background: 'rgba(255,255,255,0.04)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: '8px',
                                        padding: '12px 14px',
                                    }}>
                                        {modalRecord.content}
                                    </div>
                                </div>
                                {/* Meta row */}
                                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                                    {(modalRecord.createdByName || modalRecord.createdByEmail) && (
                                        <div>
                                            <div style={modalLabel}>Created by</div>
                                            <div style={modalValue}>
                                                {modalRecord.createdByName || modalRecord.createdByEmail}
                                                {modalRecord.createdByName && modalRecord.createdByEmail && (
                                                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>
                                                        {' '}({modalRecord.createdByEmail})
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    <div>
                                        <div style={modalLabel}>Environment</div>
                                        <div style={modalValue}>{modalRecord.environment}</div>
                                    </div>
                                    <div>
                                        <div style={modalLabel}>Date</div>
                                        <div style={modalValue}>
                                            {new Date(modalRecord.createdAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : modalError ? (
                            <div style={{ color: '#f87171', padding: '16px 0' }}>
                                {modalError}
                            </div>
                        ) : (
                            <div style={{ color: 'rgba(255,255,255,0.4)', padding: '16px 0' }}>
                                Record not found.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

const snippetBtn: React.CSSProperties = {
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
};

const snippetText: React.CSSProperties = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 1.4,
    textDecoration: 'underline',
    textDecorationColor: 'rgba(255,255,255,0.2)',
    textUnderlineOffset: '3px',
};

const snippetId: React.CSSProperties = {
    fontSize: '0.7rem',
    color: 'rgba(255,255,255,0.3)',
    marginTop: '2px',
};

const modalLabel: React.CSSProperties = {
    fontSize: '0.7rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'rgba(255,255,255,0.4)',
    marginBottom: '4px',
};

const modalValue: React.CSSProperties = {
    fontSize: '0.9rem',
    color: 'rgba(255,255,255,0.85)',
};

function paginationBtn(disabled: boolean): React.CSSProperties {
    return {
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '6px 10px', borderRadius: '6px', cursor: disabled ? 'not-allowed' : 'pointer',
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
        color: disabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)',
    };
}
