'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ExemplarTask {
    id: string;
    environment: string;
    content: string;
    hasEmbedding: boolean;
    createdAt: string;
    updatedAt: string;
}

interface CompareMatch {
    taskId: string;
    taskContent: string;
    taskAuthor: string | null;
    taskEmail: string | null;
    exemplarId: string;
    exemplarContent: string;
    similarity: number;
}

interface DailyGreatRecord {
    id: string;
    environment: string;
    createdByName: string | null;
    createdByEmail: string | null;
    createdAt: string;
    taskKey: string | null;
    snippet: string;
}

interface DailyGreatSearchResult {
    id: string;
    environment: string;
    taskKey: string | null;
    snippet: string;
    isDailyGreat: boolean;
    createdByName: string | null;
    createdByEmail: string | null;
    createdAt: string;
}

interface DailyGreatMatch {
    taskId: string;
    taskContent: string;
    taskAuthor: string | null;
    taskEmail: string | null;
    exemplarId: string;
    exemplarContent: string;
    exemplarTaskKey: string | null;
    similarity: number;
}

interface CsvPreview {
    file: File;
    totalRows: number;
    envCounts: Record<string, number>;
}

// ─── Environment selector ─────────────────────────────────────────────────────

interface ExemplarEnvSelectorProps {
    value: string;
    onChange: (env: string) => void;
    fetchKey: number; // increment to force re-fetch
}

function ExemplarEnvSelector({ value, onChange, fetchKey }: ExemplarEnvSelectorProps) {
    const [environments, setEnvironments] = useState<string[]>([]);
    const [adding, setAdding] = useState(false);
    const [newName, setNewName] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetch('/api/exemplar-tasks/environments')
            .then(r => r.json())
            .then(d => setEnvironments(d.environments || []))
            .catch(() => {});
    }, [fetchKey]);

    useEffect(() => {
        if (adding) inputRef.current?.focus();
    }, [adding]);

    const confirmNew = () => {
        const trimmed = newName.trim();
        if (trimmed) onChange(trimmed);
        setAdding(false);
        setNewName('');
    };

    const selectStyle: React.CSSProperties = {
        padding: '8px 12px',
        borderRadius: '8px',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid var(--border)',
        color: 'var(--text)',
        fontSize: '0.9rem',
        outline: 'none',
        cursor: 'pointer',
        minWidth: '180px',
    };

    if (adding) {
        return (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input
                    ref={inputRef}
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') confirmNew(); if (e.key === 'Escape') { setAdding(false); setNewName(''); } }}
                    placeholder="New environment name"
                    style={{ ...selectStyle, cursor: 'text', minWidth: '200px' }}
                />
                <button
                    onClick={confirmNew}
                    disabled={!newName.trim()}
                    style={{
                        padding: '8px 14px',
                        borderRadius: '8px',
                        background: 'var(--accent)',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        border: 'none',
                        cursor: newName.trim() ? 'pointer' : 'not-allowed',
                        opacity: newName.trim() ? 1 : 0.5,
                    }}
                >
                    Use
                </button>
                <button
                    onClick={() => { setAdding(false); setNewName(''); }}
                    style={{
                        padding: '8px 14px',
                        borderRadius: '8px',
                        background: 'transparent',
                        border: '1px solid var(--border)',
                        color: 'rgba(255,255,255,0.5)',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                    }}
                >
                    Cancel
                </button>
            </div>
        );
    }

    return (
        <select
            value={value}
            onChange={e => {
                if (e.target.value === '__add__') { setAdding(true); }
                else onChange(e.target.value);
            }}
            style={selectStyle}
        >
            <option value="">All Environments</option>
            {environments.map(env => (
                <option key={env} value={env}>{env}</option>
            ))}
            <option value="__add__">+ Add Environment…</option>
        </select>
    );
}

// ─── CSV parser (handles quoted fields with commas, escaped quotes, newlines) ─

function parseCSVRows(text: string): string[][] {
    const rows: string[][] = [];
    const chars = text.split('');
    let current = '';
    let currentRow: string[] = [];
    let inQuotes = false;

    for (let i = 0; i < chars.length; i++) {
        const char = chars[i];
        const nextChar = chars[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') { current += '"'; i++; }
            else inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            currentRow.push(current); current = '';
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') i++;
            currentRow.push(current);
            if (currentRow.some(f => f.trim())) rows.push(currentRow);
            currentRow = []; current = '';
        } else {
            current += char;
        }
    }
    if (current || currentRow.length > 0) {
        currentRow.push(current);
        if (currentRow.some(f => f.trim())) rows.push(currentRow);
    }
    return rows;
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
    const color = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444';
    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '52px',
            height: '26px',
            borderRadius: '6px',
            background: `${color}22`,
            border: `1px solid ${color}44`,
            color,
            fontWeight: 700,
            fontSize: '0.8rem',
            flexShrink: 0,
            padding: '0 6px',
        }}>
            {score.toFixed(1)}%
        </span>
    );
}

function EmbeddingDot({ hasEmbedding }: { hasEmbedding: boolean }) {
    return (
        <span
            title={hasEmbedding ? 'Embedding ready' : 'No embedding yet'}
            style={{
                display: 'inline-block',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: hasEmbedding ? '#22c55e' : 'rgba(255,255,255,0.2)',
                border: `1px solid ${hasEmbedding ? '#22c55e88' : 'rgba(255,255,255,0.15)'}`,
                flexShrink: 0,
            }}
        />
    );
}

