'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Task {
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

interface Summary {
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

interface UserOption {
  email: string;
  name: string | null;
  taskCount: number;
}

type FlagFilter = 'all' | 'ai' | 'templated' | 'non-native' | 'rapid';

const FLAG_COLORS = {
  ai: { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)', text: '#f87171' },
  templated: { bg: 'rgba(168,85,247,0.15)', border: 'rgba(168,85,247,0.4)', text: '#c084fc' },
  nonNative: { bg: 'rgba(251,146,60,0.15)', border: 'rgba(251,146,60,0.4)', text: '#fb923c' },
  rapid: { bg: 'rgba(234,179,8,0.15)', border: 'rgba(234,179,8,0.4)', text: '#facc15' },
};

function FlagBadge({ label, color }: { label: string; color: { bg: string; border: string; text: string } }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: '10px',
      fontSize: '11px',
      fontWeight: 700,
      backgroundColor: color.bg,
      border: `1px solid ${color.border}`,
      color: color.text,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

function StatCard({ label, count, pct, color }: { label: string; count: number; pct: number; color: string }) {
  return (
    <div style={{
      background: 'var(--glass)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '20px 24px',
      minWidth: '160px',
      flex: 1,
    }}>
      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>{label}</div>
      <div style={{ fontSize: '28px', fontWeight: 700, color, lineHeight: 1 }}>{count}</div>
      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>{pct}% of all tasks</div>
    </div>
  );
}

// ── Task Lookup (find creator by task_key or task_id) ──────────────────────

function TaskLookup({ defaultEnvironment }: { defaultEnvironment: string }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ recordId: string; email: string; name: string | null; environment: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lookup = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(`/api/prompt-authenticity/user-deep-dive/lookup?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Lookup failed');
      } else {
        setResult(data);
      }
    } catch (err) {
      console.error('[TaskLookup]', err);
      setError('Lookup failed');
    } finally {
      setLoading(false);
    }
  };

  const navigateToUser = () => {
    if (!result) return;
    const params = new URLSearchParams({ email: result.email });
    const env = defaultEnvironment || result.environment;
    if (env) params.set('environment', env);
    router.push(`/task-creator-deep-dive?${params}`);
  };

  return (
    <div style={{
      background: 'var(--glass)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '24px',
    }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>
        Find Creator by Task Key or Task ID
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          placeholder="Enter task_key or record ID..."
          value={query}
          onChange={e => { setQuery(e.target.value); setResult(null); setError(null); }}
          onKeyDown={e => e.key === 'Enter' && lookup()}
          style={{
            flex: 1,
            padding: '10px 12px',
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'rgba(255,255,255,0.9)',
            fontSize: '14px',
          }}
        />
        <button
          onClick={lookup}
          disabled={loading || !query.trim()}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: '1px solid rgba(99,102,241,0.5)',
            background: loading || !query.trim() ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.2)',
            color: loading || !query.trim() ? 'rgba(165,180,252,0.4)' : '#a5b4fc',
            fontSize: '13px',
            fontWeight: 600,
            cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: '12px', fontSize: '13px', color: '#f87171' }}>{error}</div>
      )}

      {result && (
        <div style={{
          marginTop: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'rgba(99,102,241,0.08)',
          border: '1px solid rgba(99,102,241,0.3)',
          borderRadius: '8px',
          gap: '12px',
          flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontWeight: 500, fontSize: '14px', color: 'rgba(255,255,255,0.9)' }}>
              {result.name ?? result.email}
            </div>
            {result.name && (
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginTop: '2px' }}>{result.email}</div>
            )}
            {result.environment && (
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '3px' }}>
                Environment: {result.environment}
              </div>
            )}
          </div>
          <button
            onClick={navigateToUser}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid rgba(99,102,241,0.5)',
              background: 'rgba(99,102,241,0.2)',
              color: '#a5b4fc',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            View Deep Dive →
          </button>
        </div>
      )}
    </div>
  );
}

// ── User Selector (landing state) ──────────────────────────────────────────

function UserSelector({ environments, envError }: { environments: string[]; envError: string | null }) {
  const router = useRouter();
  const [environment, setEnvironment] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (environment) params.set('environment', environment);
      const res = await fetch(`/api/prompt-authenticity/user-deep-dive/users?${params}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users ?? []);
      } else {
        const errData = await res.json().catch(() => ({}));
        const detail = errData.details ?? errData.error ?? 'unknown error';
        const msg = `Failed to load users (HTTP ${res.status}): ${detail}`;
        console.error('[UserSelector]', msg);
        setLoadError('Failed to load users. Try refreshing the page.');
      }
    } catch (err) {
      console.error('Failed to load users', err);
      setLoadError('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [environment]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filtered = users.filter(u => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return (u.name ?? '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const navigate = (email: string) => {
    const params = new URLSearchParams({ email });
    if (environment) params.set('environment', environment);
    router.push(`/task-creator-deep-dive?${params}`);
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px' }}>
      <h1 className="premium-gradient" style={{ fontSize: '1.8rem', marginBottom: '8px' }}>
        Task Creator Deep-Dive
      </h1>
      <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '32px', fontSize: '14px' }}>
        Select a task creator to review their full submission history — AI generation, templating, non-native patterns, and rapid submissions.
      </p>

      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
      <div style={{
        flex: 2,
        background: 'var(--glass)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '24px',
      }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Environment</label>
            <select
              value={environment}
              onChange={e => setEnvironment(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'rgba(255,255,255,0.9)',
                fontSize: '14px',
              }}
            >
              <option value="">All environments</option>
              {environments.map(env => <option key={env} value={env}>{env}</option>)}
            </select>
            {envError && (
              <div style={{ fontSize: '11px', color: '#f87171', marginTop: '4px' }}>{envError}</div>
            )}
          </div>
          <div style={{ flex: 2, minWidth: '200px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Search</label>
            <input
              type="text"
              placeholder="Filter by name or email..."
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'rgba(255,255,255,0.9)',
                fontSize: '14px',
              }}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>Loading users...</div>
        ) : loadError ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(220,60,60,0.8)', fontSize: '14px' }}>{loadError}</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>No task creators found.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {filtered.map(u => (
              <button
                key={u.email}
                onClick={() => navigate(u.email)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'rgba(255,255,255,0.9)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.2)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
                }}
              >
                <div>
                  <div style={{ fontWeight: 500, fontSize: '14px' }}>{u.name ?? u.email}</div>
                  {u.name && <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{u.email}</div>}
                </div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap', marginLeft: '16px' }}>
                  {u.taskCount} task{u.taskCount !== 1 ? 's' : ''}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: '280px' }}>
        <TaskLookup defaultEnvironment={environment} />
      </div>
      </div>
    </div>
  );
}

