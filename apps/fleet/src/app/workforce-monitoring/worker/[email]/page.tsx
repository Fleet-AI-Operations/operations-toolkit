'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, Loader2, ShieldAlert, AlertTriangle, Flag, Plus, X,
  ChevronLeft, ChevronRight, Search, CheckCircle, Clock, ScanSearch,
  FileText, MessageSquare, ExternalLink, User, Filter, Brain, ChevronDown, ChevronUp,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface DataRecord {
  id: string;
  environment: string;
  content: string;
  metadata: Record<string, any> | null;
  createdAt: string;
  alignmentAnalysis: string | null;
  hasBeenReviewed: boolean;
}

interface WorkerFlag {
  id: string;
  workerEmail: string;
  workerName: string | null;
  flagType: string;
  severity: string;
  status: string;
  reason: string;
  notes: string | null;
  createdByEmail: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  createdAt: string;
}

interface LookupResult {
  recordId: string;
  email: string;
  name: string | null;
  environment: string | null;
  taskKey: string | null;
}

interface DeepDiveTask {
  id: string;
  content: string;
  environment: string | null;
  createdAt: string;
  gapFromPreviousMin: number | null;
  isRapidSubmission: boolean;
  analysisStatus: 'COMPLETED' | 'PENDING';
  isLikelyAIGenerated: boolean | null;
  aiGeneratedConfidence: number | null;
  aiGeneratedIndicators: string[] | null;
  isLikelyTemplated: boolean | null;
  templateConfidence: number | null;
  templateIndicators: string[] | null;
  detectedTemplate: string | null;
  isLikelyNonNative: boolean | null;
  nonNativeConfidence: number | null;
  nonNativeIndicators: string[] | null;
  overallAssessment: string | null;
}