function ExpandableText({ text, maxLines = 2 }: { text: string; maxLines?: number }) {
    const [expanded, setExpanded] = useState(false);
    const isLong = text.length > 200;

    if (!isLong) {
        return <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{text}</span>;
    }

    return (
        <span>
            <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {expanded ? text : text.slice(0, 200) + '…'}
            </span>
            {' '}
            <button
                onClick={() => setExpanded(v => !v)}
                style={{
                    color: 'var(--accent)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                }}
            >
                {expanded ? 'Show less' : 'Show more'}
            </button>
        </span>
    );
}

// ─── Add / Edit Form ─────────────────────────────────────────────────────────

interface ExemplarFormProps {
    initial?: { content?: string };
    onSave: (data: { content: string }) => Promise<void>;
    onCancel: () => void;
    saving: boolean;
}

function ExemplarForm({ initial, onSave, onCancel, saving }: ExemplarFormProps) {
    const [content, setContent] = useState(initial?.content ?? '');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim()) return;
        await onSave({ content });
    };

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <textarea
                placeholder="Task content (required)"
                required
                rows={5}
                value={content}
                onChange={e => setContent(e.target.value)}
                style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    color: 'var(--text)',
                    padding: '10px 14px',
                    fontSize: '0.9rem',
                    resize: 'vertical',
                    outline: 'none',
                    fontFamily: 'inherit',
                }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
                <button
                    type="submit"
                    disabled={saving || !content.trim()}
                    style={{
                        padding: '8px 20px',
                        borderRadius: '8px',
                        background: 'var(--accent)',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        border: 'none',
                        cursor: saving ? 'not-allowed' : 'pointer',
                        opacity: saving ? 0.6 : 1,
                    }}
                >
                    {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    style={{
                        padding: '8px 20px',
                        borderRadius: '8px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                    }}
                >
                    Cancel
                </button>
            </div>
        </form>
    );
}

// ─── Exemplar Card ────────────────────────────────────────────────────────────

interface ExemplarCardProps {
    exemplar: ExemplarTask;
    onEdit: (e: ExemplarTask) => void;
    onDelete: (id: string) => void;
    editingId: string | null;
    onSaveEdit: (id: string, data: { content: string }) => Promise<void>;
    onCancelEdit: () => void;
    saving: boolean;
    showEnvironment?: boolean;
}

function ExemplarCard({ exemplar, onEdit, onDelete, editingId, onSaveEdit, onCancelEdit, saving, showEnvironment }: ExemplarCardProps) {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const isEditing = editingId === exemplar.id;

    return (
        <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '16px',
        }}>
            {isEditing ? (
                <ExemplarForm
                    initial={{ content: exemplar.content }}
                    onSave={(data) => onSaveEdit(exemplar.id, data)}
                    onCancel={onCancelEdit}
                    saving={saving}
                />
            ) : (
                <>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <EmbeddingDot hasEmbedding={exemplar.hasEmbedding} />
                            {showEnvironment && (
                                <span style={{
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    background: 'rgba(99,102,241,0.12)',
                                    border: '1px solid rgba(99,102,241,0.3)',
                                    color: 'rgba(165,180,252,0.9)',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    whiteSpace: 'nowrap',
                                }}>
                                    {exemplar.environment}
                                </span>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                            <button
                                onClick={() => onEdit(exemplar)}
                                style={{
                                    padding: '4px 12px',
                                    borderRadius: '6px',
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid var(--border)',
                                    color: 'var(--text)',
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                }}
                            >
                                Edit
                            </button>
                            {confirmDelete ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                                    <span style={{ color: 'rgba(255,255,255,0.6)' }}>Delete?</span>
                                    <button
                                        onClick={() => onDelete(exemplar.id)}
                                        style={{
                                            padding: '4px 10px',
                                            borderRadius: '6px',
                                            background: '#ef444422',
                                            border: '1px solid #ef444444',
                                            color: '#ef4444',
                                            fontSize: '0.8rem',
                                            cursor: 'pointer',
                                            fontWeight: 600,
                                        }}
                                    >
                                        Yes
                                    </button>
                                    <button
                                        onClick={() => setConfirmDelete(false)}
                                        style={{
                                            padding: '4px 10px',
                                            borderRadius: '6px',
                                            background: 'rgba(255,255,255,0.06)',
                                            border: '1px solid var(--border)',
                                            color: 'var(--text)',
                                            fontSize: '0.8rem',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        No
                                    </button>
                                </span>
                            ) : (
                                <button
                                    onClick={() => setConfirmDelete(true)}
                                    style={{
                                        padding: '4px 12px',
                                        borderRadius: '6px',
                                        background: 'rgba(239,68,68,0.08)',
                                        border: '1px solid rgba(239,68,68,0.2)',
                                        color: '#ef4444',
                                        fontSize: '0.8rem',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Delete
                                </button>
                            )}
                        </div>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
                        <ExpandableText text={exemplar.content} />
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>
                        {new Date(exemplar.createdAt).toLocaleDateString()}
                        {!exemplar.hasEmbedding && (
                            <span style={{ marginLeft: '8px', color: 'rgba(255,180,0,0.7)' }}>
                                · Embedding pending
                            </span>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

const DG_LIMIT = 20;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExemplarTasksPage() {
    const [environment, setEnvironment] = useState('');
    const [activeTab, setActiveTab] = useState<'manage' | 'compare' | 'daily-great'>('manage');
    const [filterKey, setFilterKey] = useState(0); // increment to re-fetch env list

    // Manage tab state
    const [exemplars, setExemplars] = useState<ExemplarTask[]>([]);
    const [loadingExemplars, setLoadingExemplars] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [addSaving, setAddSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editSaving, setEditSaving] = useState(false);

    // Import state
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [csvPreview, setCsvPreview] = useState<CsvPreview | null>(null);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<{ imported: number; skipped: number; embeddingErrors: number } | null>(null);
    const [importError, setImportError] = useState('');

    // Embed-pending state
    const [embeddingPending, setEmbeddingPending] = useState(false);
    const [embedResult, setEmbedResult] = useState<{ processed: number; succeeded: number; failed: number } | null>(null);

    // Daily Great Tasks tab state
    const [dgSearchKey, setDgSearchKey] = useState('');
    const [dgSearchResults, setDgSearchResults] = useState<DailyGreatSearchResult[]>([]);
    const [dgSearching, setDgSearching] = useState(false);
    const [dgSearchError, setDgSearchError] = useState('');
    const [dgFlagged, setDgFlagged] = useState<DailyGreatRecord[]>([]);
    const [dgFlaggedTotal, setDgFlaggedTotal] = useState(0);
    const [dgFlaggedPage, setDgFlaggedPage] = useState(1);
    const [dgLoadingFlagged, setDgLoadingFlagged] = useState(false);
    const [dgFlaggedError, setDgFlaggedError] = useState('');
    const [dgTogglingId, setDgTogglingId] = useState<string | null>(null);
    const [dgCompareEnv, setDgCompareEnv] = useState('');
    const [dgThreshold, setDgThreshold] = useState(80);
    const [dgComparing, setDgComparing] = useState(false);
    const [dgCompareResult, setDgCompareResult] = useState<{
        matches: DailyGreatMatch[];
        totalTasks: number;
        totalDailyGreat: number;
        missingEmbeddings: number;
        tasksSkippedNoParse: number;
    } | null>(null);
    const [dgCompareError, setDgCompareError] = useState('');
    const [dgExpandedId, setDgExpandedId] = useState<string | null>(null);

    // Compare tab state
    const [threshold, setThreshold] = useState(70);
    const [comparing, setComparing] = useState(false);
    const [compareResult, setCompareResult] = useState<{
        matches: CompareMatch[];
        totalTasks: number;
        totalExemplars: number;
        missingEmbeddings: number;
        tasksSkippedNoParse: number;
    } | null>(null);
    const [compareError, setCompareError] = useState('');
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

    // ── Fetch exemplars when environment changes ──────────────────────────────

    const fetchExemplars = useCallback(async (env: string) => {
        setLoadingExemplars(true);
        try {
            const url = env
                ? `/api/exemplar-tasks?environment=${encodeURIComponent(env)}`
                : '/api/exemplar-tasks';
            const res = await fetch(url);
            const data = await res.json();
            if (res.ok) setExemplars(data.exemplars);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingExemplars(false);
        }
    }, []);

    useEffect(() => {
        setShowAddForm(false);
        setEditingId(null);
        setCompareResult(null);
        setCompareError('');
        setCsvPreview(null);
        setImportResult(null);
        setImportError('');
        fetchExemplars(environment);
    }, [environment, fetchExemplars]);

    // ── Import: file selected → parse & preview ───────────────────────────────

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!e.target) return;
        // Reset so re-selecting same file still triggers onChange
        (e.target as HTMLInputElement).value = '';
        if (!file) return;

        setImportResult(null);
        setImportError('');

        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target?.result as string;
            const allRows = parseCSVRows(text);
            if (allRows.length < 2) {
                setImportError('File appears to be empty or has only a header row.');
                return;
            }
            const header = allRows[0].map(h => h.trim().toLowerCase());
            const envIdx = header.indexOf('env');
            const promptIdx = header.indexOf('prompt');
            const changesIdx = header.indexOf('changes');
            if (envIdx === -1 || promptIdx === -1) {
                setImportError(`CSV must have "ENV" and "Prompt" columns. Found: ${allRows[0].join(', ')}`);
                return;
            }
            const envCounts: Record<string, number> = {};
            let totalRows = 0;
            for (let i = 1; i < allRows.length; i++) {
                const row = allRows[i];
                const env = row[envIdx]?.trim();
                const content = row[promptIdx]?.trim();
                const changes = changesIdx !== -1 ? row[changesIdx]?.trim() ?? '' : '';
                if (!env || !content) continue;
                if (changes.toLowerCase().includes('deleted')) continue;
                envCounts[env] = (envCounts[env] ?? 0) + 1;
                totalRows++;
            }
            setCsvPreview({ file, totalRows, envCounts });
        };
        reader.readAsText(file);
    };

    // ── Import: submit ────────────────────────────────────────────────────────

    const handleImport = async (filterEnvironment: string | null) => {
        if (!csvPreview) return;
        setImporting(true);
        setImportError('');
        setImportResult(null);

        try {
            const fd = new FormData();
            fd.append('file', csvPreview.file);
            if (filterEnvironment) fd.append('filterEnvironment', filterEnvironment);

            const res = await fetch('/api/exemplar-tasks/import', { method: 'POST', body: fd });
            const json = await res.json();

            if (res.ok) {
                setImportResult(json);
                setCsvPreview(null);
                setFilterKey(k => k + 1);
                await fetchExemplars(environment);
            } else {
                setImportError(json.error || 'Import failed');
            }
        } catch (e: any) {
            setImportError(e.message || 'Network error');
        } finally {
            setImporting(false);
        }
    };

    // ── Manage: add ───────────────────────────────────────────────────────────

    const handleAdd = async (data: { content: string }) => {
        setAddSaving(true);
        try {
            const res = await fetch('/api/exemplar-tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ environment, ...data }),
            });
            const json = await res.json();
            if (res.ok) {
                setExemplars(prev => [json.exemplar, ...prev]);
                setShowAddForm(false);
                setFilterKey(k => k + 1);
            }
        } finally {
            setAddSaving(false);
        }
    };

    // ── Manage: edit ─────────────────────────────────────────────────────────

    const handleSaveEdit = async (id: string, data: { content: string }) => {
        setEditSaving(true);
        try {
            const res = await fetch(`/api/exemplar-tasks/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const json = await res.json();
            if (res.ok) {
                setExemplars(prev => prev.map(e => e.id === id ? json.exemplar : e));
                setEditingId(null);
            }
        } finally {
            setEditSaving(false);
        }
    };

    // ── Manage: delete ────────────────────────────────────────────────────────

    const handleDelete = async (id: string) => {
        const res = await fetch(`/api/exemplar-tasks/${id}`, { method: 'DELETE' });
        if (res.ok) setExemplars(prev => prev.filter(e => e.id !== id));
    };

    // ── Generate missing embeddings ───────────────────────────────────────────

    const handleEmbedPending = async () => {
        setEmbeddingPending(true);
        setEmbedResult(null);
        try {
            const res = await fetch('/api/exemplar-tasks/embed-pending', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ environment: environment || undefined }),
            });
            const json = await res.json();
            if (res.ok) {
                setEmbedResult(json);
                await fetchExemplars(environment);
            }
        } finally {
            setEmbeddingPending(false);
        }
    };

    // ── Compare: run ─────────────────────────────────────────────────────────

    const handleCompare = async () => {
        setComparing(true);
        setCompareError('');
        setCompareResult(null);
        setExpandedTaskId(null);
        try {
            const res = await fetch('/api/exemplar-tasks/compare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ environment, threshold }),
            });
            const json = await res.json();
            if (res.ok) {
                setCompareResult(json);
            } else {
                setCompareError(json.error || 'Comparison failed');
            }
        } catch (e: any) {
            setCompareError(e.message || 'Network error');
        } finally {
            setComparing(false);
        }
    };

    // ── Daily Great Tasks: fetch flagged list ─────────────────────────────────

    const fetchDgFlagged = useCallback(async (page: number = 1) => {
        setDgLoadingFlagged(true);
        setDgFlaggedError('');
        try {
            const res = await fetch(`/api/daily-great-tasks?page=${page}&limit=${DG_LIMIT}`);
            const data = await res.json();
            if (res.ok) {
                setDgFlagged(data.records);
                setDgFlaggedTotal(data.total);
            } else {
                setDgFlaggedError(data.error || 'Failed to load flagged records');
            }
        } catch {
            setDgFlaggedError('Network error');
        } finally {
            setDgLoadingFlagged(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'daily-great') fetchDgFlagged(dgFlaggedPage);
    }, [activeTab, dgFlaggedPage, fetchDgFlagged]);

    // ── Daily Great Tasks: search ─────────────────────────────────────────────

    const handleDgSearch = async () => {
        if (!dgSearchKey.trim()) return;
        setDgSearching(true);
        setDgSearchError('');
        setDgSearchResults([]);
        try {
            const res = await fetch(`/api/daily-great-tasks/search?task_key=${encodeURIComponent(dgSearchKey.trim())}`);
            const data = await res.json();
            if (res.ok) setDgSearchResults(data.records);
            else setDgSearchError(data.error || 'Search failed');
        } catch {
            setDgSearchError('Network error');
        } finally {
            setDgSearching(false);
        }
    };

    // ── Daily Great Tasks: toggle flag ────────────────────────────────────────

    const handleDgToggle = async (id: string, isDailyGreat: boolean) => {
        setDgTogglingId(id);
        try {
            const res = await fetch(`/api/daily-great-tasks/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isDailyGreat }),
            });
            if (res.ok) {
                // Update search results optimistically
                setDgSearchResults(prev => prev.map(r => r.id === id ? { ...r, isDailyGreat } : r));
                // Refresh flagged list (stay on current page)
                await fetchDgFlagged(dgFlaggedPage);
            }
        } finally {
            setDgTogglingId(null);
        }
    };

    // ── Daily Great Tasks: compare ────────────────────────────────────────────

    const handleDgCompare = async () => {
        setDgComparing(true);
        setDgCompareError('');
        setDgCompareResult(null);
        setDgExpandedId(null);
        try {
            const res = await fetch('/api/daily-great-tasks/compare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ environment: dgCompareEnv, threshold: dgThreshold }),
            });
            const data = await res.json();
            if (res.ok) setDgCompareResult(data);
            else setDgCompareError(data.error || 'Comparison failed');
        } catch {
            setDgCompareError('Network error');
        } finally {
            setDgComparing(false);
        }
    };

    // ── Tab button styles ─────────────────────────────────────────────────────

    const tabStyle = (active: boolean) => ({
        padding: '8px 20px',
        borderRadius: '8px',
        background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
        border: active ? '1px solid var(--border)' : '1px solid transparent',
        color: active ? 'var(--text)' : 'rgba(255,255,255,0.5)',
        fontWeight: active ? 700 : 500,
        fontSize: '0.9rem',
        cursor: 'pointer',
    });

    const hasExemplarsWithEmbedding = exemplars.some(e => e.hasEmbedding);

    return (
        <div style={{ padding: '32px', maxWidth: '900px' }}>
            {/* Header */}
            <div style={{ marginBottom: '28px' }}>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '6px' }}>
                    Exemplar Tasks
                </h1>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
                    Manage golden-standard reference tasks and scan for similar real tasks.
                </p>
            </div>

            {/* Environment filter + tabs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px', flexWrap: 'wrap' }}>
                <ExemplarEnvSelector
                    value={environment}
                    onChange={setEnvironment}
                    fetchKey={filterKey}
                />
                <div style={{ display: 'flex', gap: '6px' }}>
                    <button style={tabStyle(activeTab === 'manage')} onClick={() => setActiveTab('manage')}>
                        Manage
                    </button>
                    <button
                        style={tabStyle(activeTab === 'compare')}
                        onClick={() => setActiveTab('compare')}
                        title={!environment ? 'Select a specific environment to compare' : undefined}
                    >
                        Compare
                    </button>
                    <button
                        style={tabStyle(activeTab === 'daily-great')}
                        onClick={() => setActiveTab('daily-great')}
                    >
                        Daily Great Tasks
                    </button>
                </div>
            </div>

            {/* ── MANAGE TAB ── */}
            {activeTab === 'manage' && (
                <div>
                    {/* Action buttons row */}
                    {!showAddForm && (
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <button
                                onClick={() => { setShowAddForm(true); setEditingId(null); setCsvPreview(null); }}
                                disabled={!environment}
                                title={!environment ? 'Select a specific environment to add an exemplar' : undefined}
                                style={{
                                    padding: '8px 18px',
                                    borderRadius: '8px',
                                    background: 'var(--accent)',
                                    color: '#fff',
                                    fontWeight: 600,
                                    fontSize: '0.85rem',
                                    border: 'none',
                                    cursor: !environment ? 'not-allowed' : 'pointer',
                                    opacity: !environment ? 0.4 : 1,
                                }}
                            >
                                + Add Exemplar
                            </button>
                            <button
                                onClick={() => { fileInputRef.current?.click(); setShowAddForm(false); }}
                                style={{
                                    padding: '8px 18px',
                                    borderRadius: '8px',
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid var(--border)',
                                    color: 'var(--text)',
                                    fontWeight: 600,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                }}
                            >
                                Import CSV
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv,text/csv"
                                style={{ display: 'none' }}
                                onChange={handleFileSelect}
                            />
                            {exemplars.some(e => !e.hasEmbedding) && (
                                <button
                                    onClick={handleEmbedPending}
                                    disabled={embeddingPending}
                                    style={{
                                        padding: '8px 18px',
                                        borderRadius: '8px',
                                        background: 'rgba(234,179,8,0.1)',
                                        border: '1px solid rgba(234,179,8,0.3)',
                                        color: 'rgba(234,179,8,0.9)',
                                        fontWeight: 600,
                                        fontSize: '0.85rem',
                                        cursor: embeddingPending ? 'not-allowed' : 'pointer',
                                        opacity: embeddingPending ? 0.6 : 1,
                                    }}
                                >
                                    {embeddingPending
                                        ? 'Generating…'
                                        : `Generate ${exemplars.filter(e => !e.hasEmbedding).length} Missing Embedding${exemplars.filter(e => !e.hasEmbedding).length !== 1 ? 's' : ''}`}
                                </button>
                            )}
                        </div>
                    )}

                    {/* Import result banner */}
                    {importResult && !csvPreview && (
                        <div style={{
                            marginBottom: '16px',
                            padding: '12px 16px',
                            borderRadius: '8px',
                            background: 'rgba(34,197,94,0.1)',
                            border: '1px solid rgba(34,197,94,0.25)',
                            color: '#22c55e',
                            fontSize: '0.85rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}>
                            <span>
                                Imported {importResult.imported} exemplar{importResult.imported !== 1 ? 's' : ''}.
                                {importResult.skipped > 0 && ` ${importResult.skipped} rows skipped.`}
                                {importResult.embeddingErrors > 0 && (
                                    <span style={{ color: 'rgba(255,180,0,0.9)', marginLeft: '6px' }}>
                                        {importResult.embeddingErrors} embeddings failed.
                                    </span>
                                )}
                            </span>
                            <button
                                onClick={() => setImportResult(null)}
                                style={{ background: 'none', border: 'none', color: 'rgba(34,197,94,0.7)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}
                            >
                                ×
                            </button>
                        </div>
                    )}

                    {/* Embed-pending result */}
                    {embedResult && (
                        <div style={{
                            marginBottom: '16px',
                            padding: '12px 16px',
                            borderRadius: '8px',
                            background: embedResult.failed === 0 ? 'rgba(34,197,94,0.1)' : 'rgba(234,179,8,0.1)',
                            border: `1px solid ${embedResult.failed === 0 ? 'rgba(34,197,94,0.25)' : 'rgba(234,179,8,0.3)'}`,
                            color: embedResult.failed === 0 ? '#22c55e' : 'rgba(234,179,8,0.9)',
                            fontSize: '0.85rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}>
                            <span>
                                Generated {embedResult.succeeded}/{embedResult.processed} embedding{embedResult.processed !== 1 ? 's' : ''}.
                                {embedResult.failed > 0 && ` ${embedResult.failed} failed — check AI provider settings.`}
                            </span>
                            <button
                                onClick={() => setEmbedResult(null)}
                                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1rem', opacity: 0.6 }}
                            >
                                ×
                            </button>
                        </div>
                    )}

                    {/* Import error */}
                    {importError && (
                        <div style={{
                            marginBottom: '16px',
                            padding: '12px 16px',
                            borderRadius: '8px',
                            background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.25)',
                            color: '#ef4444',
                            fontSize: '0.85rem',
                        }}>
                            {importError}
                        </div>
                    )}

                    {/* CSV preview panel */}
                    {csvPreview && !importing && (
                        <div style={{
                            marginBottom: '20px',
                            padding: '16px',
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid var(--border)',
                            borderRadius: '10px',
                        }}>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '12px' }}>
                                CSV Preview — {csvPreview.file.name}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '12px' }}>
                                {csvPreview.totalRows} valid rows across {Object.keys(csvPreview.envCounts).length} environment{Object.keys(csvPreview.envCounts).length !== 1 ? 's' : ''}:
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                                {Object.entries(csvPreview.envCounts).sort().map(([env, count]) => (
                                    <span key={env} style={{
                                        padding: '3px 10px',
                                        borderRadius: '12px',
                                        background: env === environment ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.06)',
                                        border: `1px solid ${env === environment ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
                                        fontSize: '0.8rem',
                                        color: env === environment ? 'rgba(165,180,252,1)' : 'rgba(255,255,255,0.6)',
                                    }}>
                                        {env}: {count}
                                    </span>
                                ))}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {environment && csvPreview.envCounts[environment] && (
                                    <button
                                        onClick={() => handleImport(environment)}
                                        style={{
                                            padding: '8px 16px',
                                            borderRadius: '8px',
                                            background: 'var(--accent)',
                                            color: '#fff',
                                            fontWeight: 600,
                                            fontSize: '0.85rem',
                                            border: 'none',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        Import {csvPreview.envCounts[environment]} rows for "{environment}"
                                    </button>
                                )}
                                <button
                                    onClick={() => handleImport(null)}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '8px',
                                        background: 'rgba(255,255,255,0.06)',
                                        border: '1px solid var(--border)',
                                        color: 'var(--text)',
                                        fontWeight: 600,
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Import all {csvPreview.totalRows} rows
                                </button>
                                <button
                                    onClick={() => setCsvPreview(null)}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '8px',
                                        background: 'transparent',
                                        border: '1px solid transparent',
                                        color: 'rgba(255,255,255,0.4)',
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Importing spinner */}
                    {importing && (
                        <div style={{
                            marginBottom: '20px',
                            padding: '16px',
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid var(--border)',
                            borderRadius: '10px',
                            color: 'rgba(255,255,255,0.6)',
                            fontSize: '0.9rem',
                        }}>
                            Importing and generating embeddings… this may take a moment.
                        </div>
                    )}

                    {/* Inline add form */}
                    {showAddForm && (
                        <div style={{
                            marginBottom: '20px',
                            padding: '16px',
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid var(--border)',
                            borderRadius: '10px',
                        }}>
                            <div style={{ fontWeight: 700, marginBottom: '12px', fontSize: '0.9rem' }}>
                                New Exemplar
                            </div>
                            <ExemplarForm
                                onSave={handleAdd}
                                onCancel={() => setShowAddForm(false)}
                                saving={addSaving}
                            />
                        </div>
                    )}

                    {/* List */}
                    {loadingExemplars ? (
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>Loading…</div>
                    ) : exemplars.length === 0 ? (
                        <div style={{
                            padding: '32px',
                            textAlign: 'center',
                            color: 'rgba(255,255,255,0.3)',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px dashed var(--border)',
                            borderRadius: '10px',
                        }}>
                            No exemplars yet. Add one above.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {exemplars.map(e => (
                                <ExemplarCard
                                    key={e.id}
                                    exemplar={e}
                                    onEdit={(ex) => { setEditingId(ex.id); setShowAddForm(false); }}
                                    onDelete={handleDelete}
                                    editingId={editingId}
                                    onSaveEdit={handleSaveEdit}
                                    onCancelEdit={() => setEditingId(null)}
                                    saving={editSaving}
                                    showEnvironment={!environment}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── COMPARE TAB ── */}
            {activeTab === 'compare' && !environment && (
                <div style={{
                    padding: '32px',
                    textAlign: 'center',
                    color: 'rgba(255,255,255,0.4)',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                }}>
                    Select a specific environment to run a comparison.
                </div>
            )}
            {/* ── DAILY GREAT TASKS TAB ── */}
            {activeTab === 'daily-great' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

                    {/* Section 1: Search & Flag */}
                    <div>
                        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px' }}>Search & Flag by Task Key</h2>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                            <input
                                type="text"
                                value={dgSearchKey}
                                onChange={e => setDgSearchKey(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleDgSearch(); }}
                                placeholder="Enter task key…"
                                style={{
                                    flex: 1,
                                    minWidth: '200px',
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid var(--border)',
                                    color: 'var(--text)',
                                    fontSize: '0.9rem',
                                    outline: 'none',
                                }}
                            />
                            <button
                                onClick={handleDgSearch}
                                disabled={dgSearching || !dgSearchKey.trim()}
                                style={{
                                    padding: '8px 18px',
                                    borderRadius: '8px',
                                    background: 'var(--accent)',
                                    color: '#fff',
                                    fontWeight: 600,
                                    fontSize: '0.85rem',
                                    border: 'none',
                                    cursor: (dgSearching || !dgSearchKey.trim()) ? 'not-allowed' : 'pointer',
                                    opacity: (dgSearching || !dgSearchKey.trim()) ? 0.5 : 1,
                                }}
                            >
                                {dgSearching ? 'Searching…' : 'Search'}
                            </button>
                        </div>

                        {dgSearchError && (
                            <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '12px' }}>{dgSearchError}</div>
                        )}

                        {dgSearchResults.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {dgSearchResults.map(r => (
                                    <div
                                        key={r.id}
                                        style={{
                                            background: 'rgba(255,255,255,0.04)',
                                            border: '1px solid var(--border)',
                                            borderRadius: '10px',
                                            padding: '12px 16px',
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: '12px',
                                        }}
                                    >
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                                                {r.taskKey && (
                                                    <span style={{
                                                        fontFamily: 'monospace',
                                                        fontSize: '0.8rem',
                                                        color: 'rgba(165,180,252,0.9)',
                                                        background: 'rgba(99,102,241,0.12)',
                                                        border: '1px solid rgba(99,102,241,0.3)',
                                                        borderRadius: '5px',
                                                        padding: '1px 7px',
                                                    }}>
                                                        {r.taskKey}
                                                    </span>
                                                )}
                                                <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>
                                                    {r.environment} · {r.createdByName || r.createdByEmail || 'Unknown'}
                                                </span>
                                                {r.isDailyGreat && (
                                                    <span style={{
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600,
                                                        color: '#d97706',
                                                        background: 'rgba(217,119,6,0.12)',
                                                        border: '1px solid rgba(217,119,6,0.3)',
                                                        borderRadius: '5px',
                                                        padding: '1px 7px',
                                                    }}>
                                                        Daily Great
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>
                                                {r.snippet}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDgToggle(r.id, !r.isDailyGreat)}
                                            disabled={dgTogglingId === r.id}
                                            style={{
                                                flexShrink: 0,
                                                padding: '5px 12px',
                                                borderRadius: '6px',
                                                fontSize: '0.8rem',
                                                fontWeight: 600,
                                                cursor: dgTogglingId === r.id ? 'not-allowed' : 'pointer',
                                                opacity: dgTogglingId === r.id ? 0.5 : 1,
                                                background: r.isDailyGreat ? 'rgba(239,68,68,0.08)' : 'rgba(217,119,6,0.12)',
                                                border: r.isDailyGreat ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(217,119,6,0.3)',
                                                color: r.isDailyGreat ? '#ef4444' : '#d97706',
                                            }}
                                        >
                                            {r.isDailyGreat ? 'Unflag' : 'Flag'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {dgSearchResults.length === 0 && !dgSearching && dgSearchKey && !dgSearchError && (
                            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem' }}>
                                No records found with task key "{dgSearchKey}".
                            </div>
                        )}
                    </div>

                    {/* Section 2: Currently Flagged */}
                    <div>
                        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px' }}>
                            Currently Flagged
                            {!dgLoadingFlagged && dgFlaggedTotal > 0 && (
                                <span style={{ marginLeft: '8px', fontSize: '0.8rem', fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>
                                    ({dgFlaggedTotal})
                                </span>
                            )}
                        </h2>

                        {dgFlaggedError && (
                            <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '12px' }}>{dgFlaggedError}</div>
                        )}

                        {dgLoadingFlagged ? (
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>Loading…</div>
                        ) : dgFlagged.length === 0 ? (
                            <div style={{
                                padding: '24px',
                                textAlign: 'center',
                                color: 'rgba(255,255,255,0.3)',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px dashed var(--border)',
                                borderRadius: '10px',
                                fontSize: '0.9rem',
                            }}>
                                No daily great tasks flagged yet. Search above to flag records.
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                            {['Task Key', 'Snippet', 'Environment', 'Creator', 'Flagged', ''].map(h => (
                                                <th key={h} style={{
                                                    padding: '8px 12px',
                                                    textAlign: 'left',
                                                    color: 'rgba(255,255,255,0.45)',
                                                    fontWeight: 600,
                                                    fontSize: '0.72rem',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.05em',
                                                    whiteSpace: 'nowrap',
                                                }}>
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dgFlagged.map(r => (
                                            <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                                <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                                                    {r.taskKey ? (
                                                        <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'rgba(165,180,252,0.9)' }}>
                                                            {r.taskKey}
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.75rem' }}>—</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '10px 12px', maxWidth: '320px' }}>
                                                    <div style={{
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        display: '-webkit-box',
                                                        WebkitLineClamp: 2,
                                                        WebkitBoxOrient: 'vertical',
                                                        color: 'rgba(255,255,255,0.7)',
                                                        lineHeight: 1.4,
                                                    }}>
                                                        {r.snippet}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: 'rgba(255,255,255,0.55)' }}>
                                                    {r.environment}
                                                </td>
                                                <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: 'rgba(255,255,255,0.55)' }}>
                                                    {r.createdByName || r.createdByEmail || '—'}
                                                </td>
                                                <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>
                                                    {new Date(r.createdAt).toLocaleDateString()}
                                                </td>
                                                <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                                                    <button
                                                        onClick={() => handleDgToggle(r.id, false)}
                                                        disabled={dgTogglingId === r.id}
                                                        style={{
                                                            padding: '4px 10px',
                                                            borderRadius: '6px',
                                                            fontSize: '0.78rem',
                                                            fontWeight: 600,
                                                            cursor: dgTogglingId === r.id ? 'not-allowed' : 'pointer',
                                                            opacity: dgTogglingId === r.id ? 0.5 : 1,
                                                            background: 'rgba(239,68,68,0.08)',
                                                            border: '1px solid rgba(239,68,68,0.3)',
                                                            color: '#ef4444',
                                                        }}
                                                    >
                                                        Unflag
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Pagination */}
                        {dgFlaggedTotal > DG_LIMIT && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                                <button
                                    onClick={() => setDgFlaggedPage(p => Math.max(1, p - 1))}
                                    disabled={dgFlaggedPage === 1 || dgLoadingFlagged}
                                    style={{
                                        padding: '5px 10px',
                                        borderRadius: '6px',
                                        background: 'rgba(255,255,255,0.06)',
                                        border: '1px solid var(--border)',
                                        color: dgFlaggedPage === 1 ? 'rgba(255,255,255,0.2)' : 'var(--text)',
                                        cursor: dgFlaggedPage === 1 || dgLoadingFlagged ? 'not-allowed' : 'pointer',
                                        fontSize: '0.85rem',
                                    }}
                                >
                                    ← Prev
                                </button>
                                <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)' }}>
                                    Page {dgFlaggedPage} of {Math.ceil(dgFlaggedTotal / DG_LIMIT)}
                                </span>
                                <button
                                    onClick={() => setDgFlaggedPage(p => Math.min(Math.ceil(dgFlaggedTotal / DG_LIMIT), p + 1))}
                                    disabled={dgFlaggedPage >= Math.ceil(dgFlaggedTotal / DG_LIMIT) || dgLoadingFlagged}
                                    style={{
                                        padding: '5px 10px',
                                        borderRadius: '6px',
                                        background: 'rgba(255,255,255,0.06)',
                                        border: '1px solid var(--border)',
                                        color: dgFlaggedPage >= Math.ceil(dgFlaggedTotal / DG_LIMIT) ? 'rgba(255,255,255,0.2)' : 'var(--text)',
                                        cursor: dgFlaggedPage >= Math.ceil(dgFlaggedTotal / DG_LIMIT) || dgLoadingFlagged ? 'not-allowed' : 'pointer',
                                        fontSize: '0.85rem',
                                    }}
                                >
                                    Next →
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Section 3: On-Demand Compare */}
                    <div>
                        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px' }}>On-Demand Compare</h2>
                        <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.45)', marginBottom: '16px' }}>
                            Compare all tasks in an environment against the flagged daily great records.
                        </p>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                            <select
                                value={dgCompareEnv}
                                onChange={e => { setDgCompareEnv(e.target.value); setDgCompareResult(null); setDgCompareError(''); }}
                                style={{
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid var(--border)',
                                    color: 'var(--text)',
                                    fontSize: '0.9rem',
                                    outline: 'none',
                                    minWidth: '180px',
                                }}
                            >
                                <option value="">Select environment…</option>
                                {/* Populate from flagged environments */}
                                {[...new Set(dgFlagged.map(r => r.environment))].sort().map(env => (
                                    <option key={env} value={env}>{env}</option>
                                ))}
                            </select>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
                                Threshold
                                <input
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={dgThreshold}
                                    onChange={e => setDgThreshold(Number(e.target.value))}
                                    style={{
                                        width: '60px',
                                        padding: '6px 10px',
                                        borderRadius: '6px',
                                        background: 'rgba(255,255,255,0.06)',
                                        border: '1px solid var(--border)',
                                        color: 'var(--text)',
                                        fontSize: '0.9rem',
                                        textAlign: 'center',
                                        outline: 'none',
                                    }}
                                />
                                <span style={{ color: 'rgba(255,255,255,0.5)' }}>%</span>
                            </label>

                            <button
                                onClick={handleDgCompare}
                                disabled={dgComparing || !dgCompareEnv || dgFlagged.length === 0}
                                style={{
                                    padding: '8px 20px',
                                    borderRadius: '8px',
                                    background: 'var(--accent)',
                                    color: '#fff',
                                    fontWeight: 600,
                                    fontSize: '0.85rem',
                                    border: 'none',
                                    cursor: (dgComparing || !dgCompareEnv || dgFlagged.length === 0) ? 'not-allowed' : 'pointer',
                                    opacity: (dgComparing || !dgCompareEnv || dgFlagged.length === 0) ? 0.5 : 1,
                                }}
                            >
                                {dgComparing ? 'Running…' : 'Run Comparison'}
                            </button>
                        </div>

                        {dgCompareError && (
                            <div style={{
                                padding: '12px 16px',
                                borderRadius: '8px',
                                background: 'rgba(239,68,68,0.1)',
                                border: '1px solid rgba(239,68,68,0.25)',
                                color: '#ef4444',
                                fontSize: '0.85rem',
                                marginBottom: '16px',
                            }}>
                                {dgCompareError}
                            </div>
                        )}

                        {dgCompareResult && (
                            <div>
                                <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: '16px' }}>
                                    Compared {dgCompareResult.totalTasks} task{dgCompareResult.totalTasks !== 1 ? 's' : ''} against {dgCompareResult.totalDailyGreat} daily great record{dgCompareResult.totalDailyGreat !== 1 ? 's' : ''}.
                                    {dgCompareResult.missingEmbeddings > 0 && (
                                        <span style={{ color: 'rgba(255,180,0,0.7)', marginLeft: '8px' }}>
                                            {dgCompareResult.missingEmbeddings} daily great record{dgCompareResult.missingEmbeddings !== 1 ? 's' : ''} skipped (no embedding).
                                        </span>
                                    )}
                                    {' '}Found <strong style={{ color: 'var(--text)' }}>{dgCompareResult.matches.length}</strong> match{dgCompareResult.matches.length !== 1 ? 'es' : ''} above {dgThreshold}%.
                                </div>

                                {dgCompareResult.matches.length === 0 ? (
                                    <div style={{
                                        padding: '32px',
                                        textAlign: 'center',
                                        color: 'rgba(255,255,255,0.3)',
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px dashed var(--border)',
                                        borderRadius: '10px',
                                    }}>
                                        {dgCompareResult.totalTasks === 0
                                            ? 'No tasks with embeddings found in this environment.'
                                            : `No tasks matched above ${dgThreshold}% threshold.`
                                        }
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {dgCompareResult.matches.map((match, i) => {
                                            const key = match.taskId + i;
                                            const isExpanded = dgExpandedId === key;
                                            return (
                                                <div
                                                    key={key}
                                                    style={{
                                                        background: 'rgba(255,255,255,0.04)',
                                                        border: '1px solid var(--border)',
                                                        borderRadius: '10px',
                                                        padding: '14px 16px',
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                                        <ScoreBadge score={match.similarity} />
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '6px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                                                                {(match.taskAuthor || match.taskEmail) && (
                                                                    <span>
                                                                        {match.taskAuthor || match.taskEmail}
                                                                        {match.taskAuthor && match.taskEmail && (
                                                                            <span style={{ marginLeft: '4px', opacity: 0.6 }}>({match.taskEmail})</span>
                                                                        )}
                                                                    </span>
                                                                )}
                                                                <span style={{ fontFamily: 'monospace', opacity: 0.6 }}>
                                                                    ID: {match.taskId.length > 16 ? match.taskId.slice(0, 16) + '…' : match.taskId}
                                                                </span>
                                                            </div>
                                                            <div
                                                                style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.75)', marginBottom: '8px', cursor: 'pointer', lineHeight: 1.5 }}
                                                                onClick={() => setDgExpandedId(prev => prev === key ? null : key)}
                                                            >
                                                                {isExpanded ? match.taskContent : (
                                                                    match.taskContent.length > 200
                                                                        ? match.taskContent.slice(0, 200) + '…'
                                                                        : match.taskContent
                                                                )}
                                                                {match.taskContent.length > 200 && (
                                                                    <span style={{ color: 'var(--accent)', fontSize: '0.8rem', marginLeft: '6px', fontWeight: 600 }}>
                                                                        {isExpanded ? 'Show less' : 'Show more'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.8rem' }}>
                                                                <span style={{ color: '#d97706', fontWeight: 700, flexShrink: 0 }}>→ Daily Great</span>
                                                                <div style={{ color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                                                                    {match.exemplarTaskKey && (
                                                                        <span style={{ fontFamily: 'monospace', marginRight: '6px', color: 'rgba(165,180,252,0.7)' }}>
                                                                            [{match.exemplarTaskKey}]
                                                                        </span>
                                                                    )}
                                                                    {match.exemplarContent.length > 120
                                                                        ? match.exemplarContent.slice(0, 120) + '…'
                                                                        : match.exemplarContent}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'compare' && environment && (
                <div>
                    {/* Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
                            Similarity threshold
                            <input
                                type="number"
                                min={1}
                                max={100}
                                value={threshold}
                                onChange={e => setThreshold(Number(e.target.value))}
                                style={{
                                    width: '64px',
                                    padding: '6px 10px',
                                    borderRadius: '6px',
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid var(--border)',
                                    color: 'var(--text)',
                                    fontSize: '0.9rem',
                                    textAlign: 'center',
                                    outline: 'none',
                                }}
                            />
                            <span style={{ color: 'rgba(255,255,255,0.5)' }}>%</span>
                        </label>

                        <button
                            onClick={handleCompare}
                            disabled={comparing || exemplars.length === 0 || !hasExemplarsWithEmbedding}
                            title={
                                exemplars.length === 0
                                    ? 'No exemplars in this environment'
                                    : !hasExemplarsWithEmbedding
                                        ? 'No exemplars have embeddings yet'
                                        : undefined
                            }
                            style={{
                                padding: '8px 20px',
                                borderRadius: '8px',
                                background: 'var(--accent)',
                                color: '#fff',
                                fontWeight: 600,
                                fontSize: '0.85rem',
                                border: 'none',
                                cursor: (comparing || exemplars.length === 0 || !hasExemplarsWithEmbedding) ? 'not-allowed' : 'pointer',
                                opacity: (comparing || exemplars.length === 0 || !hasExemplarsWithEmbedding) ? 0.5 : 1,
                            }}
                        >
                            {comparing ? 'Running…' : 'Run Comparison'}
                        </button>
                    </div>

                    {/* Warn about no exemplars */}
                    {exemplars.length === 0 && (
                        <div style={{ color: 'rgba(255,180,0,0.8)', fontSize: '0.85rem', marginBottom: '16px' }}>
                            No exemplars in this environment. Switch to the Manage tab to add some.
                        </div>
                    )}
                    {exemplars.length > 0 && !hasExemplarsWithEmbedding && (
                        <div style={{ color: 'rgba(255,180,0,0.8)', fontSize: '0.85rem', marginBottom: '16px' }}>
                            Exemplars exist but none have embeddings yet. Edit or re-save an exemplar to generate one.
                        </div>
                    )}

                    {/* Error */}
                    {compareError && (
                        <div style={{
                            padding: '12px 16px',
                            borderRadius: '8px',
                            background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.25)',
                            color: '#ef4444',
                            fontSize: '0.85rem',
                            marginBottom: '16px',
                        }}>
                            {compareError}
                        </div>
                    )}

                    {/* Results */}
                    {compareResult && (
                        <div>
                            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: '16px' }}>
                                Compared {compareResult.totalTasks} task{compareResult.totalTasks !== 1 ? 's' : ''} against {compareResult.totalExemplars} exemplar{compareResult.totalExemplars !== 1 ? 's' : ''}.
                                {compareResult.missingEmbeddings > 0 && (
                                    <span style={{ color: 'rgba(255,180,0,0.7)', marginLeft: '8px' }}>
                                        {compareResult.missingEmbeddings} exemplar{compareResult.missingEmbeddings !== 1 ? 's' : ''} skipped (no embedding).
                                    </span>
                                )}
                                {compareResult.tasksSkippedNoParse > 0 && (
                                    <span style={{ color: 'rgba(255,180,0,0.7)', marginLeft: '8px' }}>
                                        {compareResult.tasksSkippedNoParse} task{compareResult.tasksSkippedNoParse !== 1 ? 's' : ''} skipped (bad vector).
                                    </span>
                                )}
                                {' '}Found <strong style={{ color: 'var(--text)' }}>{compareResult.matches.length}</strong> match{compareResult.matches.length !== 1 ? 'es' : ''} above {threshold}%.
                            </div>

                            {compareResult.matches.length === 0 ? (
                                <div style={{
                                    padding: '32px',
                                    textAlign: 'center',
                                    color: 'rgba(255,255,255,0.3)',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px dashed var(--border)',
                                    borderRadius: '10px',
                                }}>
                                    {compareResult.totalTasks === 0
                                        ? 'No tasks with embeddings found in this environment. Make sure data has been ingested and vectorized.'
                                        : compareResult.tasksSkippedNoParse === compareResult.totalTasks
                                            ? 'All task vectors failed to parse. Try re-vectorizing your data records.'
                                            : `No tasks matched above ${threshold}% threshold.`
                                    }
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {compareResult.matches.map((match, i) => {
                                        const isExpanded = expandedTaskId === match.taskId + i;
                                        return (
                                            <div
                                                key={match.taskId + i}
                                                style={{
                                                    background: 'rgba(255,255,255,0.04)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: '10px',
                                                    padding: '14px 16px',
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                                    <ScoreBadge score={match.similarity} />
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        {/* Author / email / ID metadata */}
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '6px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                                                            {(match.taskAuthor || match.taskEmail) && (
                                                                <span>
                                                                    {match.taskAuthor || match.taskEmail}
                                                                    {match.taskAuthor && match.taskEmail && (
                                                                        <span style={{ marginLeft: '4px', opacity: 0.6 }}>({match.taskEmail})</span>
                                                                    )}
                                                                </span>
                                                            )}
                                                            <span style={{ fontFamily: 'monospace', opacity: 0.6 }} title={match.taskId}>
                                                                ID: {match.taskId.length > 16 ? match.taskId.slice(0, 16) + '…' : match.taskId}
                                                            </span>
                                                        </div>

                                                        {/* Task content */}
                                                        <div
                                                            style={{
                                                                fontSize: '0.85rem',
                                                                color: 'rgba(255,255,255,0.75)',
                                                                marginBottom: '8px',
                                                                cursor: 'pointer',
                                                                lineHeight: 1.5,
                                                            }}
                                                            onClick={() => setExpandedTaskId(prev => prev === match.taskId + i ? null : match.taskId + i)}
                                                        >
                                                            {isExpanded ? match.taskContent : (
                                                                match.taskContent.length > 200
                                                                    ? match.taskContent.slice(0, 200) + '…'
                                                                    : match.taskContent
                                                            )}
                                                            {match.taskContent.length > 200 && (
                                                                <span style={{ color: 'var(--accent)', fontSize: '0.8rem', marginLeft: '6px', fontWeight: 600 }}>
                                                                    {isExpanded ? 'Show less' : 'Show more'}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Arrow + matched exemplar */}
                                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.8rem' }}>
                                                            <span style={{ color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>→</span>
                                                            <div style={{ color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                                                                {match.exemplarContent.length > 120
                                                                    ? match.exemplarContent.slice(0, 120) + '…'
                                                                    : match.exemplarContent}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