// ── Deep Dive view (when email is present) ─────────────────────────────────

export default function TaskCreatorDeepDivePage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const email = searchParams.get('email') ?? '';
  const [environment, setEnvironment] = useState(searchParams.get('environment') ?? '');
  const [environments, setEnvironments] = useState<string[]>([]);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userEnvironments, setUserEnvironments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [envError, setEnvError] = useState<string | null>(null);

  const [flagFilter, setFlagFilter] = useState<FlagFilter>('all');
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<{ analyzed: number; failed: number; message: string; templateAnalysisFailed?: boolean } | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/environments')
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(d => { if (d.environments) setEnvironments(d.environments); })
      .catch(err => {
        console.error('Failed to fetch environments', err);
        setEnvError('Could not load environments');
      });
  }, []);

  const loadDeepDive = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ email });
      if (environment) params.set('environment', environment);
      const response = await fetch(`/api/prompt-authenticity/user-deep-dive?${params}`);
      if (!response.ok) {
        const data = await response.json();
        setError(data.error ?? 'Failed to load data');
        return;
      }
      const data = await response.json();
      setTasks(data.tasks);
      setSummary(data.summary);
      setUserName(data.user.name);
      if (!environment) {
        const envs = [...new Set(
          (data.tasks as Task[]).map(t => t.environment).filter(Boolean) as string[]
        )].sort();
        setUserEnvironments(envs);
      }
    } catch (err: any) {
      console.error('[loadDeepDive]', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [email, environment]);

  useEffect(() => {
    loadDeepDive();
  }, [loadDeepDive]);

  const runAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setAnalyzeResult(null);
    setAnalyzeError(null);
    try {
      const body: Record<string, string> = { email };
      if (environment) body.environment = environment;
      const response = await fetch('/api/prompt-authenticity/user-deep-dive/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setAnalyzeError(data.error ?? 'Analysis failed');
      } else {
        setAnalyzeResult({ analyzed: data.analyzed, failed: data.failed, message: data.message, templateAnalysisFailed: data.templateAnalysisFailed });
        await loadDeepDive();
      }
    } catch (err: any) {
      setAnalyzeError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzing(false);
    }
  }, [email, environment, loadDeepDive]);

  // No email → show user selector
  if (!email) {
    return <UserSelector environments={environments} envError={envError} />;
  }

  const filteredTasks = tasks.filter(t => {
    if (flagFilter === 'ai') return t.isLikelyAIGenerated;
    if (flagFilter === 'templated') return t.isLikelyTemplated;
    if (flagFilter === 'non-native') return t.isLikelyNonNative;
    if (flagFilter === 'rapid') return t.isRapidSubmission;
    return true;
  });

  const displayName = userName || email;

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <Link
          href="/task-creator-deep-dive"
          style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}
        >
          ← Task Creator Deep-Dive
        </Link>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 className="premium-gradient" style={{ fontSize: '1.6rem', margin: 0, marginBottom: '4px' }}>
              {displayName}
            </h1>
            {userName && <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.45)' }}>{email}</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>Environment:</label>
            <select
              value={environment}
              onChange={e => {
                setEnvironment(e.target.value);
                const params = new URLSearchParams({ email });
                if (e.target.value) params.set('environment', e.target.value);
                router.replace(`/task-creator-deep-dive?${params}`);
              }}
              style={{
                padding: '8px 12px',
                backgroundColor: 'var(--bg-secondary, rgba(255,255,255,0.05))',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'rgba(255,255,255,0.9)',
                fontSize: '14px',
              }}
            >
              <option value="">All environments</option>
              {userEnvironments.map(env => <option key={env} value={env}>{env}</option>)}
            </select>
            <button
              onClick={runAnalysis}
              disabled={analyzing}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                border: '1px solid rgba(99,102,241,0.5)',
                background: analyzing ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.2)',
                color: analyzing ? 'rgba(165,180,252,0.5)' : '#a5b4fc',
                fontSize: '13px',
                fontWeight: 600,
                cursor: analyzing ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {analyzing ? 'Analyzing…' : summary && summary.total - summary.analyzed > 0
                ? `Run Analysis (${summary.total - summary.analyzed} unanalyzed)`
                : 'Re-run Analysis'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: '16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#f87171', marginBottom: '24px' }}>
          {error}
        </div>
      )}

      {analyzeError && (
        <div style={{ padding: '16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#f87171', marginBottom: '24px' }}>
          Analysis failed: {analyzeError}
        </div>
      )}

      {analyzing && (
        <div style={{ padding: '16px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '8px', color: '#a5b4fc', marginBottom: '24px', fontSize: '14px' }}>
          Running analysis — this may take a minute for large task sets…
        </div>
      )}

      {analyzeResult && !analyzing && (
        <div style={{
          padding: '16px',
          background: analyzeResult.templateAnalysisFailed ? 'rgba(251,191,36,0.1)' : 'rgba(34,197,94,0.1)',
          border: `1px solid ${analyzeResult.templateAnalysisFailed ? 'rgba(251,191,36,0.3)' : 'rgba(34,197,94,0.3)'}`,
          borderRadius: '8px',
          color: analyzeResult.templateAnalysisFailed ? '#fbbf24' : '#4ade80',
          marginBottom: '24px',
          fontSize: '14px',
        }}>
          {analyzeResult.message}
          {analyzeResult.failed > 0 && <span style={{ color: '#f87171', marginLeft: '8px' }}>({analyzeResult.failed} failed)</span>}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px', color: 'rgba(255,255,255,0.4)' }}>Loading...</div>
      ) : summary && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
            <div style={{
              background: 'var(--glass)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '20px 24px',
              minWidth: '160px',
              flex: 1,
            }}>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>Total Tasks</div>
              <div style={{ fontSize: '28px', fontWeight: 700, lineHeight: 1 }}>{summary.total}</div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>{summary.analyzed} analyzed</div>
            </div>
            <StatCard label="AI-Generated" count={summary.aiGeneratedCount} pct={summary.aiGeneratedPct} color={FLAG_COLORS.ai.text} />
            <StatCard label="Templated" count={summary.templatedCount} pct={summary.templatedPct} color={FLAG_COLORS.templated.text} />
            <StatCard label="Non-Native" count={summary.nonNativeCount} pct={summary.nonNativePct} color={FLAG_COLORS.nonNative.text} />
            <StatCard label="Rapid Submission" count={summary.rapidSubmissionCount} pct={summary.rapidSubmissionPct} color={FLAG_COLORS.rapid.text} />
          </div>

          {/* Filter bar */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginRight: '4px' }}>Show:</span>
            {([
              { key: 'all', label: `All (${tasks.length})` },
              { key: 'ai', label: `AI-Generated (${summary.aiGeneratedCount})` },
              { key: 'templated', label: `Templated (${summary.templatedCount})` },
              { key: 'non-native', label: `Non-Native (${summary.nonNativeCount})` },
              { key: 'rapid', label: `Rapid Submission (${summary.rapidSubmissionCount})` },
            ] as { key: FlagFilter; label: string }[]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFlagFilter(key)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: `1px solid ${flagFilter === key ? 'var(--accent)' : 'var(--border)'}`,
                  background: flagFilter === key ? 'var(--accent)' : 'transparent',
                  color: flagFilter === key ? '#000' : 'rgba(255,255,255,0.7)',
                  fontSize: '13px',
                  fontWeight: flagFilter === key ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Task table */}
          {filteredTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>
              No tasks match this filter.
            </div>
          ) : (
            <div style={{
              background: 'var(--glass)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              overflow: 'hidden',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', width: '140px' }}>Submitted</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', width: '80px' }}>Gap</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>Task</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', width: '260px' }}>Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((task) => {
                    const isExpanded = expandedTask === task.id;
                    const hasFlags = task.isLikelyAIGenerated || task.isLikelyTemplated || task.isLikelyNonNative || task.isRapidSubmission;
                    const date = new Date(task.createdAt);

                    return (
                      <React.Fragment key={task.id}>
                        <tr
                          onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                          style={{
                            borderBottom: isExpanded ? 'none' : '1px solid var(--border)',
                            cursor: 'pointer',
                            background: isExpanded ? 'rgba(255,255,255,0.04)' : hasFlags ? 'rgba(255,255,255,0.01)' : 'transparent',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={e => { if (!isExpanded) (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.04)'; }}
                          onMouseLeave={e => { if (!isExpanded) (e.currentTarget as HTMLTableRowElement).style.background = hasFlags ? 'rgba(255,255,255,0.01)' : 'transparent'; }}
                        >
                          <td style={{ padding: '12px 16px', fontSize: '12px', color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>
                            <div>{date.toLocaleDateString()}</div>
                            <div style={{ color: 'rgba(255,255,255,0.3)' }}>{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '12px', whiteSpace: 'nowrap' }}>
                            {task.gapFromPreviousMin !== null ? (
                              <span style={{
                                color: task.isRapidSubmission ? FLAG_COLORS.rapid.text : 'rgba(255,255,255,0.4)',
                                fontWeight: task.isRapidSubmission ? 700 : 400,
                              }}>
                                {task.gapFromPreviousMin < 1
                                  ? `${Math.round(task.gapFromPreviousMin * 60)}s`
                                  : `${task.gapFromPreviousMin}m`}
                              </span>
                            ) : (
                              <span style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: 'rgba(255,255,255,0.85)' }}>
                            <div style={{ maxHeight: isExpanded ? 'none' : '40px', overflow: 'hidden', lineHeight: '1.5' }}>
                              {task.content}
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {task.isRapidSubmission && <FlagBadge label="⚡ Rapid" color={FLAG_COLORS.rapid} />}
                              {task.isLikelyAIGenerated && <FlagBadge label={`AI ${task.aiGeneratedConfidence}%`} color={FLAG_COLORS.ai} />}
                              {task.isLikelyTemplated && <FlagBadge label={`Template ${task.templateConfidence}%`} color={FLAG_COLORS.templated} />}
                              {task.isLikelyNonNative && <FlagBadge label={`Non-Native ${task.nonNativeConfidence}%`} color={FLAG_COLORS.nonNative} />}
                              {task.analysisStatus === 'PENDING' && (
                                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>not analyzed</span>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${task.id}-expanded`} style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)' }}>
                            <td colSpan={4} style={{ padding: '16px 24px 20px' }}>
                              <div style={{ display: 'grid', gap: '16px' }}>
                                {/* Full content */}
                                <div>
                                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Full Task</div>
                                  <div style={{ fontSize: '13px', lineHeight: '1.6', color: 'rgba(255,255,255,0.85)', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                    {task.content}
                                  </div>
                                </div>

                                {task.analysisStatus === 'COMPLETED' && (
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                                    {task.isLikelyAIGenerated && task.aiGeneratedIndicators && (
                                      <div style={{ padding: '12px', background: FLAG_COLORS.ai.bg, border: `1px solid ${FLAG_COLORS.ai.border}`, borderRadius: '8px' }}>
                                        <div style={{ fontSize: '12px', fontWeight: 700, color: FLAG_COLORS.ai.text, marginBottom: '8px' }}>AI-Generated · {task.aiGeneratedConfidence}%</div>
                                        <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                          {(task.aiGeneratedIndicators as string[]).map((ind, i) => (
                                            <li key={i} style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginBottom: '3px' }}>{ind}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    {task.isLikelyTemplated && (
                                      <div style={{ padding: '12px', background: FLAG_COLORS.templated.bg, border: `1px solid ${FLAG_COLORS.templated.border}`, borderRadius: '8px' }}>
                                        <div style={{ fontSize: '12px', fontWeight: 700, color: FLAG_COLORS.templated.text, marginBottom: '8px' }}>Templated · {task.templateConfidence}%</div>
                                        {task.detectedTemplate && (
                                          <div style={{ fontFamily: 'monospace', fontSize: '12px', color: FLAG_COLORS.templated.text, background: 'rgba(168,85,247,0.1)', padding: '6px 8px', borderRadius: '4px', marginBottom: '8px' }}>
                                            {task.detectedTemplate}
                                          </div>
                                        )}
                                        {task.templateIndicators && (
                                          <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                            {(task.templateIndicators as string[]).map((ind, i) => (
                                              <li key={i} style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginBottom: '3px' }}>{ind}</li>
                                            ))}
                                          </ul>
                                        )}
                                      </div>
                                    )}
                                    {task.isLikelyNonNative && task.nonNativeIndicators && (
                                      <div style={{ padding: '12px', background: FLAG_COLORS.nonNative.bg, border: `1px solid ${FLAG_COLORS.nonNative.border}`, borderRadius: '8px' }}>
                                        <div style={{ fontSize: '12px', fontWeight: 700, color: FLAG_COLORS.nonNative.text, marginBottom: '8px' }}>Non-Native · {task.nonNativeConfidence}%</div>
                                        <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                          {(task.nonNativeIndicators as string[]).map((ind, i) => (
                                            <li key={i} style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginBottom: '3px' }}>{ind}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    {task.isRapidSubmission && (
                                      <div style={{ padding: '12px', background: FLAG_COLORS.rapid.bg, border: `1px solid ${FLAG_COLORS.rapid.border}`, borderRadius: '8px' }}>
                                        <div style={{ fontSize: '12px', fontWeight: 700, color: FLAG_COLORS.rapid.text, marginBottom: '4px' }}>⚡ Rapid Submission</div>
                                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                                          {task.gapFromPreviousMin !== null
                                            ? `${task.gapFromPreviousMin < 1 ? `${Math.round(task.gapFromPreviousMin * 60)}s` : `${task.gapFromPreviousMin}m`} since previous task`
                                            : 'Rapid burst detected'}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {task.overallAssessment && (
                                  <div>
                                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Overall Assessment</div>
                                    <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.5' }}>{task.overallAssessment}</p>
                                  </div>
                                )}

                                {task.environment && (
                                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
                                    Environment: <span style={{ color: 'rgba(255,255,255,0.5)' }}>{task.environment}</span>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
