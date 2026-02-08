'use client';

import { useState, useEffect } from 'react';
import { Trash2, Database, RefreshCcw, Sparkles, AlertTriangle, Loader2, XCircle, CheckCircle2, Cloud, Server, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface Project {
    id: string;
    name: string;
}

interface AnalyticsJob {
    id: string;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
    totalRecords: number;
    processedCount: number;
    error?: string;
    createdAt: string;
}

interface SystemInfo {
    database: { host: string; port: string };
    ai: {
        provider: string;
        host: string;
        llmModel: string;
        embeddingModel: string;
    };
}

export default function AdminConsole() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [clearing, setClearing] = useState(false);
    const [bulkAligning, setBulkAligning] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error' | 'warning', message: string } | null>(null);
    const [activeJob, setActiveJob] = useState<AnalyticsJob | null>(null);
    const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchSystemInfo = async () => {
        try {
            const res = await fetch('/api/admin/info');
            if (res.ok) setSystemInfo(await res.json());
        } catch (err) {
            console.error('Failed to fetch system info', err);
        } finally {
            setLoading(false);
        }
    };

    // Fetch projects and system info on load
    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const res = await fetch('/api/projects');
                const data = await res.json();
                const projectsArray = Array.isArray(data) ? data : (data.projects || []);
                setProjects(projectsArray);
                if (projectsArray.length > 0) {
                    setSelectedProjectId(projectsArray[0].id);
                }
            } catch (err) {
                console.error('Failed to fetch projects', err);
            }
        };

        fetchProjects();
        fetchSystemInfo();
    }, []);

    // Polling for active job status
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (selectedProjectId) {
            // Initial fetch of jobs
            const fetchJobs = async () => {
                const res = await fetch(`/api/admin/bulk-align?projectId=${selectedProjectId}`);
                const data = await res.json();
                if (res.ok && data.length > 0) {
                    const latest = data[0];
                    setActiveJob(latest);
                    if (['PENDING', 'PROCESSING'].includes(latest.status)) {
                        setBulkAligning(true);
                    }
                }
            };
            fetchJobs();

            interval = setInterval(async () => {
                try {
                    const res = await fetch(`/api/admin/bulk-align?projectId=${selectedProjectId}`);
                    const data = await res.json();
                    if (res.ok && data.length > 0) {
                        const latestJob = data[0];
                        setActiveJob(latestJob);
                        if (!['PENDING', 'PROCESSING'].includes(latestJob.status)) {
                            setBulkAligning(false);
                        } else {
                            setBulkAligning(true);
                        }
                    }
                } catch (err) {
                    console.error('Polling error', err);
                }
            }, 3000); // Poll every 3 seconds for bulk jobs (LLM work is slower than ingestion)
        }
        return () => clearInterval(interval);
    }, [selectedProjectId]);

    const handleClear = async (target: 'ALL_DATA' | 'ANALYTICS_ONLY') => {
        const confirmMsg = target === 'ALL_DATA'
            ? "Are you absolutely sure? This will delete ALL Tasks and Feedback records across ALL projects."
            : "Clear all saved LLM Analysis results? Data records will be kept.";

        if (!confirm(confirmMsg)) return;

        setClearing(true);
        setStatus(null);

        try {
            const res = await fetch('/api/admin/clear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target }),
            });

            const data = await res.json();
            if (res.ok) {
                setStatus({ type: 'success', message: data.message });
            } else {
                setStatus({ type: 'error', message: data.error || 'Operation failed' });
            }
        } catch (err) {
            setStatus({ type: 'error', message: 'A network error occurred.' });
        } finally {
            setClearing(false);
        }
    };

    /**
     * BULK ALIGNMENT TRIGGER
     * Starts a background process to score all records that haven't been analyzed yet.
     */
    const handleBulkAlign = async () => {
        if (!selectedProjectId) return;

        setBulkAligning(true);
        setStatus(null);

        try {
            const res = await fetch('/api/admin/bulk-align', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: selectedProjectId }),
            });

            const data = await res.json();
            if (res.ok) {
                if (data.jobId) {
                    setStatus({ type: 'warning', message: 'Bulk alignment job started.' });
                } else {
                    setStatus({ type: 'success', message: data.message || 'No records found needing alignment check.' });
                    setBulkAligning(false);
                }
            } else {
                setStatus({ type: 'error', message: data.error || 'Operation failed' });
                setBulkAligning(false);
            }
        } catch (err) {
            setStatus({ type: 'error', message: 'A network error occurred.' });
            setBulkAligning(false);
        }
    };

    const cancelJob = async (jobId: string) => {
        try {
            await fetch('/api/admin/bulk-align/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobId }),
            });
        } catch (err) {
            console.error('Failed to cancel job', err);
        }
    };

    return (
        <div>
            <header style={{ marginBottom: '32px' }}>
                <h1 className="premium-gradient" style={{ fontSize: '2rem', marginBottom: '8px' }}>
                    System Configuration
                </h1>
                <p style={{ color: 'rgba(255,255,255,0.6)' }}>AI settings, bulk operations, and data maintenance</p>
            </header>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {status && (
                    <div className="glass-card" style={{
                        padding: '16px 24px',
                        border: `1px solid ${status.type === 'success' ? 'var(--success)' : status.type === 'warning' ? 'var(--accent)' : '#ff4d4d'}`,
                        background: `${status.type === 'success' ? 'rgba(0,255,136,0.05)' : status.type === 'warning' ? 'rgba(0,112,243,0.05)' : 'rgba(255,77,77,0.05)'}`,
                        color: status.type === 'success' ? '#00ff88' : status.type === 'warning' ? 'var(--accent)' : '#ff4d4d'
                    }}>
                        {status.message}
                    </div>
                )}

                {/* SYSTEM INFO */}
                {systemInfo && (
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 10px #00ff88' }}></div>
                            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>System Status</h2>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px' }}>
                                <h3 style={{ fontSize: '0.9rem', opacity: 0.5, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Database</h3>
                                <div style={{ fontSize: '1rem', marginBottom: '4px' }}>PostgreSQL</div>
                                <div style={{ fontSize: '0.85rem', opacity: 0.6, fontFamily: 'monospace' }}>
                                    {systemInfo.database.host}:{systemInfo.database.port}
                                </div>
                            </div>

                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <h3 style={{ fontSize: '0.9rem', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>AI Provider</h3>
                                    <Link
                                        href="/admin/ai-settings"
                                        style={{
                                            background: 'none', border: '1px solid rgba(255,255,255,0.1)',
                                            padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', color: 'var(--foreground)',
                                            display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem',
                                            textDecoration: 'none'
                                        }}
                                    >
                                        <ArrowRight size={14} /> Configure AI
                                    </Link>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                    {systemInfo.ai.provider === 'OpenRouter' ? (
                                        <div style={{ padding: '8px', borderRadius: '6px', background: 'rgba(0,112,243,0.1)', color: '#0070f3' }}>
                                            <Cloud size={20} />
                                        </div>
                                    ) : (
                                        <div style={{ padding: '8px', borderRadius: '6px', background: 'rgba(0,255,136,0.1)', color: '#00ff88' }}>
                                            <Server size={20} />
                                        </div>
                                    )}
                                    <div>
                                        <div style={{ fontSize: '1rem', fontWeight: 600 }}>{systemInfo.ai.provider}</div>
                                        <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{systemInfo.ai.host}</div>
                                    </div>
                                </div>

                                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '4px' }}>
                                        <span style={{ opacity: 0.5 }}>Chat:</span> {systemInfo.ai.llmModel}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                                        <span style={{ opacity: 0.5 }}>Embed:</span> {systemInfo.ai.embeddingModel}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* PROJECT SELECTION FOR BULK WORK */}
                <div className="glass-card" style={{ padding: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                        <Database size={24} color="var(--accent)" />
                        <h2 style={{ fontSize: '1.5rem' }}>Project Context</h2>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', opacity: 0.6 }}>Select Project to Manage</label>
                        <select
                            value={selectedProjectId}
                            onChange={(e) => setSelectedProjectId(e.target.value)}
                            style={{
                                width: '100%',
                                background: 'rgba(255,255,255,0.05)',
                                color: 'white',
                                border: '1px solid var(--border)',
                                padding: '12px',
                                borderRadius: '8px',
                                outline: 'none'
                            }}
                        >
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Bulk Alignment Tool */}
                    <div style={{ padding: '24px', background: 'rgba(0,112,243,0.05)', borderRadius: '12px', border: '1px solid rgba(0,112,243,0.1)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <Sparkles size={20} color="var(--accent)" />
                            <h3 style={{ margin: 0 }}>Bulk Alignment Scoring</h3>
                        </div>
                        <p style={{ fontSize: '0.9rem', opacity: 0.7, lineHeight: '1.6', marginBottom: '20px' }}>
                            Iterates through all records in the selected project that do not have an alignment score and generates them using the project guidelines.
                        </p>

                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', padding: '16px', background: 'rgba(255,170,0,0.1)', borderRadius: '8px', border: '1px solid rgba(255,170,0,0.2)', marginBottom: '24px' }}>
                            <AlertTriangle size={24} color="#ffaa00" style={{ flexShrink: 0 }} />
                            <div>
                                <h4 style={{ margin: '0 0 4px 0', color: '#ffaa00', fontSize: '0.9rem' }}>Resource Warning</h4>
                                <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.8, lineHeight: '1.4' }}>
                                    This is a long process that can take a significant amount of time (minutes to hours depending on data size).
                                    It will consume substantial CPU/GPU resources on your local AI host. Ensure LM Studio is active and stable before starting.
                                </p>
                            </div>
                        </div>

                        {activeJob && (activeJob.status === 'PROCESSING' || activeJob.status === 'PENDING') ? (
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                                    <span>Progress: {activeJob.processedCount} / {activeJob.totalRecords}</span>
                                    <span>{Math.round((activeJob.processedCount / activeJob.totalRecords) * 100)}%</span>
                                </div>
                                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden', marginBottom: '16px' }}>
                                    <div style={{
                                        height: '100%',
                                        width: `${(activeJob.processedCount / activeJob.totalRecords) * 100}%`,
                                        background: 'var(--accent-gradient)',
                                        transition: 'width 0.3s ease'
                                    }}></div>
                                </div>
                                <button
                                    onClick={() => cancelJob(activeJob.id)}
                                    style={{ background: 'rgba(255,77,77,0.1)', color: '#ff4d4d', border: '1px solid rgba(255,77,77,0.2)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}
                                >
                                    Stop Process
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={handleBulkAlign}
                                disabled={bulkAligning || !selectedProjectId}
                                className="btn-primary"
                                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            >
                                {bulkAligning ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                                Generate All Alignment Scores
                            </button>
                        )}

                        {activeJob && activeJob.status === 'COMPLETED' && (
                            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)', fontSize: '0.85rem' }}>
                                <CheckCircle2 size={16} /> Bulk alignment complete. {activeJob.totalRecords} records processed.
                            </div>
                        )}
                        {activeJob && activeJob.status === 'FAILED' && (
                            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#ff4d4d', fontSize: '0.85rem' }}>
                                <XCircle size={16} /> Job failed: {activeJob.error}
                            </div>
                        )}
                    </div>
                </div>

                {/* Danger Zone */}
                <div className="glass-card" style={{ padding: '32px', border: '1px solid rgba(255,77,77,0.3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <Trash2 size={24} color="#ff4d4d" />
                        <h2 style={{ fontSize: '1.5rem', color: '#ff4d4d' }}>Danger Zone</h2>
                    </div>

                    {/* Clear Analytics Results */}
                    <div style={{ marginBottom: '32px', paddingBottom: '32px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>Clear Analytics Results</h3>
                        <p style={{ opacity: 0.6, marginBottom: '16px', lineHeight: '1.6', fontSize: '0.9rem' }}>
                            Reset saved AI insights across all projects. This will clear the "last analysis" cache but leave your ingested records untouched.
                        </p>
                        <button
                            onClick={() => handleClear('ANALYTICS_ONLY')}
                            disabled={clearing}
                            style={{
                                padding: '10px 20px',
                                borderRadius: '8px',
                                border: '1px solid rgba(255,77,77,0.3)',
                                background: 'rgba(255,77,77,0.1)',
                                color: '#ff4d4d',
                                fontWeight: 600,
                                cursor: 'pointer',
                                opacity: clearing ? 0.5 : 1
                            }}
                        >
                            {clearing ? <RefreshCcw className="spinner" size={18} /> : 'Clear All Analytics Results'}
                        </button>
                    </div>

                    {/* Wipe All Data */}
                    <div>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>Wipe All Data</h3>
                        <p style={{ opacity: 0.6, marginBottom: '16px', lineHeight: '1.6', fontSize: '0.9rem' }}>
                            Permanently delete all ingested Tasks, Feedback, similarity data, and Likert ratings from the database. This action is irreversible. Projects and LLM model usage stats will be preserved, but all records and ratings will be wiped.
                        </p>
                        <button
                            onClick={() => handleClear('ALL_DATA')}
                            disabled={clearing}
                            style={{
                                padding: '12px 24px',
                                borderRadius: '8px',
                                border: 'none',
                                background: '#ff4d4d',
                                color: 'white',
                                fontWeight: 700,
                                cursor: 'pointer',
                                opacity: clearing ? 0.5 : 1
                            }}
                        >
                            {clearing ? <RefreshCcw className="spinner" size={18} /> : 'Wipe All Data & Analytics'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
