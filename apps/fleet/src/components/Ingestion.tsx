/**
 * INGESTION UI COMPONENT
 * Handles multi-source data ingestion (CSV/API) with a focus on 
 * background job management, real-time progress polling, and sequential queuing.
 */
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, CheckCircle2, AlertCircle, Loader2, History, Clock } from 'lucide-react';
import Link from 'next/link';

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
    // Shared Ingest State: Tracks the visual feedback of the "Upload" action itself.
    const [uploading, setUploading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    // Background Job State: Handles the long-running database processes.
    const [activeJob, setActiveJob] = useState<IngestJob | null>(null);
    const [recentJobs, setRecentJobs] = useState<IngestJob[]>([]);

    // Retroactive vectorization state
    const [vectorizing, setVectorizing] = useState(false);
    const [triggeringQueued, setTriggeringQueued] = useState(false);
    const [triggeringPending, setTriggeringPending] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Refs to avoid stale closures and interval thrashing
    const recentJobsRef = useRef<IngestJob[]>([]);
    const activeJobRef = useRef<IngestJob | null>(null);
    const userSelectedJobRef = useRef<boolean>(false); // Track if user manually selected a job

    // Keep refs in sync with state
    useEffect(() => { recentJobsRef.current = recentJobs; }, [recentJobs]);
    useEffect(() => { activeJobRef.current = activeJob; }, [activeJob]);

    /**
     * RECOVERY LOGIC: fetchRecentJobs
     * Pulls the most recent jobs (environment comes from ingested data).
     * Uses refs to avoid stale closure issues in intervals.
     * Only auto-switches to running jobs if user hasn't manually selected one.
     */
    const fetchRecentJobs = useCallback(async () => {
        try {
            const res = await fetch('/api/ingest/jobs');
            const data = await res.json();
            if (res.ok) {
                setRecentJobs(data);

                const currentActiveJob = activeJobRef.current;

                // Only auto-select a job if user hasn't manually selected one
                if (!userSelectedJobRef.current) {
                    const runningJob = data.find((j: IngestJob) => j.status === 'PROCESSING' || j.status === 'VECTORIZING');
                    const pendingJob = !runningJob ? data.find((j: IngestJob) => j.status === 'PENDING' || j.status === 'QUEUED_FOR_VEC') : null;

                    if (runningJob || pendingJob) {
                        setActiveJob(runningJob || pendingJob);
                    }
                }

                // Always update the current active job's status if it exists in the list
                if (currentActiveJob) {
                    const latestActive = data.find((j: IngestJob) => j.id === currentActiveJob.id);
                    if (latestActive) {
                        setActiveJob(latestActive);
                        // Reset user selection flag when job completes
                        if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(latestActive.status)) {
                            userSelectedJobRef.current = false;
                        }
                    }
                }

                // Re-trigger the processing queue for any stuck jobs.
                // The status endpoint awaits processQueuedJobs() before returning, which is
                // the designed mechanism for re-kicking jobs in serverless environments.
                // Fire-and-forget: we don't need to await the result here.
                const stuckJobs = data.filter((j: IngestJob) =>
                    j.status === 'PENDING' || j.status === 'QUEUED_FOR_VEC'
                );
                for (const job of stuckJobs) {
                    fetch(`/api/ingest/status?jobId=${job.id}`).catch(() => {});
                }
            }
        } catch (err) {
            console.error('Failed to fetch recent jobs', err);
        }
    }, []);

    /**
     * POLLING LOOP: useEffect
     * Uses refs to check state without recreating the interval on every state change.
     * This prevents interval thrashing that was causing performance issues.
     */
    useEffect(() => {
        // Initial fetch on mount
        fetchRecentJobs();

        const interval = setInterval(() => {
            const jobs = recentJobsRef.current;
            const hasActive = jobs.some(j => ['PENDING', 'PROCESSING', 'QUEUED_FOR_VEC', 'VECTORIZING'].includes(j.status));

            if (hasActive) {
                fetchRecentJobs();
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [fetchRecentJobs]);

    /**
     * TRIGGER: Opens the native file picker.
     */
    const triggerUpload = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    /**
     * CHUNKED UPLOAD: uploadChunked
     * For large files (>3MB), uses File.slice() to read chunks incrementally from disk.
     * This prevents loading the entire file into browser memory.
     * Includes retry logic for network resilience.
     */
    const uploadChunked = async (file: File): Promise<{ jobId?: string; error?: string }> => {
        const CHUNK_SIZE = 3 * 1024 * 1024; // 3MB chunks
        const MAX_RETRIES = 3;
        const RETRY_DELAY_MS = 1000;

        // Calculate total chunks based on file size (not content length)
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        const uploadId = `upload_${Date.now()}_${Math.random().toString(36).slice(2)}`;

        // Step 1: Initialize upload session
        const startRes = await fetch('/api/ingest/csv/chunked', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'start',
                uploadId,
                fileName: file.name,
                totalChunks,
                generateEmbeddings: true
            })
        });

        if (!startRes.ok) {
            const data = await startRes.json();
            return { error: data.error || 'Failed to initialize upload' };
        }

        // Step 2: Upload each chunk using File.slice() to avoid memory issues
        for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);

            // File.slice() returns a Blob pointer - doesn't load data into RAM
            const blob = file.slice(start, end);
            // Only read this chunk into memory when we're about to send it
            const chunkContent = await blob.text();

            // Retry logic for network resilience
            let lastError: string | undefined = undefined;
            for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
                try {
                    const chunkRes = await fetch('/api/ingest/csv/chunked', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'chunk',
                            uploadId,
                            chunkIndex: i,
                            content: chunkContent
                        })
                    });

                    if (chunkRes.ok) {
                        lastError = undefined;
                        break; // Success, move to next chunk
                    }

                    const data = await chunkRes.json();
                    lastError = data.error || `Failed to upload chunk ${i + 1}`;

                    // Don't retry on client errors (4xx), only server/network errors
                    if (chunkRes.status >= 400 && chunkRes.status < 500) {
                        return { error: lastError };
                    }
                } catch (err) {
                    lastError = `Network error on chunk ${i + 1}`;
                }

                // Wait before retrying
                if (attempt < MAX_RETRIES - 1) {
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
                }
            }

            if (lastError) {
                return { error: `${lastError} (after ${MAX_RETRIES} attempts)` };
            }
        }

        // Step 3: Complete the upload
        const completeRes = await fetch('/api/ingest/csv/chunked', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'complete',
                uploadId
            })
        });

        const completeData = await completeRes.json();
        if (!completeRes.ok) {
            return { error: completeData.error || 'Failed to complete upload' };
        }

        return { jobId: completeData.jobId };
    };

    /**
     * UPLOAD HANDLER: handleCsvUpload
     * Sends the file to the server. Uses chunked upload for large files (>3MB).
     * The server responds with a jobId ALMOST IMMEDIATELY
     * because the actual processing happens in a background worker.
     * Environment is extracted from the CSV data itself by the backend.
     */
    /**
     * RETROACTIVE VECTORIZATION HANDLER
     * Creates vectorization jobs for all environments with missing embeddings.
     * Useful when data was imported directly into the database.
     */
    const triggerRetroactiveVectorization = async () => {
        setVectorizing(true);
        try {
            const res = await fetch('/api/ingest/retroactive-vectorization', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (res.ok) {
                setStatus({
                    type: 'success',
                    message: data.message + (data.jobsCreated > 0 ? '. Check Recent Activity below for progress.' : '')
                });
                // Refresh jobs list to show new vectorization jobs
                fetchRecentJobs();
            } else {
                setStatus({ type: 'error', message: data.error || 'Failed to trigger vectorization' });
            }
        } catch (error) {
            console.error('Failed to trigger retroactive vectorization:', error);
            setStatus({ type: 'error', message: 'Failed to trigger vectorization. Check console for details.' });
        } finally {
            setVectorizing(false);
        }
    };

    const triggerPendingJobs = async () => {
        setTriggeringPending(true);
        try {
            const res = await fetch('/api/ingest/dev-trigger-pending', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setStatus({ type: 'success', message: data.message });
                fetchRecentJobs();
            } else {
                setStatus({ type: 'error', message: data.error || 'Failed to trigger pending jobs' });
            }
        } catch (error) {
            setStatus({ type: 'error', message: 'Failed to trigger pending jobs. Check console for details.' });
        } finally {
            setTriggeringPending(false);
        }
    };

    const triggerQueuedJobs = async () => {
        setTriggeringQueued(true);
        try {
            const res = await fetch('/api/ingest/dev-trigger-queued', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setStatus({ type: 'success', message: data.message });
                fetchRecentJobs();
            } else {
                setStatus({ type: 'error', message: data.error || 'Failed to trigger queued jobs' });
            }
        } catch (error) {
            setStatus({ type: 'error', message: 'Failed to trigger queued jobs. Check console for details.' });
        } finally {
            setTriggeringQueued(false);
        }
    };

    const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) {
            return;
        }

        setUploading(true);
        setStatus(null);

        try {
            // Use chunked upload for files larger than 3MB
            const CHUNK_THRESHOLD = 3 * 1024 * 1024; // 3MB

            if (file.size > CHUNK_THRESHOLD) {
                const result = await uploadChunked(file);
                if (result.error) {
                    setStatus({ type: 'error', message: result.error });
                } else if (result.jobId) {
                    fetchRecentJobs();
                }
            } else {
                // Use regular FormData upload for smaller files
                const formData = new FormData();
                formData.append('file', file);
                formData.append('generateEmbeddings', 'true');

                const res = await fetch('/api/ingest/csv', {
                    method: 'POST',
                    body: formData,
                });

                const data = await res.json();
                if (res.ok && data.jobId) {
                    // Instantly refresh list so the user sees the 'Queued' state.
                    fetchRecentJobs();
                } else {
                    setStatus({ type: 'error', message: data.error || 'Upload failed' });
                }
            }
        } catch (err) {
            setStatus({ type: 'error', message: 'A network error occurred.' });
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
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
                fetchRecentJobs();
            }
        } catch (err) {
            console.error('Failed to cancel job', err);
        }
    };

    return (
        <div style={{ width: '100%', maxWidth: '1000px', margin: '0 auto' }}>
            
            <div style={{ marginBottom: '40px' }}>
                <h1 className="premium-gradient" style={{ fontSize: '2.5rem', marginBottom: '8px' }}>Ingest Data</h1>
                <p style={{ color: 'rgba(255,255,255,0.6)' }}>Upload CSV files to import tasks and feedback (environment extracted from data)</p>
            </div>

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
                            <div style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>{activeJob.status === 'PROCESSING' ? 'Phase 1: Loading data into database...' : 'Phase 2: Generating vector embeddings...'}</span>
                                {activeJob.totalRecords > 0 && (
                                    <span style={{ fontWeight: 600, color: 'var(--accent)' }}>
                                        {Math.round(((activeJob.savedCount + activeJob.skippedCount) / activeJob.totalRecords) * 100)}%
                                    </span>
                                )}
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', height: '12px', overflow: 'hidden', marginBottom: '16px', position: 'relative' }}>
                                <div style={{
                                    height: '100%',
                                    background: activeJob.status === 'VECTORIZING' ? 'linear-gradient(90deg, #8b5cf6, #3b82f6)' : 'var(--accent-gradient)',
                                    width: activeJob.totalRecords > 0
                                        ? `${((activeJob.savedCount + activeJob.skippedCount) / activeJob.totalRecords) * 100}%`
                                        : '5%',
                                    transition: 'width 0.3s ease',
                                    boxShadow: '0 0 10px rgba(139, 92, 246, 0.5)'
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
                            onClick={() => {
                                userSelectedJobRef.current = false;
                                setActiveJob(null);
                            }}
                        >
                            Dismiss
                        </button>
                    )}
                </div>
            )}

            {status && (
                <div className="glass-card" style={{
                    marginBottom: '32px', border: `1px solid ${status.type === 'success' ? 'var(--success)' : 'var(--error)'}`,
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '16px'
                }}>
                    {status.type === 'success' ? <CheckCircle2 color="var(--success)" /> : <AlertCircle color="var(--error)" />}
                    <span>{status.message}</span>
                </div>
            )}

            {/* CSV UPLOAD SECTION */}
            <div className="glass-card" style={{ padding: '40px' }}>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Upload size={24} color="var(--accent)" /> Upload CSV File
                </h2>

                <input type="file" accept=".csv" ref={fileInputRef} style={{ display: 'none' }} onChange={handleCsvUpload} disabled={uploading} />

                <button
                    onClick={triggerUpload}
                    disabled={uploading}
                    className="btn-primary"
                    style={{
                        width: '100%',
                        maxWidth: '400px',
                        padding: '32px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '16px',
                        fontSize: '1.1rem'
                    }}
                >
                    <Upload size={40} />
                    <span style={{ fontWeight: 600 }}>{uploading ? 'Uploading...' : 'Select CSV File'}</span>
                </button>

                <p style={{ fontSize: '0.85rem', opacity: 0.5, marginTop: '24px', lineHeight: '1.6' }}>
                    CSV files should contain a content column (e.g., <code>feedback</code>, <code>task_content</code>, <code>prompt</code>),
                    a type column (e.g., <code>type</code>), and optional quality rating column (e.g., <code>quality_rating</code>, <code>Top 10%</code>).
                    Environment will be extracted from the data automatically.
                </p>
            </div>

            {/* UTILITY SECTION: Maintenance tools */}
            <div className="glass-card" style={{
                padding: '32px',
                marginTop: '32px',
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.1))',
                borderColor: 'rgba(139, 92, 246, 0.3)'
            }}>
                <h2 style={{ fontSize: '1.4rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <AlertCircle size={24} color="var(--accent)" />
                    Maintenance Tools
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div>
                        <p style={{ fontSize: '0.95rem', opacity: 0.8, marginBottom: '16px', lineHeight: '1.6' }}>
                            Generate embeddings for records that were imported directly into the database and are missing vector embeddings.
                        </p>
                        <button
                            onClick={triggerRetroactiveVectorization}
                            disabled={vectorizing}
                            className="btn-primary"
                            style={{
                                padding: '16px 32px',
                                fontSize: '1rem',
                                fontWeight: 600,
                                background: vectorizing ? 'rgba(139, 92, 246, 0.3)' : 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
                                border: 'none',
                                boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            {vectorizing ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    Checking for missing embeddings...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={20} />
                                    Generate Missing Embeddings
                                </>
                            )}
                        </button>
                    </div>

                    {process.env.NODE_ENV !== 'production' && (
                        <div style={{ borderTop: '1px solid rgba(139, 92, 246, 0.2)', paddingTop: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#f59e0b', background: 'rgba(245,158,11,0.15)', padding: '2px 8px', borderRadius: '4px' }}>
                                    Dev Only
                                </span>
                            </div>
                            <p style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '12px', lineHeight: '1.5' }}>
                                Directly trigger Phase 1 (ingestion) for all <code>PENDING</code> jobs, or Phase 2 (vectorization) for all <code>QUEUED_FOR_VEC</code> jobs.
                                Use these locally since the Supabase webhook can't reach localhost.
                            </p>
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                <button
                                    onClick={triggerPendingJobs}
                                    disabled={triggeringPending}
                                    className="btn-outline"
                                    style={{
                                        padding: '12px 24px',
                                        fontSize: '0.95rem',
                                        fontWeight: 600,
                                        borderColor: '#f59e0b',
                                        color: '#f59e0b',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    {triggeringPending ? (
                                        <>
                                            <Loader2 className="animate-spin" size={18} />
                                            Triggering...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 size={18} />
                                            Trigger Pending Ingestion Jobs
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={triggerQueuedJobs}
                                    disabled={triggeringQueued}
                                    className="btn-outline"
                                    style={{
                                        padding: '12px 24px',
                                        fontSize: '0.95rem',
                                        fontWeight: 600,
                                        borderColor: '#f59e0b',
                                        color: '#f59e0b',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    {triggeringQueued ? (
                                        <>
                                            <Loader2 className="animate-spin" size={18} />
                                            Triggering...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 size={18} />
                                            Trigger Queued Vectorization Jobs
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

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
                                onClick={() => {
                                    userSelectedJobRef.current = true;
                                    setActiveJob(job);
                                }}
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
