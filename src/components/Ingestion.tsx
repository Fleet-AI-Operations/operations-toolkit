/**
 * INGESTION UI COMPONENT
 * Handles multi-source data ingestion (CSV/API) with a focus on 
 * background job management, real-time progress polling, and sequential queuing.
 */
'use client';

import { useState, useEffect, useRef } from 'react';
import { Upload, Folder, LayoutDashboard, FileText, Globe2, CheckCircle2, AlertCircle, Loader2, History, HardHat, Construction, Clock } from 'lucide-react';
import Link from 'next/link';

interface Project {
    id: string;
    name: string;
}

/**
 * IngestJob Interface
 * Mirrors the Prisma model. Tracks progression from PENDING -> PROCESSING -> COMPLETED/FAILED.
 */
interface IngestJob {
    id: string;
    status: 'PENDING' | 'PROCESSING' | 'QUEUED_FOR_VEC' | 'VECTORIZING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
    totalRecords: number;
    savedCount: number;
    skippedCount: number;
    error?: string;
    updatedAt: string;
    createdAt: string;
    type: string;
    skippedDetails?: Record<string, number>;
}

export default function IngestionPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'CSV' | 'API'>('CSV');

    // Shared Ingest State: Tracks the visual feedback of the "Upload" action itself.
    const [ingestType, setIngestType] = useState<'TASK' | 'FEEDBACK'>('TASK');
    const [uploading, setUploading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    // Background Job State: Handles the long-running database processes.
    const [activeJob, setActiveJob] = useState<IngestJob | null>(null);
    const [recentJobs, setRecentJobs] = useState<IngestJob[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [apiUrl, setApiUrl] = useState('');

    /**
     * RECOVERY LOGIC: fetchRecentJobs
     * Pulls the last 5 jobs for the project. 
     * If it finds any job that is still PENDING or PROCESSING, it automatically 
     * promotes it to 'activeJob' so the UI can start polling immediately.
     */
    const fetchRecentJobs = async (projectId: string) => {
        try {
            const res = await fetch(`/api/ingest/jobs?projectId=${projectId}`);
            const data = await res.json();
            if (res.ok) {
                setRecentJobs(data);

                // Prioritize finding a job that is already running or loading data
                const runningJob = data.find((j: IngestJob) => j.status === 'PROCESSING' || j.status === 'VECTORIZING');
                const pendingJob = !runningJob ? data.find((j: IngestJob) => j.status === 'PENDING' || j.status === 'QUEUED_FOR_VEC') : null;

                if (runningJob || pendingJob) {
                    setActiveJob(runningJob || pendingJob);
                } else if (activeJob) {
                    // Update active job with its latest status from the list
                    const latestActive = data.find((j: IngestJob) => j.id === activeJob.id);
                    if (latestActive) {
                        setActiveJob(latestActive);
                    }
                }
            }
        } catch (err) {
            console.error('Failed to fetch recent jobs', err);
        }
    };

    /**
     * POLLING LOOP: useEffect
     * As long as there is an active job or any job in the list is PENDING/PROCESSING,
     * we poll the server every 2 seconds to update the progress bars.
     */
    useEffect(() => {
        let interval: NodeJS.Timeout;
        const hasActive = recentJobs.some(j => ['PENDING', 'PROCESSING', 'QUEUED_FOR_VEC', 'VECTORIZING'].includes(j.status));

        if (hasActive && selectedProjectId) {
            interval = setInterval(() => {
                fetchRecentJobs(selectedProjectId);
            }, 2000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [recentJobs, selectedProjectId]);

    /**
     * TRIGGER: Opens the native file picker.
     * Sets the intended ingestType (TASK vs FEEDBACK) before clicking the hidden input.
     */
    const triggerUpload = (type: 'TASK' | 'FEEDBACK') => {
        if (!selectedProjectId) {
            setStatus({ type: 'error', message: 'Please select a project first.' });
            return;
        }
        setIngestType(type);
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    /**
     * UPLOAD HANDLER: handleCsvUpload
     * Sends the file to the server. The server responds with a jobId ALMOST IMMEDIATELY
     * because the actual processing happens in a background worker.
     */
    const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedProjectId) {
            if (!selectedProjectId) setStatus({ type: 'error', message: 'Please select a project first.' });
            return;
        }

        setUploading(true);
        setStatus(null);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('projectId', selectedProjectId);
            formData.append('type', ingestType);
            formData.append('generateEmbeddings', 'true');

            const res = await fetch('/api/ingest/csv', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();
            if (res.ok && data.jobId) {
                // Instantly refresh list so the user sees the 'Queued' state.
                fetchRecentJobs(selectedProjectId);
            } else {
                setStatus({ type: 'error', message: data.error || 'Upload failed' });
            }
        } catch (err) {
            setStatus({ type: 'error', message: 'A network error occurred.' });
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleApiIngest = async () => {
        // Feature currently under construction
    };

    /**
     * ABORT: stopIngest
     * Sends a request to the server to mark the job as CANCELLED.
     * The background worker will pick this up on its next chunk heartbeat.
     */
    const stopIngest = async (jobId: string) => {
        try {
            const res = await fetch('/api/ingest/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobId })
            });
            if (res.ok) {
                fetchRecentJobs(selectedProjectId);
            }
        } catch (err) {
            console.error('Failed to cancel job', err);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, []);

    // Selection listener: When switching projects, update the job history list.
    useEffect(() => {
        if (selectedProjectId) {
            fetchRecentJobs(selectedProjectId);
        }
    }, [selectedProjectId]);

    const fetchProjects = async () => {
        try {
            const res = await fetch('/api/projects');
            const data = await res.json();
            const projectsArray = Array.isArray(data) ? data : [];
            setProjects(projectsArray);
            if (projectsArray.length > 0) {
                setSelectedProjectId(projectsArray[0].id);
            }
        } catch (err) {
            console.error('Failed to fetch projects', err);
            setProjects([]);
        }
    };

    return (
        <div className="container" style={{ maxWidth: '900px' }}>
            <style jsx>{`
                .tooltip-content { opacity: 0; visibility: hidden; transition: opacity 0.2s; pointer-events: none; }
                .tooltip-container:hover .tooltip-content { opacity: 1; visibility: visible; }
            `}</style>
            <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="premium-gradient" style={{ fontSize: '2.5rem', marginBottom: '8px' }}>Ingest</h1>
                    <p style={{ color: 'rgba(255,255,255,0.6)' }}>Choose your method to import task data</p>
                </div>
                <Link href="/" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <LayoutDashboard size={18} /> Back to Dashboard
                </Link>
            </header>

            {/* PROJECT CONTEXT: Crucial because ingest jobs are scoped to projects */}
            <section className="glass-card" style={{ marginBottom: '32px' }}>
                <label style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '12px', display: 'block' }}>Target Project</label>
                <div className="input-field" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px' }}>
                    <Folder size={20} color="#0070f3" />
                    <select
                        value={selectedProjectId}
                        onChange={(e) => setSelectedProjectId(e.target.value)}
                        style={{ background: 'none', color: 'white', border: 'none', outline: 'none', width: '100%', cursor: 'pointer', fontSize: '1rem' }}
                    >
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        {projects.length === 0 && <option value="">No Projects Available</option>}
                    </select>
                </div>
            </section>

            {/* ACTIVE JOB BANNER: Promoted view for the most relevant ongoing job */}
            {activeJob && (
                <div className="glass-card" style={{
                    marginBottom: '32px',
                    borderColor:
                        activeJob.status === 'COMPLETED' ? 'var(--success)' :
                            activeJob.status === 'FAILED' ? 'var(--error)' :
                                'var(--accent)',
                    padding: '24px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {activeJob.status === 'PROCESSING' || activeJob.status === 'VECTORIZING' ? (
                                <Loader2 className="animate-spin" color="var(--accent)" />
                            ) : activeJob.status === 'PENDING' ? (
                                <Clock color="var(--accent)" style={{ opacity: 0.5 }} />
                            ) : activeJob.status === 'COMPLETED' ? (
                                <CheckCircle2 color="var(--success)" />
                            ) : (
                                <AlertCircle color="var(--error)" />
                            )}
                            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>
                                {/** 
                                 * DYNAMIC STATUS LABELS
                                 * Phase 1: PROCESSING (Data Loading)
                                 * Phase 2: VECTORIZING (AI Progress)
                                 * QUEUED_FOR_VEC: Waiting for the AI worker to pick it up.
                                 */}
                                {activeJob.status === 'PROCESSING' ? 'Loading Data' :
                                    activeJob.status === 'VECTORIZING' ? 'Generating Embeddings' :
                                        activeJob.status === 'QUEUED_FOR_VEC' ? 'Data Loaded (Queued for AI)' :
                                            activeJob.status === 'PENDING' ? 'Queued for Loading' :
                                                `Ingestion ${activeJob.status.toLowerCase()}`}
                                <span style={{ opacity: 0.4, fontSize: '0.9rem', marginLeft: '12px', fontWeight: 400 }}>{activeJob.type}</span>
                            </h3>

                            {(activeJob.status === 'PROCESSING' || activeJob.status === 'PENDING' || activeJob.status === 'VECTORIZING' || activeJob.status === 'QUEUED_FOR_VEC') && (
                                <button
                                    onClick={() => stopIngest(activeJob.id)}
                                    className="btn-outline"
                                    style={{ padding: '4px 12px', fontSize: '0.75rem', borderColor: 'var(--error)', color: 'var(--error)' }}
                                >
                                    Stop Ingest
                                </button>
                            )}
                        </div>
                        <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>Job ID: {activeJob.id.slice(-8)}</span>
                    </div>

                    {(activeJob.status === 'PROCESSING' || activeJob.status === 'VECTORIZING') && (
                        <>
                            <div style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '8px' }}>
                                {activeJob.status === 'PROCESSING' ? 'Phase 1: Loading data into database...' : 'Phase 2: Generating vector embeddings...'}
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', height: '8px', overflow: 'hidden', marginBottom: '16px' }}>
                                <div style={{
                                    height: '100%',
                                    background: activeJob.status === 'VECTORIZING' ? 'linear-gradient(90deg, #8b5cf6, #3b82f6)' : 'var(--accent-gradient)',
                                    width: activeJob.totalRecords > 0
                                        ? `${((activeJob.savedCount + activeJob.skippedCount) / activeJob.totalRecords) * 100}%`
                                        : '5%',
                                    transition: 'width 0.3s ease'
                                }}></div>
                            </div>
                        </>
                    )}

                    <div style={{ display: 'flex', gap: '24px', fontSize: '0.9rem' }}>
                        <div>
                            <span style={{ opacity: 0.6 }}>Saved:</span> <span style={{ fontWeight: 600 }}>{activeJob.savedCount}</span>
                        </div>
                        {/* 
                            Skip Details Tooltip:
                            Displays a breakdown of why records were skipped (e.g., Duplicates, Keyword Mismatch)
                            using the `skippedDetails` JSON from the job.
                        */}
                        <div className="tooltip-container" style={{ position: 'relative', cursor: 'help' }}>
                            <span style={{ opacity: 0.6 }}>Skipped:</span> <span style={{ fontWeight: 600 }}>{activeJob.skippedCount}</span>
                            {activeJob.skippedCount > 0 && activeJob.skippedDetails && (
                                <div className="tooltip-content" style={{
                                    position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                                    background: 'rgba(0,0,0,0.9)', padding: '8px 12px', borderRadius: '6px',
                                    width: 'max-content', marginBottom: '8px', zIndex: 10,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)'
                                }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '2px' }}>Skip Reasons</div>
                                    {Object.entries(activeJob.skippedDetails).map(([reason, count]) => (
                                        <div key={reason} style={{ fontSize: '0.7rem', display: 'flex', justifyContent: 'space-between', gap: '12px', whiteSpace: 'nowrap' }}>
                                            <span style={{ opacity: 0.7 }}>{reason}:</span>
                                            <span>{count}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        {activeJob.totalRecords > 0 && (
                            <div>
                                <span style={{ opacity: 0.6 }}>Total:</span> <span style={{ fontWeight: 600 }}>{activeJob.totalRecords}</span>
                            </div>
                        )}
                    </div>

                    {activeJob.status === 'FAILED' && activeJob.error && (
                        <p style={{ color: 'var(--error)', marginTop: '12px', fontSize: '0.85rem' }}>Error: {activeJob.error}</p>
                    )}

                    {(activeJob.status === 'COMPLETED' || activeJob.status === 'FAILED') && (
                        <button
                            className="btn-outline"
                            style={{ marginTop: '16px', padding: '8px 16px', fontSize: '0.8rem' }}
                            onClick={() => setActiveJob(null)}
                        >
                            Dismiss
                        </button>
                    )}
                </div>
            )}

            {/* TAB SYSTEM */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
                <button
                    onClick={() => setActiveTab('CSV')}
                    className={`glass-card ${activeTab === 'CSV' ? 'active-tab' : ''}`}
                    style={{
                        flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
                        border: activeTab === 'CSV' ? '1px solid var(--accent)' : '1px solid transparent',
                        background: activeTab === 'CSV' ? 'rgba(0, 112, 243, 0.05)' : 'rgba(255,255,255,0.02)'
                    }}
                >
                    <FileText size={32} color={activeTab === 'CSV' ? 'var(--accent)' : 'rgba(255,255,255,0.4)'} />
                    <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>Ingest CSV</span>
                    <p style={{ fontSize: '0.8rem', opacity: 0.5, textAlign: 'center' }}>Upload local datasets for analysis</p>
                </button>

                <button
                    onClick={() => setActiveTab('API')}
                    className={`glass-card ${activeTab === 'API' ? 'active-tab' : ''}`}
                    style={{
                        flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
                        border: activeTab === 'API' ? '1px solid var(--accent)' : '1px solid transparent',
                        background: activeTab === 'API' ? 'rgba(0, 112, 243, 0.05)' : 'rgba(255,255,255,0.02)'
                    }}
                >
                    <Globe2 size={32} color={activeTab === 'API' ? 'var(--accent)' : 'rgba(255,255,255,0.4)'} />
                    <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>Ingest Via API</span>
                    <p style={{ fontSize: '0.8rem', opacity: 0.5, textAlign: 'center' }}>Stream live data from endpoints</p>
                </button>
            </div>

            {status && (
                <div className="glass-card" style={{
                    marginBottom: '32px', border: `1px solid ${status.type === 'success' ? 'var(--success)' : 'var(--error)'}`,
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '16px'
                }}>
                    {status.type === 'success' ? <CheckCircle2 color="var(--success)" /> : <AlertCircle color="var(--error)" />}
                    <span>{status.message}</span>
                </div>
            )}

            {/* CSV INGEST PANEL */}
            {activeTab === 'CSV' ? (
                <div className="glass-card" style={{ padding: '40px' }}>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Upload size={24} color="var(--accent)" /> Configure CSV Ingest
                    </h2>

                    <input type="file" accept=".csv" ref={fileInputRef} style={{ display: 'none' }} onChange={handleCsvUpload} disabled={uploading || !selectedProjectId} />

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '16px', display: 'block' }}>Select Data Type to Upload</label>
                        <div style={{ display: 'flex', gap: '16px', maxWidth: '500px' }}>
                            <button
                                onClick={() => triggerUpload('TASK')}
                                disabled={uploading}
                                className={`btn-primary ${uploading && ingestType === 'TASK' ? 'loading' : ''}`}
                                style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}
                            >
                                <FileText size={28} />
                                <span style={{ fontWeight: 600 }}>{uploading && ingestType === 'TASK' ? 'Sending...' : 'Tasks'}</span>
                            </button>
                            <button
                                onClick={() => triggerUpload('FEEDBACK')}
                                disabled={uploading}
                                className={`btn-primary ${uploading && ingestType === 'FEEDBACK' ? 'loading' : ''}`}
                                style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', background: 'var(--accent-gradient)' }}
                            >
                                <CheckCircle2 size={28} />
                                <span style={{ fontWeight: 600 }}>{uploading && ingestType === 'FEEDBACK' ? 'Sending...' : 'Feedback'}</span>
                            </button>
                        </div>
                    </div>

                    <p style={{ fontSize: '0.8rem', opacity: 0.4 }}>
                        CSV files should contain a content column (e.g., `feedback`, `task_content`, `prompt`) and a quality rating column (e.g., `quality_rating`, `Top 10%`, `top_10`).
                    </p>
                </div>
            ) : (
                /* UNDER CONSTRUCTION VIEW */
                <div className="glass-card" style={{ padding: '80px 40px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: '-20px', left: '-20px', opacity: 0.03, transform: 'rotate(-15deg)' }}>
                        <HardHat size={200} />
                    </div>
                    <div style={{ position: 'absolute', bottom: '-20px', right: '-20px', opacity: 0.03, transform: 'rotate(15deg)' }}>
                        <Construction size={200} />
                    </div>

                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <div style={{
                            width: '80px',
                            height: '80px',
                            background: 'rgba(255, 170, 0, 0.1)',
                            borderRadius: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 24px auto',
                            border: '1px solid rgba(255, 170, 0, 0.2)'
                        }}>
                            <HardHat size={40} color="#ffaa00" />
                        </div>
                        <h2 className="premium-gradient" style={{ fontSize: '2rem', marginBottom: '16px', background: 'linear-gradient(135deg, #ffaa00 0%, #ff7700 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            API Ingestion Under Construction
                        </h2>
                        <p style={{ color: 'rgba(255,255,255,0.6)', maxWidth: '500px', margin: '0 auto 32px auto', lineHeight: '1.6' }}>
                            We're currently refactoring our API stream engine to support large-scale background syncs.
                            Check back soon for enterprise-grade endpoint connectivity!
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '24px' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ opacity: 0.4 }}><Construction size={24} /></div>
                                <span style={{ fontSize: '0.7rem', opacity: 0.4, textTransform: 'uppercase', letterSpacing: '1px' }}>Building</span>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ opacity: 0.4 }}><Loader2 className="animate-spin" size={24} /></div>
                                <span style={{ fontSize: '0.7rem', opacity: 0.4, textTransform: 'uppercase', letterSpacing: '1px' }}>Optimizing</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* RECENT ACTIVITY: Historical log of ingestion jobs */}
            {recentJobs.length > 0 && (
                <section style={{ marginTop: '48px' }}>
                    <h2 style={{ fontSize: '1.2rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', opacity: 0.8 }}>
                        <History size={20} /> Recent Activity
                    </h2>
                    <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                        {recentJobs.map((job, i) => (
                            <div
                                key={job.id}
                                style={{
                                    padding: '16px 24px',
                                    borderBottom: i === recentJobs.length - 1 ? 'none' : '1px solid var(--border)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    background: activeJob?.id === job.id ? 'rgba(0, 112, 243, 0.05)' : 'transparent',
                                    cursor: 'pointer'
                                }}
                                onClick={() => setActiveJob(job)}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                                    <div style={{
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        background:
                                            job.status === 'COMPLETED' ? 'var(--success)' :
                                                job.status === 'FAILED' ? 'var(--error)' :
                                                    'var(--accent)',
                                        boxShadow: (job.status === 'PENDING' || job.status === 'PROCESSING') ? '0 0 8px var(--accent)' : 'none'
                                    }}></div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                                {job.type} Ingest
                                            </div>
                                            {/* Small inline progress indicator for running jobs in the list */}
                                            {(job.status === 'PROCESSING' || job.status === 'VECTORIZING') && (
                                                <div style={{ flex: 1, maxWidth: '150px', marginLeft: '12px' }}>
                                                    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '4px', height: '4px', overflow: 'hidden' }}>
                                                        <div style={{
                                                            height: '100%',
                                                            background: job.status === 'VECTORIZING' ? 'linear-gradient(90deg, #8b5cf6, #3b82f6)' : 'var(--accent-gradient)',
                                                            width: job.totalRecords > 0
                                                                ? `${((job.savedCount + job.skippedCount) / job.totalRecords) * 100}%`
                                                                : '5%',
                                                            transition: 'width 0.3s ease'
                                                        }}></div>
                                                    </div>
                                                </div>
                                            )}
                                            {job.status === 'PENDING' && (
                                                <span style={{ fontSize: '0.7rem', opacity: 0.4, fontStyle: 'italic' }}>(In Queue...)</span>
                                            )}
                                            {job.status === 'QUEUED_FOR_VEC' && (
                                                <span style={{ fontSize: '0.7rem', opacity: 0.4, fontStyle: 'italic', color: '#8b5cf6' }}>(Waiting for AI...)</span>
                                            )}
                                            {job.status === 'VECTORIZING' && (
                                                <span style={{ fontSize: '0.7rem', opacity: 0.4, fontStyle: 'italic', color: '#8b5cf6' }}>(Vectorizing...)</span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>
                                            {new Date(job.createdAt).toLocaleString()} • {job.savedCount} Saved
                                        </div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    {(job.status === 'PENDING' || job.status === 'PROCESSING' || job.status === 'VECTORIZING' || job.status === 'QUEUED_FOR_VEC') && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    stopIngest(job.id);
                                                }}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: 'var(--error)',
                                                    fontSize: '0.7rem',
                                                    cursor: 'pointer',
                                                    opacity: 0.6,
                                                    padding: '4px'
                                                }}
                                            >
                                                Cancel
                                            </button>
                                            <Loader2 className="animate-spin" size={12} color={['VECTORIZING', 'QUEUED_FOR_VEC'].includes(job.status) ? '#8b5cf6' : 'var(--accent)'} />
                                        </div>
                                    )}
                                    <span style={{
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        color:
                                            job.status === 'COMPLETED' ? 'var(--success)' :
                                                job.status === 'FAILED' ? 'var(--error)' :
                                                    job.status === 'CANCELLED' ? 'rgba(255,255,255,0.3)' :
                                                        job.status === 'QUEUED_FOR_VEC' ? '#8b5cf6' :
                                                            'var(--accent)'
                                    }}>
                                        {job.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