interface DeepDiveSummary {
  total: number;
  analyzed: number;
  aiGeneratedCount: number;
  aiGeneratedPct: number;
  templatedCount: number;
  templatedPct: number;
  nonNativeCount: number;
  nonNativePct: number;
  rapidSubmissionCount: number;
  rapidSubmissionPct: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const FLAG_TYPES = ['QUALITY_CONCERN', 'POLICY_VIOLATION', 'COMMUNICATION_ISSUE', 'ATTENDANCE', 'OTHER', 'REVIEW_REQUESTED'] as const;
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: '#ff4d4d',
  HIGH: 'rgba(251,113,33,0.9)',
  MEDIUM: 'rgba(251,191,36,0.9)',
  LOW: 'rgba(74,222,128,0.9)',
};
const FLAG_TYPE_COLORS: Record<string, string> = {
  REVIEW_REQUESTED: 'rgba(139,92,246,0.9)',
};
const STATUS_COLORS: Record<string, string> = {
  OPEN: 'rgba(251,113,33,0.9)',
  UNDER_REVIEW: 'rgba(251,191,36,0.9)',
  RESOLVED: 'rgba(74,222,128,0.9)',
  DISMISSED: 'rgba(255,255,255,0.3)',
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

// ── Main Component ───────────────────────────────────────────────────────────

type Tab = 'tasks' | 'feedback' | 'flags' | 'lookup' | 'similarity' | 'deepdive';

export default function WorkerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const email = decodeURIComponent(params.email as string);

  const [activeTab, setActiveTab] = useState<Tab>('tasks');
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [workerName, setWorkerName] = useState<string | null>(null);
  const [tasks, setTasks] = useState<DataRecord[]>([]);
  const [feedback, setFeedback] = useState<DataRecord[]>([]);
  const [flags, setFlags] = useState<WorkerFlag[]>([]);
  const [totalTasks, setTotalTasks] = useState(0);
  const [totalFeedback, setTotalFeedback] = useState(0);

  const [taskPage, setTaskPage] = useState(1);
  const [feedbackPage, setFeedbackPage] = useState(1);
  const [taskPageLoading, setTaskPageLoading] = useState(false);
  const [feedbackPageLoading, setFeedbackPageLoading] = useState(false);
  const [latestOnly, setLatestOnly] = useState(false);
  const PAGE_SIZE = 50;

  // ── Environment filter ───────────────────────────────────────────────────
  const [environment, setEnvironment] = useState('');
  const [environments, setEnvironments] = useState<{ name: string; count: number }[]>([]);

  // ── Flag creation state ──────────────────────────────────────────────────
  const [showFlagForm, setShowFlagForm] = useState(false);
  const [flagForm, setFlagForm] = useState({ flagType: 'QUALITY_CONCERN', severity: 'MEDIUM', reason: '', notes: '' });
  const [flagFormError, setFlagFormError] = useState<string | null>(null);
  const [flagFormLoading, setFlagFormLoading] = useState(false);

  // ── Flag resolve state ───────────────────────────────────────────────────
  const [resolveTarget, setResolveTarget] = useState<{ id: string; action: 'RESOLVED' | 'DISMISSED' | 'UNDER_REVIEW' } | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolveLoading, setResolveLoading] = useState(false);

  // ── Similarity state ─────────────────────────────────────────────────────
  const [simTasks, setSimTasks] = useState<{ id: string; content: string; environment: string | null; taskKey: string | null; createdAt: string }[]>([]);
  const [simTasksLoading, setSimTasksLoading] = useState(false);
  const [simTasksTotal, setSimTasksTotal] = useState(0);
  const [simTasksTotalPages, setSimTasksTotalPages] = useState(1);
  const [simTasksPage, setSimTasksPage] = useState(1);
  const [simLatestOnly, setSimLatestOnly] = useState(false);
  const [simSelected, setSimSelected] = useState<{ id: string; content: string; environment: string | null; taskKey: string | null } | null>(null);
  const [simResults, setSimResults] = useState<{ taskId: string; content: string; environment: string | null; taskKey: string | null; createdBy: string; createdByEmail: string | null; isSameWorker: boolean; similarity: number; createdAt: string }[] | null>(null);
  const [simResultsLoading, setSimResultsLoading] = useState(false);
  const [simThreshold, setSimThreshold] = useState(50);
  const [simScope, setSimScope] = useState<'all' | 'environment'>('all');
  const [simError, setSimError] = useState<string | null>(null);
  const [simExpandedMatch, setSimExpandedMatch] = useState<string | null>(null);

  // ── Task lookup state ────────────────────────────────────────────────────
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupResults, setLookupResults] = useState<LookupResult[] | null>(null);
  const [lookupMatchType, setLookupMatchType] = useState<'exact' | 'fuzzy' | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  // ── Expanded record ──────────────────────────────────────────────────────
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);

  // ── Deep-dive analysis state ─────────────────────────────────────────────
  const [deepDiveTasks, setDeepDiveTasks] = useState<DeepDiveTask[]>([]);
  const [deepDiveSummary, setDeepDiveSummary] = useState<DeepDiveSummary | null>(null);
  const [deepDiveLoading, setDeepDiveLoading] = useState(false);
  const [deepDiveAnalyzing, setDeepDiveAnalyzing] = useState(false);
  const [deepDiveError, setDeepDiveError] = useState<string | null>(null);
  const [deepDiveAnalyzeResult, setDeepDiveAnalyzeResult] = useState<string | null>(null);
  const [deepDiveFlagFilter, setDeepDiveFlagFilter] = useState<'all' | 'ai' | 'templated' | 'nonnative' | 'rapid'>('all');
  const [deepDiveExpandedTask, setDeepDiveExpandedTask] = useState<string | null>(null);

  // ── Data fetching ────────────────────────────────────────────────────────

  const fetchWorker = useCallback(async (taskPg = 1, feedbackPg = 1, env = environment, latest = latestOnly) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ email, page: String(taskPg), limit: String(PAGE_SIZE) });
      if (env) params.set('environment', env);
      if (latest) params.set('latestOnly', 'true');
      const res = await fetch(`/api/workforce-monitoring/worker?${params.toString()}`);

      if (res.status === 401) { router.push('/login'); return; }
      if (res.status === 403) { setAuthorized(false); setLoading(false); return; }
      if (res.status === 404) { setError('Worker not found'); setLoading(false); setAuthorized(true); return; }
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(data.error || `Server error: ${res.status}`);
      }

      const data = await res.json();
      setWorkerName(data.worker?.name ?? null);
      setTasks(data.tasks ?? []);
      setFeedback(data.feedback ?? []);
      setFlags(data.flags ?? []);
      setTotalTasks(data.totalTasks ?? 0);
      setTotalFeedback(data.totalFeedback ?? 0);
      if (data.environments) setEnvironments(data.environments);
      setAuthorized(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load worker');
    } finally {
      setLoading(false);
    }
  }, [email, environment, latestOnly]);

  const isMounted = useRef(false);

  useEffect(() => {
    fetchWorker();
    isMounted.current = true;
  }, []);

  // Re-fetch when environment or latestOnly changes, resetting task page (skip on initial mount)
  useEffect(() => {
    if (!isMounted.current) return;
    setTaskPage(1);
    setExpandedRecord(null);
    fetchWorker(1, feedbackPage, environment, latestOnly);
  }, [environment, latestOnly]);

  // Fetch deep-dive data when tab becomes active, or when environment changes while on that tab
  useEffect(() => {
    if (activeTab === 'deepdive' && deepDiveSummary === null && !deepDiveLoading) {
      fetchDeepDive();
    }
    if (activeTab === 'similarity' && simTasks.length === 0 && !simTasksLoading) {
      fetchSimTasks();
    }
  }, [activeTab]);

  useEffect(() => {
    if (!isMounted.current) return;
    if (activeTab === 'deepdive') {
      setDeepDiveSummary(null);
      fetchDeepDive();
    }
    if (activeTab === 'similarity') {
      setSimSelected(null);
      setSimResults(null);
      fetchSimTasks(1, simLatestOnly);
    }
  }, [environment]);

  // ── Flag actions ─────────────────────────────────────────────────────────

  const createFlag = async () => {
    if (!flagForm.reason.trim()) { setFlagFormError('Reason is required'); return; }
    setFlagFormLoading(true);
    setFlagFormError(null);
    try {
      const res = await fetch('/api/workforce-monitoring/flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerEmail: email, workerName, ...flagForm }),
      });
      const data = await res.json();
      if (!res.ok) { setFlagFormError(data.error || 'Failed to create flag'); return; }
      setFlags(prev => [data.flag, ...prev]);
      setShowFlagForm(false);
      setFlagForm({ flagType: 'QUALITY_CONCERN', severity: 'MEDIUM', reason: '', notes: '' });
    } catch {
      setFlagFormError('Network error — please try again');
    } finally {
      setFlagFormLoading(false);
    }
  };

  const resolveFlag = async () => {
    if (!resolveTarget) return;
    setResolveLoading(true);
    try {
      const res = await fetch(`/api/workforce-monitoring/flags/${resolveTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: resolveTarget.action, resolutionNotes: resolutionNotes.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update flag');
      setFlags(prev => prev.map(f => f.id === resolveTarget.id ? data.flag : f));
      setResolveTarget(null);
      setResolutionNotes('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update flag');
    } finally {
      setResolveLoading(false);
    }
  };

  // ── Similarity ────────────────────────────────────────────────────────────

  const fetchSimTasks = useCallback(async (pg = 1, latest = simLatestOnly) => {
    setSimTasksLoading(true);
    setSimError(null);
    try {
      const p = new URLSearchParams({ email, page: String(pg), limit: '25' });
      if (environment) p.set('environment', environment);
      if (latest) p.set('latestOnly', 'true');
      const res = await fetch(`/api/workforce-monitoring/similarity?${p.toString()}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) { setSimError(data?.error ?? 'Failed to load tasks'); return; }
      setSimTasks(data.tasks ?? []);
      setSimTasksTotal(data.total ?? 0);
      setSimTasksTotalPages(data.totalPages ?? 1);
      setSimTasksPage(pg);
    } catch {
      setSimError('Network error — please try again');
    } finally {
      setSimTasksLoading(false);
    }
  }, [email, environment, simLatestOnly]);

  const runSimilarityCompare = async (task: typeof simSelected) => {
    if (!task) return;
    setSimSelected(task);
    setSimResultsLoading(true);
    setSimResults(null);
    setSimError(null);
    setSimExpandedMatch(null);
    try {
      const res = await fetch('/api/workforce-monitoring/similarity/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id, scope: simScope, threshold: simThreshold, latestOnly: simLatestOnly, workerEmail: email }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setSimError(data?.error ?? 'Comparison failed'); return; }
      setSimResults(data.matches ?? []);
    } catch {
      setSimError('Network error — please try again');
    } finally {
      setSimResultsLoading(false);
    }
  };

  // ── Task lookup ───────────────────────────────────────────────────────────

  const performLookup = async () => {
    const q = lookupQuery.trim();
    if (!q) return;
    setLookupLoading(true);
    setLookupError(null);
    setLookupResults(null);
    setLookupMatchType(null);
    try {
      const res = await fetch(`/api/workforce-monitoring/lookup?q=${encodeURIComponent(q)}`);
      const data = await res.json().catch(() => null);
      if (!data) { setLookupError('Unexpected server response'); return; }
      if (res.status === 404) { setLookupError('No task found for that ID or task key'); return; }
      if (!res.ok) { setLookupError(data.error || 'Lookup failed'); return; }
      if (!Array.isArray(data.results)) { setLookupError('Unexpected server response'); return; }
      setLookupResults(data.results);
      setLookupMatchType(data.matchType);
    } catch {
      setLookupError('Network error — please try again');
    } finally {
      setLookupLoading(false);
    }
  };

  // ── Deep-dive analysis ───────────────────────────────────────────────────

  const fetchDeepDive = useCallback(async () => {
    setDeepDiveLoading(true);
    setDeepDiveError(null);
    try {
      const params = new URLSearchParams({ email });
      if (environment) params.set('environment', environment);
      const res = await fetch(`/api/workforce-monitoring/deep-dive?${params.toString()}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) { setDeepDiveError(data?.error ?? 'Failed to load analysis data'); return; }
      setDeepDiveTasks(data.tasks ?? []);
      setDeepDiveSummary(data.summary ?? null);
    } catch {
      setDeepDiveError('Network error — please try again');
    } finally {
      setDeepDiveLoading(false);
    }
  }, [email, environment]);

  const runDeepDiveAnalysis = async () => {
    setDeepDiveAnalyzing(true);
    setDeepDiveAnalyzeResult(null);
    setDeepDiveError(null);
    try {
      const res = await fetch('/api/workforce-monitoring/deep-dive/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, ...(environment ? { environment } : {}) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setDeepDiveError(data?.error ?? 'Analysis failed'); return; }
      setDeepDiveAnalyzeResult(data.message ?? 'Analysis complete.');
      await fetchDeepDive();
    } catch {
      setDeepDiveError('Network error — please try again');
    } finally {
      setDeepDiveAnalyzing(false);
    }
  };

  // ── Pagination ────────────────────────────────────────────────────────────

  const goTaskPage = async (page: number) => {
    setTaskPage(page);
    setTaskPageLoading(true);
    try {
      const p = new URLSearchParams({ email, page: String(page), limit: String(PAGE_SIZE), type: 'TASK' });
      if (environment) p.set('environment', environment);
      if (latestOnly) p.set('latestOnly', 'true');
      const res = await fetch(`/api/workforce-monitoring/worker?${p.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks ?? []);
        setExpandedRecord(null);
      }
    } finally {
      setTaskPageLoading(false);
    }
  };

  const goFeedbackPage = async (page: number) => {
    setFeedbackPage(page);
    setFeedbackPageLoading(true);
    try {
      const p = new URLSearchParams({ email, page: String(page), limit: String(PAGE_SIZE), type: 'FEEDBACK' });
      if (environment) p.set('environment', environment);
      const res = await fetch(`/api/workforce-monitoring/worker?${p.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setFeedback(data.feedback ?? []);
        setExpandedRecord(null);
      }
    } finally {
      setFeedbackPageLoading(false);
    }
  };

  // ── Render states ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Loader2 className="animate-spin" size={48} color="var(--accent)" />
      </div>
    );
  }

  if (!authorized) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', textAlign: 'center' }}>
        <div style={{ padding: '16px', background: 'rgba(255,77,77,0.1)', borderRadius: '16px', marginBottom: '24px' }}>
          <ShieldAlert size={64} color="#ff4d4d" />
        </div>
        <h1 style={{ fontSize: '2rem', marginBottom: '16px' }}>Access Denied</h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '24px' }}>Fleet role or higher required.</p>
        <button onClick={() => router.push('/')} className="btn-primary" style={{ padding: '12px 32px' }}>Return to Dashboard</button>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '48px' }}>
        <AlertTriangle size={48} color="#ff4d4d" style={{ marginBottom: '16px' }} />
        <p style={{ color: '#ff4d4d' }}>{error}</p>
        <button onClick={() => router.push('/workforce-monitoring')} className="btn-primary" style={{ padding: '12px 32px', marginTop: '24px' }}>Back to Workers</button>
      </div>
    );
  }

  const activeFlags = flags.filter(f => f.status === 'OPEN' || f.status === 'UNDER_REVIEW');

  // ── Tab styles ────────────────────────────────────────────────────────────

  const tabStyle = (tab: Tab) => ({
    padding: '10px 20px',
    cursor: 'pointer',
    background: 'transparent',
    border: 'none',
    borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
    color: activeTab === tab ? 'white' : 'rgba(255,255,255,0.5)',
    fontWeight: activeTab === tab ? 600 : 400,
    fontSize: '0.875rem',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'color 0.15s',
  });

  // ── Sub-renders ───────────────────────────────────────────────────────────

  const renderRecordRow = (record: DataRecord, type: 'TASK' | 'FEEDBACK') => {
    const taskKey = record.metadata?.task_key ?? null;
    const isExpanded = expandedRecord === record.id;
    return (
      <div key={record.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div
          onClick={() => setExpandedRecord(isExpanded ? null : record.id)}
          style={{ display: 'flex', gap: '16px', padding: '14px 16px', cursor: 'pointer', transition: 'background 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap' }}>
              {taskKey && (
                <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '4px', color: 'rgba(255,255,255,0.7)' }}>
                  {taskKey}
                </span>
              )}
              {record.environment && (
                <span style={{ fontSize: '0.75rem', background: 'rgba(var(--accent-rgb),0.1)', color: 'var(--accent)', padding: '2px 8px', borderRadius: '4px' }}>
                  {record.environment}
                </span>
              )}
              {record.hasBeenReviewed && (
                <span style={{ fontSize: '0.75rem', color: 'rgba(74,222,128,0.8)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <CheckCircle size={11} /> Reviewed
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>
              {truncate(record.content, 200)}
            </p>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {formatDate(record.createdAt)}
          </div>
        </div>
        {isExpanded && (
          <div style={{ padding: '0 16px 16px', background: 'rgba(0,0,0,0.2)' }}>
            <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)', whiteSpace: 'pre-wrap', margin: '0 0 12px' }}>{record.content}</p>
            {record.alignmentAnalysis && (
              <details style={{ marginTop: '8px' }}>
                <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>Alignment Analysis</summary>
                <pre style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', whiteSpace: 'pre-wrap', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '6px', margin: 0 }}>
                  {record.alignmentAnalysis}
                </pre>
              </details>
            )}
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', marginTop: '8px' }}>
              ID: <code style={{ fontFamily: 'monospace' }}>{record.id}</code>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPagination = (
    currentPage: number,
    totalCount: number,
    isLoading: boolean,
    onGo: (p: number) => void,
  ) => {
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    if (totalPages <= 1) return null;
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap', gap: '8px' }}>
        <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)' }}>
          {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount.toLocaleString()}
        </span>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button onClick={() => onGo(1)} disabled={currentPage === 1 || isLoading} style={{ padding: '5px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: currentPage === 1 ? 'rgba(255,255,255,0.2)' : 'white', cursor: currentPage === 1 || isLoading ? 'not-allowed' : 'pointer', fontSize: '0.8rem' }}>
            First
          </button>
          <button onClick={() => onGo(currentPage - 1)} disabled={currentPage === 1 || isLoading} style={{ padding: '5px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: currentPage === 1 ? 'rgba(255,255,255,0.2)' : 'white', cursor: currentPage === 1 || isLoading ? 'not-allowed' : 'pointer' }}>
            <ChevronLeft size={13} />
          </button>
          <span style={{ padding: '5px 12px', fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)', minWidth: '72px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            {isLoading ? <Loader2 size={13} className="animate-spin" /> : `${currentPage} / ${totalPages}`}
          </span>
          <button onClick={() => onGo(currentPage + 1)} disabled={currentPage === totalPages || isLoading} style={{ padding: '5px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: currentPage === totalPages ? 'rgba(255,255,255,0.2)' : 'white', cursor: currentPage === totalPages || isLoading ? 'not-allowed' : 'pointer' }}>
            <ChevronRight size={13} />
          </button>
          <button onClick={() => onGo(totalPages)} disabled={currentPage === totalPages || isLoading} style={{ padding: '5px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: currentPage === totalPages ? 'rgba(255,255,255,0.2)' : 'white', cursor: currentPage === totalPages || isLoading ? 'not-allowed' : 'pointer', fontSize: '0.8rem' }}>
            Last
          </button>
        </div>
      </div>
    );
  };

  const renderTasksTab = () => {
    const totalPages = Math.max(1, Math.ceil(totalTasks / PAGE_SIZE));
    return (
      <div>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {totalTasks.toLocaleString()} {latestOnly ? 'unique' : 'total'} task{totalTasks !== 1 ? 's' : ''}
            {totalPages > 1 && ` · page ${taskPage} of ${totalPages}`}
            {taskPageLoading && <Loader2 size={13} className="animate-spin" />}
          </span>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem', color: latestOnly ? 'white' : 'rgba(255,255,255,0.45)', userSelect: 'none' }}>
            <div
              onClick={() => setLatestOnly(v => !v)}
              style={{
                width: '32px', height: '18px', borderRadius: '9px', position: 'relative', cursor: 'pointer', flexShrink: 0,
                background: latestOnly ? 'var(--accent)' : 'rgba(255,255,255,0.12)',
                transition: 'background 0.2s',
              }}
            >
              <div style={{
                position: 'absolute', top: '3px', width: '12px', height: '12px', borderRadius: '50%', background: 'white',
                left: latestOnly ? '17px' : '3px', transition: 'left 0.2s',
              }} />
            </div>
            Latest versions only
          </label>
        </div>
        {tasks.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>No tasks found.</div>
        ) : (
          <>
            <div style={{ opacity: taskPageLoading ? 0.5 : 1, transition: 'opacity 0.15s' }}>
              {tasks.map(r => renderRecordRow(r, 'TASK'))}
            </div>
            {renderPagination(taskPage, totalTasks, taskPageLoading, goTaskPage)}
          </>
        )}
      </div>
    );
  };

  const renderFeedbackTab = () => {
    const totalPages = Math.max(1, Math.ceil(totalFeedback / PAGE_SIZE));
    return (
      <div>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {totalFeedback.toLocaleString()} total feedback record{totalFeedback !== 1 ? 's' : ''}
          {totalPages > 1 && ` · page ${feedbackPage} of ${totalPages}`}
          {feedbackPageLoading && <Loader2 size={13} className="animate-spin" />}
        </div>
        {feedback.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>No feedback found.</div>
        ) : (
          <>
            <div style={{ opacity: feedbackPageLoading ? 0.5 : 1, transition: 'opacity 0.15s' }}>
              {feedback.map(r => renderRecordRow(r, 'FEEDBACK'))}
            </div>
            {renderPagination(feedbackPage, totalFeedback, feedbackPageLoading, goFeedbackPage)}
          </>
        )}
      </div>
    );
  };

  const renderSimilarityTab = () => {
    const SIM_PAGE_SIZE = 25;

    const similarityColor = (pct: number) => {
      if (pct >= 90) return '#ff4d4d';
      if (pct >= 75) return 'rgba(251,113,33,0.9)';
      if (pct >= 60) return 'rgba(251,191,36,0.9)';
      return 'rgba(74,222,128,0.8)';
    };

    return (
      <div style={{ padding: '24px' }}>
        {/* Controls bar */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '20px', padding: '14px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px' }}>
          {/* Threshold */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap' }}>Min similarity</span>
            <input
              type="range" min={10} max={95} step={5} value={simThreshold}
              onChange={e => setSimThreshold(Number(e.target.value))}
              style={{ width: '80px', accentColor: 'var(--accent)' }}
            />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, minWidth: '36px', color: 'white' }}>{simThreshold}%</span>
          </div>

          {/* Scope */}
          <div style={{ display: 'flex', gap: '0', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', overflow: 'hidden' }}>
            {(['all', 'environment'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSimScope(s)}
                style={{
                  padding: '5px 12px', fontSize: '0.8rem', cursor: 'pointer', border: 'none',
                  background: simScope === s ? 'rgba(var(--accent-rgb),0.2)' : 'transparent',
                  color: simScope === s ? 'var(--accent)' : 'rgba(255,255,255,0.4)',
                }}
              >
                {s === 'all' ? 'All workers' : 'Same environment'}
              </button>
            ))}
          </div>

          {/* Latest only */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '0.8rem', color: simLatestOnly ? 'white' : 'rgba(255,255,255,0.4)', userSelect: 'none' }}>
            <div
              onClick={() => { setSimLatestOnly(v => !v); fetchSimTasks(1, !simLatestOnly); setSimSelected(null); setSimResults(null); }}
              style={{ width: '28px', height: '16px', borderRadius: '8px', position: 'relative', cursor: 'pointer', flexShrink: 0, background: simLatestOnly ? 'var(--accent)' : 'rgba(255,255,255,0.12)', transition: 'background 0.2s' }}
            >
              <div style={{ position: 'absolute', top: '2px', width: '12px', height: '12px', borderRadius: '50%', background: 'white', left: simLatestOnly ? '14px' : '2px', transition: 'left 0.2s' }} />
            </div>
            Latest only
          </label>

          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', marginLeft: 'auto' }}>
            {simTasksTotal > 0 ? `${simTasksTotal} task${simTasksTotal !== 1 ? 's' : ''} with embeddings` : ''}
          </span>
        </div>

        {simError && (
          <div style={{ padding: '10px 14px', background: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.2)', borderRadius: '8px', color: '#ff4d4d', fontSize: '0.875rem', marginBottom: '16px' }}>
            {simError}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: simSelected ? '1fr 1fr' : '1fr', gap: '16px' }}>
          {/* Left: task browser */}
          <div>
            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', marginBottom: '8px' }}>
              Select a task to find similar prompts
            </div>
            {simTasksLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
                <Loader2 size={28} className="animate-spin" color="var(--accent)" />
              </div>
            ) : simTasks.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.875rem' }}>
                No tasks with embeddings found.{' '}
                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.8rem' }}>Tasks need to be vectorized first.</span>
              </div>
            ) : (
              <>
                <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', overflow: 'hidden' }}>
                  {simTasks.map(task => {
                    const isSelected = simSelected?.id === task.id;
                    return (
                      <div
                        key={task.id}
                        onClick={() => runSimilarityCompare(task)}
                        style={{
                          padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)',
                          background: isSelected ? 'rgba(var(--accent-rgb),0.1)' : 'transparent',
                          borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '3px', flexWrap: 'wrap' }}>
                          {task.taskKey && (
                            <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', background: 'rgba(255,255,255,0.07)', padding: '1px 6px', borderRadius: '4px', color: 'rgba(255,255,255,0.6)' }}>
                              {task.taskKey}
                            </span>
                          )}
                          {task.environment && (
                            <span style={{ fontSize: '0.7rem', background: 'rgba(var(--accent-rgb),0.08)', color: 'var(--accent)', padding: '1px 6px', borderRadius: '4px' }}>
                              {task.environment}
                            </span>
                          )}
                          <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)', marginLeft: 'auto' }}>
                            {formatDate(task.createdAt as unknown as string)}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: isSelected ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.6)', lineHeight: 1.45 }}>
                          {truncate(task.content, 120)}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {simTasksTotalPages > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', flexWrap: 'wrap', gap: '6px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>
                      {((simTasksPage - 1) * SIM_PAGE_SIZE) + 1}–{Math.min(simTasksPage * SIM_PAGE_SIZE, simTasksTotal)} of {simTasksTotal}
                    </span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => fetchSimTasks(1)} disabled={simTasksPage === 1 || simTasksLoading} style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '5px', color: simTasksPage === 1 ? 'rgba(255,255,255,0.2)' : 'white', cursor: simTasksPage === 1 ? 'not-allowed' : 'pointer', fontSize: '0.75rem' }}>First</button>
                      <button onClick={() => fetchSimTasks(simTasksPage - 1)} disabled={simTasksPage === 1 || simTasksLoading} style={{ padding: '4px 6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '5px', color: simTasksPage === 1 ? 'rgba(255,255,255,0.2)' : 'white', cursor: simTasksPage === 1 ? 'not-allowed' : 'pointer' }}><ChevronLeft size={12} /></button>
                      <span style={{ padding: '4px 10px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>{simTasksPage} / {simTasksTotalPages}</span>
                      <button onClick={() => fetchSimTasks(simTasksPage + 1)} disabled={simTasksPage === simTasksTotalPages || simTasksLoading} style={{ padding: '4px 6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '5px', color: simTasksPage === simTasksTotalPages ? 'rgba(255,255,255,0.2)' : 'white', cursor: simTasksPage === simTasksTotalPages ? 'not-allowed' : 'pointer' }}><ChevronRight size={12} /></button>
                      <button onClick={() => fetchSimTasks(simTasksTotalPages)} disabled={simTasksPage === simTasksTotalPages || simTasksLoading} style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '5px', color: simTasksPage === simTasksTotalPages ? 'rgba(255,255,255,0.2)' : 'white', cursor: simTasksPage === simTasksTotalPages ? 'not-allowed' : 'pointer', fontSize: '0.75rem' }}>Last</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right: results */}
          {simSelected && (
            <div>
              <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Similar tasks</span>
                {simResultsLoading && <Loader2 size={12} className="animate-spin" />}
                {simResults !== null && !simResultsLoading && (
                  <span style={{ color: simResults.length > 0 ? 'rgba(251,191,36,0.8)' : 'rgba(74,222,128,0.8)' }}>
                    {simResults.length} match{simResults.length !== 1 ? 'es' : ''} ≥{simThreshold}%
                  </span>
                )}
              </div>

              {simResultsLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
                  <Loader2 size={28} className="animate-spin" color="var(--accent)" />
                </div>
              ) : simResults !== null && simResults.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'rgba(74,222,128,0.7)', fontSize: '0.875rem', border: '1px solid rgba(74,222,128,0.1)', borderRadius: '8px', background: 'rgba(74,222,128,0.04)' }}>
                  <CheckCircle size={28} style={{ marginBottom: '10px', opacity: 0.6 }} />
                  <p style={{ margin: 0 }}>No similar tasks found above {simThreshold}% threshold.</p>
                </div>
              ) : simResults !== null ? (
                <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', overflow: 'hidden', maxHeight: '600px', overflowY: 'auto' }}>
                  {simResults.map(match => {
                    const isExpanded = simExpandedMatch === match.taskId;
                    const color = similarityColor(match.similarity);
                    return (
                      <div key={match.taskId} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div
                          onClick={() => setSimExpandedMatch(isExpanded ? null : match.taskId)}
                          style={{ padding: '10px 14px', cursor: 'pointer', transition: 'background 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color, minWidth: '42px' }}>{match.similarity}%</span>
                            {match.isSameWorker && (
                              <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '10px', background: 'rgba(251,113,33,0.12)', color: 'rgba(251,113,33,0.9)' }}>
                                Same worker
                              </span>
                            )}
                            {match.taskKey && (
                              <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', background: 'rgba(255,255,255,0.07)', padding: '1px 6px', borderRadius: '4px', color: 'rgba(255,255,255,0.55)' }}>
                                {match.taskKey}
                              </span>
                            )}
                            {match.environment && (
                              <span style={{ fontSize: '0.7rem', background: 'rgba(var(--accent-rgb),0.08)', color: 'var(--accent)', padding: '1px 6px', borderRadius: '4px' }}>
                                {match.environment}
                              </span>
                            )}
                            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginLeft: 'auto' }}>
                              {formatDate(match.createdAt)}
                            </span>
                          </div>
                          <p style={{ margin: '0 0 2px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.45 }}>
                            {truncate(match.content, 120)}
                          </p>
                          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>
                            {match.createdBy}
                            {match.createdByEmail && match.createdByEmail !== match.createdBy && (
                              <> · <button
                                onClick={e => { e.stopPropagation(); router.push(`/workforce-monitoring/worker/${encodeURIComponent(match.createdByEmail!)}`); }}
                                style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}
                              >
                                View worker
                              </button></>
                            )}
                          </div>
                        </div>
                        {isExpanded && (
                          <div style={{ padding: '0 14px 14px', background: 'rgba(0,0,0,0.15)' }}>
                            <pre style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.65)', whiteSpace: 'pre-wrap', lineHeight: 1.6, background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px' }}>
                              {match.content}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderLookupTab = () => (
    <div style={{ padding: '24px' }}>
      <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '20px', fontSize: '0.875rem' }}>
        Look up a task by its record ID or task key to confirm ownership and view details.
      </p>

      {/* Search input */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Enter task key or record ID…"
          value={lookupQuery}
          onChange={e => { setLookupQuery(e.target.value); setLookupResults(null); setLookupError(null); }}
          onKeyDown={e => e.key === 'Enter' && performLookup()}
          style={{ flex: 1, padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', outline: 'none', fontSize: '0.875rem' }}
        />
        <button
          onClick={performLookup}
          disabled={!lookupQuery.trim() || lookupLoading}
          className="btn-primary"
          style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          {lookupLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Lookup
        </button>
      </div>

      {lookupError && (
        <div style={{ padding: '12px 16px', background: 'rgba(255,77,77,0.1)', borderRadius: '8px', color: '#ff4d4d', fontSize: '0.875rem', marginBottom: '16px' }}>
          {lookupError}
        </div>
      )}

      {lookupResults && lookupResults.length > 0 && (
        <div>
          {lookupMatchType === 'fuzzy' && (
            <div style={{ marginBottom: '12px', fontSize: '0.8rem', color: 'rgba(251,191,36,0.8)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={13} />
              {lookupResults.length === 1 ? 'No exact match — showing closest partial match' : `No exact match — ${lookupResults.length} partial matches`}
            </div>
          )}
          {lookupResults.map(result => (
            <div key={result.recordId} style={{ padding: '16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginBottom: '2px' }}>Email</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: result.email === email ? 600 : 400, color: result.email === email ? 'rgba(74,222,128,0.9)' : 'white' }}>
                    {result.email === email ? '✓ ' : ''}{result.email}
                  </div>
                </div>
                {result.name && (
                  <div style={{ flex: 1, minWidth: '160px' }}>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginBottom: '2px' }}>Name</div>
                    <div style={{ fontSize: '0.875rem' }}>{result.name}</div>
                  </div>
                )}
                {result.environment && (
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginBottom: '2px' }}>Environment</div>
                    <div style={{ fontSize: '0.875rem' }}>{result.environment}</div>
                  </div>
                )}
                {result.taskKey && (
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginBottom: '2px' }}>Task Key</div>
                    <code style={{ fontSize: '0.8rem', fontFamily: 'monospace', background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px' }}>{result.taskKey}</code>
                  </div>
                )}
              </div>
              <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>
                Record ID: <code style={{ fontFamily: 'monospace' }}>{result.recordId}</code>
              </div>
              {result.email !== email && (
                <button
                  onClick={() => router.push(`/workforce-monitoring/worker/${encodeURIComponent(result.email)}`)}
                  style={{ marginTop: '10px', padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <User size={12} /> View this worker
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderFlagsTab = () => {
    const flagTypeLabel = (t: string) => t === 'REVIEW_REQUESTED' ? 'Review Requested' : t.replace(/_/g, ' ');
    return (
      <div style={{ padding: '24px' }}>
        {/* New flag button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
          <button
            onClick={() => setShowFlagForm(true)}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontSize: '0.875rem' }}
          >
            <Plus size={14} /> New Flag
          </button>
        </div>

        {/* Flag creation form */}
        {showFlagForm && (
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 style={{ margin: 0 }}>New Flag for {workerName ?? email}</h4>
              <button onClick={() => { setShowFlagForm(false); setFlagFormError(null); }} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '6px' }}>Flag Type</label>
                <select
                  value={flagForm.flagType}
                  onChange={e => setFlagForm(f => ({ ...f, flagType: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', fontSize: '0.875rem' }}
                >
                  {FLAG_TYPES.map(t => <option key={t} value={t}>{flagTypeLabel(t)}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '6px' }}>Severity</label>
                <select
                  value={flagForm.severity}
                  onChange={e => setFlagForm(f => ({ ...f, severity: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', fontSize: '0.875rem' }}
                >
                  {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '6px' }}>Reason <span style={{ color: '#ff4d4d' }}>*</span></label>
              <textarea
                value={flagForm.reason}
                onChange={e => setFlagForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="Describe the concern or issue…"
                rows={3}
                style={{ width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', fontSize: '0.875rem', resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '6px' }}>Notes (optional)</label>
              <textarea
                value={flagForm.notes}
                onChange={e => setFlagForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Additional context or links…"
                rows={2}
                style={{ width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', fontSize: '0.875rem', resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>
            {flagFormError && (
              <div style={{ padding: '8px 12px', background: 'rgba(255,77,77,0.1)', borderRadius: '6px', color: '#ff4d4d', fontSize: '0.8rem', marginBottom: '12px' }}>
                {flagFormError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowFlagForm(false); setFlagFormError(null); }} style={{ padding: '9px 18px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '0.875rem' }}>
                Cancel
              </button>
              <button onClick={createFlag} disabled={flagFormLoading} className="btn-primary" style={{ padding: '9px 18px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem' }}>
                {flagFormLoading ? <Loader2 size={13} className="animate-spin" /> : <Flag size={13} />}
                Create Flag
              </button>
            </div>
          </div>
        )}

        {/* Flags list */}
        {flags.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'rgba(255,255,255,0.3)' }}>
            <Flag size={40} style={{ marginBottom: '12px', opacity: 0.3 }} />
            <p>No flags for this worker.</p>
          </div>
        ) : (
          <div>
            {flags.map(flag => (
              <div key={flag.id} style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: SEVERITY_COLORS[flag.severity] ?? 'white', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>
                        {flag.severity}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: STATUS_COLORS[flag.status] ?? 'white', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>
                        {flag.status.replace(/_/g, ' ')}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: FLAG_TYPE_COLORS[flag.flagType] ?? 'rgba(255,255,255,0.5)', background: FLAG_TYPE_COLORS[flag.flagType] ? 'rgba(139,92,246,0.1)' : undefined, padding: FLAG_TYPE_COLORS[flag.flagType] ? '2px 8px' : undefined, borderRadius: FLAG_TYPE_COLORS[flag.flagType] ? '4px' : undefined }}>{flagTypeLabel(flag.flagType)}</span>
                    </div>
                    <p style={{ margin: '0 0 6px', fontSize: '0.875rem' }}>{flag.reason}</p>
                    {flag.notes && <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>{flag.notes}</p>}
                    {flag.resolutionNotes && (
                      <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: 'rgba(74,222,128,0.7)', borderLeft: '2px solid rgba(74,222,128,0.3)', paddingLeft: '8px' }}>
                        Resolution: {flag.resolutionNotes}
                      </p>
                    )}
                    <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>
                      Flagged {formatDateTime(flag.createdAt)}
                      {flag.createdByEmail && ` by ${flag.createdByEmail}`}
                      {flag.resolvedAt && ` · resolved ${formatDate(flag.resolvedAt)}`}
                    </div>
                  </div>
                  {(flag.status === 'OPEN' || flag.status === 'UNDER_REVIEW') && (
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      {flag.status === 'OPEN' && (
                        <button
                          onClick={() => setResolveTarget({ id: flag.id, action: 'UNDER_REVIEW' })}
                          style={{ padding: '5px 10px', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '6px', color: 'rgba(251,191,36,0.9)', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Clock size={11} /> Review
                        </button>
                      )}
                      <button
                        onClick={() => setResolveTarget({ id: flag.id, action: 'RESOLVED' })}
                        style={{ padding: '5px 10px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '6px', color: 'rgba(74,222,128,0.9)', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <CheckCircle size={11} /> Resolve
                      </button>
                      <button
                        onClick={() => setResolveTarget({ id: flag.id, action: 'DISMISSED' })}
                        style={{ padding: '5px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <X size={11} /> Dismiss
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Resolve dialog */}
        {resolveTarget && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
            <div style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '24px', width: '480px', maxWidth: '90vw' }}>
              <h3 style={{ margin: '0 0 16px' }}>
                {resolveTarget.action === 'UNDER_REVIEW' ? 'Mark as Under Review' : resolveTarget.action === 'RESOLVED' ? 'Resolve Flag' : 'Dismiss Flag'}
              </h3>
              <textarea
                value={resolutionNotes}
                onChange={e => setResolutionNotes(e.target.value)}
                placeholder="Resolution notes (optional)…"
                rows={3}
                style={{ width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', fontSize: '0.875rem', resize: 'vertical', boxSizing: 'border-box', marginBottom: '16px' }}
              />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => { setResolveTarget(null); setResolutionNotes(''); }} style={{ padding: '9px 18px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={resolveFlag} disabled={resolveLoading} className="btn-primary" style={{ padding: '9px 18px' }}>
                  {resolveLoading ? <Loader2 size={13} className="animate-spin" /> : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderDeepDiveTab = () => {
    const DD_FLAG_COLORS: Record<string, { bg: string; color: string }> = {
      ai:        { bg: 'rgba(139,92,246,0.15)', color: 'rgba(167,139,250,0.9)' },
      templated: { bg: 'rgba(251,113,33,0.12)', color: 'rgba(251,113,33,0.9)' },
      nonnative: { bg: 'rgba(59,130,246,0.12)', color: 'rgba(147,197,253,0.9)' },
      rapid:     { bg: 'rgba(239,68,68,0.12)',  color: 'rgba(252,165,165,0.9)' },
    };

    const filteredTasks = deepDiveTasks.filter(t => {
      if (deepDiveFlagFilter === 'ai') return t.isLikelyAIGenerated;
      if (deepDiveFlagFilter === 'templated') return t.isLikelyTemplated;
      if (deepDiveFlagFilter === 'nonnative') return t.isLikelyNonNative;
      if (deepDiveFlagFilter === 'rapid') return t.isRapidSubmission;
      return true;
    });

    const FlagBadge = ({ label, active, bg, color }: { label: string; active: boolean; bg: string; color: string }) =>
      active ? (
        <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '2px 7px', borderRadius: '10px', background: bg, color, whiteSpace: 'nowrap' }}>
          {label}
        </span>
      ) : null;

    return (
      <div style={{ padding: '24px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 600 }}>Deep-dive Analysis</h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)' }}>
              AI-powered authenticity check — flags AI-generated, templated, non-native, and rapid submissions.
            </p>
          </div>
          <button
            onClick={runDeepDiveAnalysis}
            disabled={deepDiveAnalyzing}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontSize: '0.875rem', flexShrink: 0 }}
          >
            {deepDiveAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
            {deepDiveAnalyzing ? 'Analyzing…' : deepDiveSummary && deepDiveSummary.analyzed > 0 ? 'Re-run Analysis' : 'Run Analysis'}
          </button>
        </div>

        {deepDiveAnalyzeResult && (
          <div style={{ padding: '10px 14px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '8px', color: 'rgba(74,222,128,0.9)', fontSize: '0.875rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={14} /> {deepDiveAnalyzeResult}
          </div>
        )}

        {deepDiveError && (
          <div style={{ padding: '10px 14px', background: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.2)', borderRadius: '8px', color: '#ff4d4d', fontSize: '0.875rem', marginBottom: '16px' }}>
            {deepDiveError}
          </div>
        )}

        {deepDiveLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
            <Loader2 size={32} className="animate-spin" color="var(--accent)" />
          </div>
        ) : deepDiveSummary ? (
          <>
            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
              {[
                { label: 'Total Tasks', value: deepDiveSummary.total, sub: `${deepDiveSummary.analyzed} analyzed`, color: 'rgba(255,255,255,0.8)' },
                { label: 'AI-Generated', value: `${deepDiveSummary.aiGeneratedPct}%`, sub: `${deepDiveSummary.aiGeneratedCount} tasks`, color: DD_FLAG_COLORS.ai.color },
                { label: 'Templated', value: `${deepDiveSummary.templatedPct}%`, sub: `${deepDiveSummary.templatedCount} tasks`, color: DD_FLAG_COLORS.templated.color },
                { label: 'Non-Native', value: `${deepDiveSummary.nonNativePct}%`, sub: `${deepDiveSummary.nonNativeCount} tasks`, color: DD_FLAG_COLORS.nonnative.color },
                { label: 'Rapid Submit', value: `${deepDiveSummary.rapidSubmissionPct}%`, sub: `${deepDiveSummary.rapidSubmissionCount} tasks`, color: DD_FLAG_COLORS.rapid.color },
              ].map(card => (
                <div key={card.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', padding: '14px 16px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>{card.label}</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: card.color, lineHeight: 1.1 }}>{card.value}</div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>{card.sub}</div>
                </div>
              ))}
            </div>

            {/* Filter bar */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
              {([
                { key: 'all', label: `All (${deepDiveTasks.length})` },
                { key: 'ai', label: `AI-Generated (${deepDiveSummary.aiGeneratedCount})` },
                { key: 'templated', label: `Templated (${deepDiveSummary.templatedCount})` },
                { key: 'nonnative', label: `Non-Native (${deepDiveSummary.nonNativeCount})` },
                { key: 'rapid', label: `Rapid Submit (${deepDiveSummary.rapidSubmissionCount})` },
              ] as const).map(f => (
                <button
                  key={f.key}
                  onClick={() => setDeepDiveFlagFilter(f.key)}
                  style={{
                    padding: '5px 12px', borderRadius: '20px', fontSize: '0.8rem', cursor: 'pointer', border: '1px solid',
                    background: deepDiveFlagFilter === f.key ? 'rgba(var(--accent-rgb),0.15)' : 'transparent',
                    borderColor: deepDiveFlagFilter === f.key ? 'var(--accent)' : 'rgba(255,255,255,0.12)',
                    color: deepDiveFlagFilter === f.key ? 'var(--accent)' : 'rgba(255,255,255,0.5)',
                    transition: 'all 0.15s',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Task table */}
            {filteredTasks.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.875rem' }}>
                No tasks match this filter.
              </div>
            ) : (
              <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', overflow: 'hidden' }}>
                {filteredTasks.map(task => {
                  const isExpanded = deepDiveExpandedTask === task.id;
                  const hasPending = task.analysisStatus === 'PENDING';
                  return (
                    <div key={task.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <div
                        onClick={() => setDeepDiveExpandedTask(isExpanded ? null : task.id)}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 14px', cursor: 'pointer', transition: 'background 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '4px', alignItems: 'center' }}>
                            {hasPending && (
                              <span style={{ fontSize: '0.7rem', padding: '2px 7px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}>
                                Pending analysis
                              </span>
                            )}
                            <FlagBadge label="AI-Generated" active={!!task.isLikelyAIGenerated} bg={DD_FLAG_COLORS.ai.bg} color={DD_FLAG_COLORS.ai.color} />
                            <FlagBadge label="Templated" active={!!task.isLikelyTemplated} bg={DD_FLAG_COLORS.templated.bg} color={DD_FLAG_COLORS.templated.color} />
                            <FlagBadge label="Non-Native" active={!!task.isLikelyNonNative} bg={DD_FLAG_COLORS.nonnative.bg} color={DD_FLAG_COLORS.nonnative.color} />
                            <FlagBadge label="Rapid Submit" active={task.isRapidSubmission} bg={DD_FLAG_COLORS.rapid.bg} color={DD_FLAG_COLORS.rapid.color} />
                            {task.environment && (
                              <span style={{ fontSize: '0.7rem', padding: '2px 7px', borderRadius: '10px', background: 'rgba(var(--accent-rgb),0.08)', color: 'var(--accent)' }}>
                                {task.environment}
                              </span>
                            )}
                          </div>
                          <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
                            {truncate(task.content, 180)}
                          </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>
                            {deepDiveFlagFilter === 'rapid' ? formatDateTime(task.createdAt) : formatDate(task.createdAt)}
                          </span>
                          {isExpanded ? <ChevronUp size={14} color="rgba(255,255,255,0.3)" /> : <ChevronDown size={14} color="rgba(255,255,255,0.3)" />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div style={{ padding: '0 14px 14px', background: 'rgba(0,0,0,0.15)' }}>
                          {/* Full content */}
                          <pre style={{ margin: '0 0 12px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.65)', whiteSpace: 'pre-wrap', lineHeight: 1.6, background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px' }}>
                            {task.content}
                          </pre>

                          {/* Gap info */}
                          {task.gapFromPreviousMin !== null && (
                            <div style={{ fontSize: '0.75rem', color: task.isRapidSubmission ? DD_FLAG_COLORS.rapid.color : 'rgba(255,255,255,0.3)', marginBottom: '8px' }}>
                              Gap from previous: {task.gapFromPreviousMin} min
                              {task.isRapidSubmission && ' ⚡ rapid submission'}
                            </div>
                          )}

                          {/* Analysis detail cards */}
                          {task.analysisStatus === 'COMPLETED' && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px', marginTop: '8px' }}>
                              {task.isLikelyAIGenerated !== null && (
                                <div style={{ background: task.isLikelyAIGenerated ? DD_FLAG_COLORS.ai.bg : 'rgba(255,255,255,0.02)', border: `1px solid ${task.isLikelyAIGenerated ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '6px', padding: '10px 12px' }}>
                                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: DD_FLAG_COLORS.ai.color, marginBottom: '4px' }}>AI-Generated</div>
                                  <div style={{ fontSize: '0.8rem', color: task.isLikelyAIGenerated ? 'white' : 'rgba(255,255,255,0.4)' }}>
                                    {task.isLikelyAIGenerated ? `Yes (${task.aiGeneratedConfidence}% confidence)` : 'No'}
                                  </div>
                                  {task.aiGeneratedIndicators && task.aiGeneratedIndicators.length > 0 && (
                                    <ul style={{ margin: '6px 0 0', padding: '0 0 0 16px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                                      {task.aiGeneratedIndicators.map((ind, i) => <li key={i}>{ind}</li>)}
                                    </ul>
                                  )}
                                </div>
                              )}
                              {task.isLikelyTemplated !== null && (
                                <div style={{ background: task.isLikelyTemplated ? DD_FLAG_COLORS.templated.bg : 'rgba(255,255,255,0.02)', border: `1px solid ${task.isLikelyTemplated ? 'rgba(251,113,33,0.2)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '6px', padding: '10px 12px' }}>
                                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: DD_FLAG_COLORS.templated.color, marginBottom: '4px' }}>Templated</div>
                                  <div style={{ fontSize: '0.8rem', color: task.isLikelyTemplated ? 'white' : 'rgba(255,255,255,0.4)' }}>
                                    {task.isLikelyTemplated ? `Yes (${task.templateConfidence}% confidence)` : 'No'}
                                    {task.detectedTemplate && `: ${task.detectedTemplate}`}
                                  </div>
                                  {task.templateIndicators && task.templateIndicators.length > 0 && (
                                    <ul style={{ margin: '6px 0 0', padding: '0 0 0 16px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                                      {task.templateIndicators.map((ind, i) => <li key={i}>{ind}</li>)}
                                    </ul>
                                  )}
                                </div>
                              )}
                              {task.isLikelyNonNative !== null && (
                                <div style={{ background: task.isLikelyNonNative ? DD_FLAG_COLORS.nonnative.bg : 'rgba(255,255,255,0.02)', border: `1px solid ${task.isLikelyNonNative ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '6px', padding: '10px 12px' }}>
                                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: DD_FLAG_COLORS.nonnative.color, marginBottom: '4px' }}>Non-Native</div>
                                  <div style={{ fontSize: '0.8rem', color: task.isLikelyNonNative ? 'white' : 'rgba(255,255,255,0.4)' }}>
                                    {task.isLikelyNonNative ? `Yes (${task.nonNativeConfidence}% confidence)` : 'No'}
                                  </div>
                                  {task.nonNativeIndicators && task.nonNativeIndicators.length > 0 && (
                                    <ul style={{ margin: '6px 0 0', padding: '0 0 0 16px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                                      {task.nonNativeIndicators.map((ind, i) => <li key={i}>{ind}</li>)}
                                    </ul>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {task.overallAssessment && (
                            <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic', lineHeight: 1.5 }}>
                              {task.overallAssessment}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '48px', color: 'rgba(255,255,255,0.3)' }}>
            <Brain size={40} style={{ marginBottom: '12px', opacity: 0.3 }} />
            <p style={{ marginBottom: '16px' }}>No analysis data yet. Run analysis to get started.</p>
          </div>
        )}
      </div>
    );
  };

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Back nav */}
      <button
        onClick={() => router.push('/workforce-monitoring')}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '0.875rem', marginBottom: '24px', padding: 0 }}
      >
        <ArrowLeft size={14} /> Back to Workers
      </button>

      {/* Worker header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(var(--accent-rgb),0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={22} color="var(--accent)" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 4px' }}>{workerName ?? 'Unknown Worker'}</h1>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem' }}>{email}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{totalTasks.toLocaleString()}</div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>Tasks</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{totalFeedback.toLocaleString()}</div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>Feedback</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: activeFlags.length > 0 ? 'rgba(251,113,33,0.9)' : 'rgba(255,255,255,0.3)' }}>
              {activeFlags.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>Active Flags</div>
          </div>
        </div>
      </div>

      {/* Environment filter */}
      {environments.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <Filter size={14} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
          <select
            value={environment}
            onChange={e => setEnvironment(e.target.value)}
            style={{ padding: '7px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', color: environment ? 'white' : 'rgba(255,255,255,0.45)', cursor: 'pointer', fontSize: '0.875rem' }}
          >
            <option value="">All environments</option>
            {environments.map(env => (
              <option key={env.name} value={env.name}>{env.name} ({env.count.toLocaleString()})</option>
            ))}
          </select>
          {environment && (
            <button
              onClick={() => setEnvironment('')}
              style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', padding: '4px 8px' }}
            >
              <X size={12} /> Clear
            </button>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '0', display: 'flex', gap: '4px', overflowX: 'auto' }}>
        <button style={tabStyle('tasks')} onClick={() => setActiveTab('tasks')}>
          <FileText size={14} /> Tasks ({totalTasks.toLocaleString()})
        </button>
        <button style={tabStyle('feedback')} onClick={() => setActiveTab('feedback')}>
          <MessageSquare size={14} /> Feedback ({totalFeedback.toLocaleString()})
        </button>
        <button style={tabStyle('similarity')} onClick={() => setActiveTab('similarity')}>
          <ScanSearch size={14} /> Task Similarity
        </button>
        <button style={tabStyle('lookup')} onClick={() => setActiveTab('lookup')}>
          <Search size={14} /> Task Lookup
        </button>
        <button style={tabStyle('flags')} onClick={() => setActiveTab('flags')}>
          <Flag size={14} />
          Flags
          {activeFlags.length > 0 && (
            <span style={{ background: 'rgba(251,113,33,0.2)', color: 'rgba(251,113,33,0.9)', borderRadius: '10px', padding: '1px 7px', fontSize: '0.75rem', fontWeight: 600 }}>
              {activeFlags.length}
            </span>
          )}
        </button>
        <button style={tabStyle('deepdive')} onClick={() => setActiveTab('deepdive')}>
          <Brain size={14} /> Deep-dive
        </button>
      </div>

      {/* Tab content */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderTop: 'none', borderRadius: '0 0 10px 10px' }}>
        {activeTab === 'tasks' && renderTasksTab()}
        {activeTab === 'feedback' && renderFeedbackTab()}
        {activeTab === 'similarity' && renderSimilarityTab()}
        {activeTab === 'lookup' && renderLookupTab()}
        {activeTab === 'flags' && renderFlagsTab()}
        {activeTab === 'deepdive' && renderDeepDiveTab()}
      </div>
    </div>
  );
}
