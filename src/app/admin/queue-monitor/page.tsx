'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  TrendingUp,
  Activity,
  X,
} from 'lucide-react';

interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

interface Job {
  id: string;
  job_type: string;
  status: string;
  priority: number;
  attempts: number;
  max_attempts: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  result?: any;
  progress?: {
    current: number;
    total: number;
    message?: string;
  };
}

interface PerformanceMetrics {
  [jobType: string]: {
    count: number;
    avgDuration: number;
  };
}

export default function QueueMonitorPage() {
  const router = useRouter();
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [failedJobs, setFailedJobs] = useState<Job[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000); // Auto-refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    if (!loading) setRefreshing(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/queue/stats');

      if (res.status === 403) {
        router.push('/');
        return;
      }

      if (!res.ok) {
        throw new Error(`Failed to fetch: ${res.status}`);
      }

      const data = await res.json();
      setStats(data.stats);
      setRecentJobs(data.recentJobs);
      setFailedJobs(data.failedJobs);
      setPerformanceMetrics(data.performanceMetrics);
    } catch (err) {
      console.error('Failed to fetch queue stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to load queue statistics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const retryJob = async (jobId: string) => {
    setRetryingJobId(jobId);
    try {
      const res = await fetch('/api/admin/queue/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to retry job');
      }

      // Refresh stats after retry
      await fetchStats();
    } catch (err) {
      console.error('Failed to retry job:', err);
      alert(err instanceof Error ? err.message : 'Failed to retry job');
    } finally {
      setRetryingJobId(null);
    }
  };

  const cancelJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to cancel this job?')) {
      return;
    }

    setCancellingJobId(jobId);

    try {
      const res = await fetch('/api/admin/queue/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to cancel job');
      }

      // Refresh stats after cancel
      await fetchStats();
    } catch (err) {
      console.error('Failed to cancel job:', err);
      alert(err instanceof Error ? err.message : 'Failed to cancel job');
    } finally {
      setCancellingJobId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return '#10b981';
      case 'PROCESSING':
        return '#3b82f6';
      case 'PENDING':
        return '#f59e0b';
      case 'FAILED':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle size={20} color="#10b981" />;
      case 'PROCESSING':
        return <Loader2 size={20} color="#3b82f6" className="animate-spin" />;
      case 'PENDING':
        return <Clock size={20} color="#f59e0b" />;
      case 'FAILED':
        return <XCircle size={20} color="#ef4444" />;
      default:
        return <Activity size={20} color="#6b7280" />;
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  const renderProgress = (job: Job) => {
    if (!job.progress || job.status === 'COMPLETED' || job.status === 'FAILED') {
      return null;
    }

    const { current, total, message } = job.progress;
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

    return (
      <div style={{ marginTop: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>
          <span>{message || 'Processing...'}</span>
          <span>{percentage}%</span>
        </div>
        <div style={{
          width: '100%',
          height: '6px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '3px',
          overflow: 'hidden'
        }}>
          <div
            style={{
              width: `${percentage}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #0070f3, #00d4ff)',
              transition: 'width 0.3s ease',
              borderRadius: '3px'
            }}
          />
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Loader2 className="animate-spin" size={48} color="var(--accent)" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '48px' }}>
        <AlertTriangle size={48} color="#ff4d4d" style={{ marginBottom: '16px' }} />
        <p style={{ color: '#ff4d4d', marginBottom: '16px' }}>{error}</p>
        <button onClick={() => fetchStats()} className="btn-primary">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '40px', minHeight: 'calc(100vh - 73px)' }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 className="premium-gradient" style={{ fontSize: '2.5rem', marginBottom: '8px' }}>
              Queue Monitor
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.6)' }}>
              Real-time monitoring of the ingestion job queue
            </p>
          </div>
          <button
            onClick={() => fetchStats()}
            disabled={refreshing}
            style={{
              padding: '12px 24px',
              background: 'rgba(0, 112, 243, 0.1)',
              border: '1px solid rgba(0, 112, 243, 0.3)',
              borderRadius: '8px',
              color: 'var(--accent)',
              cursor: refreshing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '32px' }}>
            <div className="glass-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <Clock size={24} color="#f59e0b" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Pending</h3>
              </div>
              <p style={{ fontSize: '2.5rem', fontWeight: 700, color: '#f59e0b' }}>{stats.pending}</p>
            </div>

            <div className="glass-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <Loader2 size={24} color="#3b82f6" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Processing</h3>
              </div>
              <p style={{ fontSize: '2.5rem', fontWeight: 700, color: '#3b82f6' }}>{stats.processing}</p>
            </div>

            <div className="glass-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <CheckCircle size={24} color="#10b981" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Completed</h3>
              </div>
              <p style={{ fontSize: '2.5rem', fontWeight: 700, color: '#10b981' }}>{stats.completed}</p>
            </div>

            <div className="glass-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <XCircle size={24} color="#ef4444" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Failed</h3>
              </div>
              <p style={{ fontSize: '2.5rem', fontWeight: 700, color: '#ef4444' }}>{stats.failed}</p>
            </div>
          </div>
        )}

        {/* Performance Metrics */}
        {Object.keys(performanceMetrics).length > 0 && (
          <div className="glass-card" style={{ padding: '32px', marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <TrendingUp size={24} color="var(--accent)" />
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Performance (Last 24h)</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              {Object.entries(performanceMetrics).map(([jobType, metrics]) => (
                <div key={jobType} style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px', color: 'var(--accent)' }}>
                    {jobType}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
                    <span>Jobs: {metrics.count}</span>
                    <span>Avg: {formatDuration(metrics.avgDuration)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Failed Jobs */}
        {failedJobs.length > 0 && (
          <div className="glass-card" style={{ padding: '32px', marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <AlertTriangle size={24} color="#ef4444" />
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Failed Jobs</h2>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' }}>
                      Type
                    </th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' }}>
                      Attempts
                    </th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' }}>
                      Failed At
                    </th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' }}>
                      Error
                    </th>
                    <th style={{ padding: '12px', textAlign: 'right', fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {failedJobs.map((job) => (
                    <tr key={job.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px' }}>
                        <span style={{ padding: '4px 8px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px', fontSize: '0.85rem' }}>
                          {job.job_type}
                        </span>
                      </td>
                      <td style={{ padding: '12px', fontSize: '0.9rem' }}>
                        {job.attempts}/{job.max_attempts}
                      </td>
                      <td style={{ padding: '12px', fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
                        {job.completed_at ? formatDate(job.completed_at) : '-'}
                      </td>
                      <td style={{ padding: '12px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', maxWidth: '300px' }}>
                        {job.result?.error || 'Unknown error'}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <button
                          onClick={() => retryJob(job.id)}
                          disabled={retryingJobId === job.id}
                          className="btn-primary"
                          style={{ padding: '6px 16px', fontSize: '0.85rem' }}
                        >
                          {retryingJobId === job.id ? 'Retrying...' : 'Retry'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent Jobs */}
        <div className="glass-card" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <Activity size={24} color="var(--accent)" />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Recent Jobs (Last 20)</h2>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' }}>
                    Status
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' }}>
                    Type
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' }}>
                    Priority
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' }}>
                    Created
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' }}>
                    Duration
                  </th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.map((job) => (
                  <tr key={job.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {getStatusIcon(job.status)}
                        <span style={{ fontSize: '0.85rem', color: getStatusColor(job.status) }}>
                          {job.status}
                        </span>
                      </div>
                      {renderProgress(job)}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ padding: '4px 8px', background: 'rgba(0, 112, 243, 0.1)', borderRadius: '4px', fontSize: '0.85rem' }}>
                        {job.job_type}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontSize: '0.9rem' }}>{job.priority}</td>
                    <td style={{ padding: '12px', fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
                      {formatDate(job.created_at)}
                    </td>
                    <td style={{ padding: '12px', fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
                      {job.started_at && job.completed_at
                        ? formatDuration((new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000)
                        : '-'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      {(job.status === 'PENDING' || job.status === 'PROCESSING') && (
                        <button
                          onClick={() => cancelJob(job.id)}
                          disabled={cancellingJobId === job.id}
                          style={{
                            padding: '6px 12px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '6px',
                            color: '#ef4444',
                            cursor: cancellingJobId === job.id ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.85rem',
                          }}
                        >
                          <X size={14} />
                          {cancellingJobId === job.id ? 'Cancelling...' : 'Cancel'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
