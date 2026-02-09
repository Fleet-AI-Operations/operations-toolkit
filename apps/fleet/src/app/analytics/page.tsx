'use client';

import { useState, useEffect } from 'react';
import {
    BarChart3,
    Download,
    Loader2,
    Users,
    Bot,
    FileText,
    TrendingUp,
    Trash2
} from 'lucide-react';

interface Project {
    id: string;
    name: string;
}

interface Summary {
    totalRecords: number;
    ratedRecords: number;
    humanRaters: number;
    llmModels: number;
    totalHumanRatings: number;
    totalLLMRatings: number;
}

interface Stats {
    mean: number;
    median: number;
    stdDev: number;
    count: number;
}

interface Distribution {
    human: { realism: number[]; quality: number[] };
    llm: { realism: number[]; quality: number[] };
}

interface ModelStats {
    name: string;
    totalRatings: number;
    avgRealism: number;
    avgQuality: number;
    correlationWithHuman: { realism: number; quality: number } | null;
}

export default function AnalyticsPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [loadingData, setLoadingData] = useState(false);
    const [clearing, setClearing] = useState(false);

    // Data
    const [summary, setSummary] = useState<Summary | null>(null);
    const [humanStats, setHumanStats] = useState<{ realism: Stats; quality: Stats } | null>(null);
    const [llmStats, setLlmStats] = useState<{ realism: Stats; quality: Stats } | null>(null);
    const [distribution, setDistribution] = useState<Distribution | null>(null);
    const [modelComparison, setModelComparison] = useState<ModelStats[]>([]);

    useEffect(() => {
        fetchProjects();
    }, []);

    useEffect(() => {
        if (selectedProjectId) {
            fetchAnalytics();
        }
    }, [selectedProjectId]);

    const fetchProjects = async () => {
        try {
            const res = await fetch('/api/projects');
            if (res.ok) {
                const data = await res.json();
                // Handle both wrapped { projects: [] } and direct array formats
                const projectList = Array.isArray(data) ? data : (data.projects || []);
                setProjects(projectList);
                if (projectList.length > 0) {
                    setSelectedProjectId(projectList[0].id);
                }
            }
        } catch (error) {
            console.error('Error fetching projects:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAnalytics = async () => {
        setLoadingData(true);
        try {
            const [summaryRes, comparisonRes] = await Promise.all([
                fetch(`/api/analytics/likert-summary?projectId=${selectedProjectId}`),
                fetch(`/api/analytics/model-comparison?projectId=${selectedProjectId}`)
            ]);

            if (summaryRes.ok) {
                const data = await summaryRes.json();
                setSummary(data.summary);
                setHumanStats(data.humanStats);
                setLlmStats(data.llmStats);
                setDistribution(data.distribution);
            }

            if (comparisonRes.ok) {
                const data = await comparisonRes.json();
                setModelComparison(data.models || []);
            }
        } catch (error) {
            console.error('Error fetching analytics:', error);
        } finally {
            setLoadingData(false);
        }
    };

    const handleExport = (format: 'csv' | 'json') => {
        window.open(`/api/analytics/export?projectId=${selectedProjectId}&format=${format}`, '_blank');
    };

    const handleClearLikertData = async () => {
        if (!selectedProjectId) return;
        const projectName = projects.find(p => p.id === selectedProjectId)?.name || 'this project';
        if (!confirm(`Are you sure you want to clear all Likert ratings for "${projectName}"? This cannot be undone.`)) return;

        setClearing(true);
        try {
            const res = await fetch('/api/admin/clear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target: 'LIKERT_SCORES', projectId: selectedProjectId })
            });
            const data = await res.json();
            if (res.ok) {
                alert(data.message);
                fetchAnalytics(); // Refresh the data
            } else {
                alert(data.error || 'Failed to clear data');
            }
        } catch (error) {
            alert('Network error occurred');
        } finally {
            setClearing(false);
        }
    };

    const handleClearAllRecords = async () => {
        if (!selectedProjectId) return;
        const projectName = projects.find(p => p.id === selectedProjectId)?.name || 'this project';
        if (!confirm(`⚠️ WARNING: This will permanently delete ALL ${summary?.totalRecords || 0} records and ratings for "${projectName}".\n\nThis action cannot be undone. Are you sure?`)) return;

        setClearing(true);
        try {
            const res = await fetch('/api/admin/clear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target: 'PROJECT_RECORDS', projectId: selectedProjectId })
            });
            const data = await res.json();
            if (res.ok) {
                alert(data.message);
                fetchAnalytics(); // Refresh the data
            } else {
                alert(data.error || 'Failed to clear data');
            }
        } catch (error) {
            alert('Network error occurred');
        } finally {
            setClearing(false);
        }
    };

    const DistributionChart = ({ data, label, color }: { data: number[]; label: string; color: string }) => {
        const max = Math.max(...data, 1);
        return (
            <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '8px' }}>{label}</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '60px' }}>
                    {data.map((count, i) => (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div
                                style={{
                                    width: '100%',
                                    height: `${(count / max) * 50}px`,
                                    background: color,
                                    borderRadius: '2px 2px 0 0',
                                    minHeight: count > 0 ? '4px' : '0'
                                }}
                            />
                            <div style={{ fontSize: '0.7rem', marginTop: '4px' }}>{i + 1}</div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
                <Loader2 className="animate-spin" size={48} color="var(--accent)" />
            </div>
        );
    }

    return (
        <div>
            <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 className="premium-gradient" style={{ fontSize: '2rem', marginBottom: '8px' }}>
                        Analytics Dashboard
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.6)' }}>
                        Likert score analysis and model comparison
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => handleExport('csv')}
                        disabled={!selectedProjectId}
                        className="btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <Download size={18} />
                        Export CSV
                    </button>
                    <button
                        onClick={() => handleExport('json')}
                        disabled={!selectedProjectId}
                        className="btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <Download size={18} />
                        Export JSON
                    </button>
                    <button
                        onClick={handleClearLikertData}
                        disabled={!selectedProjectId || clearing}
                        title="Clear Likert ratings only"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 16px',
                            borderRadius: '8px',
                            border: '1px solid rgba(255,170,0,0.3)',
                            background: 'rgba(255,170,0,0.1)',
                            color: '#ffaa00',
                            cursor: !selectedProjectId || clearing ? 'not-allowed' : 'pointer',
                            opacity: !selectedProjectId || clearing ? 0.5 : 1
                        }}
                    >
                        <Trash2 size={18} />
                        Clear Ratings
                    </button>
                    <button
                        onClick={handleClearAllRecords}
                        disabled={!selectedProjectId || clearing}
                        title="Clear all records and ratings"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 16px',
                            borderRadius: '8px',
                            border: '1px solid rgba(255,77,77,0.3)',
                            background: 'rgba(255,77,77,0.1)',
                            color: '#ff4d4d',
                            cursor: !selectedProjectId || clearing ? 'not-allowed' : 'pointer',
                            opacity: !selectedProjectId || clearing ? 0.5 : 1
                        }}
                    >
                        <Trash2 size={18} />
                        {clearing ? 'Clearing...' : 'Clear All Records'}
                    </button>
                </div>
            </header>

            {/* Project Selection */}
            <div className="glass-card" style={{ padding: '20px', marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Select Project</label>
                <select
                    value={selectedProjectId}
                    onChange={e => setSelectedProjectId(e.target.value)}
                    className="input-field"
                    style={{ maxWidth: '400px' }}
                >
                    <option value="">-- Select a project --</option>
                    {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
            </div>

            {!selectedProjectId ? (
                <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
                    <BarChart3 size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                    <p style={{ opacity: 0.6 }}>Select a project to view analytics</p>
                </div>
            ) : loadingData ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
                    <Loader2 className="animate-spin" size={32} color="var(--accent)" />
                </div>
            ) : (
                <>
                    {/* Summary Stats */}
                    {summary && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                            <div className="glass-card" style={{ padding: '20px', textAlign: 'center' }}>
                                <FileText size={24} style={{ opacity: 0.5, marginBottom: '8px' }} />
                                <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{summary.ratedRecords}</div>
                                <div style={{ fontSize: '0.85rem', opacity: 0.6 }}>of {summary.totalRecords} Records Rated</div>
                            </div>
                            <div className="glass-card" style={{ padding: '20px', textAlign: 'center' }}>
                                <Users size={24} style={{ opacity: 0.5, marginBottom: '8px' }} />
                                <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{summary.humanRaters}</div>
                                <div style={{ fontSize: '0.85rem', opacity: 0.6 }}>Human Raters</div>
                            </div>
                            <div className="glass-card" style={{ padding: '20px', textAlign: 'center' }}>
                                <Bot size={24} style={{ opacity: 0.5, marginBottom: '8px' }} />
                                <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{summary.llmModels}</div>
                                <div style={{ fontSize: '0.85rem', opacity: 0.6 }}>LLM Models</div>
                            </div>
                            <div className="glass-card" style={{ padding: '20px', textAlign: 'center' }}>
                                <TrendingUp size={24} style={{ opacity: 0.5, marginBottom: '8px' }} />
                                <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>
                                    {summary.totalHumanRatings + summary.totalLLMRatings}
                                </div>
                                <div style={{ fontSize: '0.85rem', opacity: 0.6 }}>Total Ratings</div>
                            </div>
                        </div>
                    )}

                    {/* Score Statistics */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                        {/* Human Stats */}
                        <div className="glass-card" style={{ padding: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                                <Users size={20} color="var(--accent)" />
                                <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Human Ratings</h2>
                            </div>
                            {humanStats && humanStats.realism.count > 0 ? (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <div style={{ fontSize: '0.8rem', opacity: 0.5, marginBottom: '4px' }}>Realism</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{humanStats.realism.mean}</div>
                                        <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>
                                            σ={humanStats.realism.stdDev} • n={humanStats.realism.count}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.8rem', opacity: 0.5, marginBottom: '4px' }}>Quality</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{humanStats.quality.mean}</div>
                                        <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>
                                            σ={humanStats.quality.stdDev} • n={humanStats.quality.count}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ opacity: 0.5, textAlign: 'center', padding: '20px' }}>No human ratings yet</div>
                            )}
                        </div>

                        {/* LLM Stats */}
                        <div className="glass-card" style={{ padding: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                                <Bot size={20} color="#00ff88" />
                                <h2 style={{ fontSize: '1.1rem', margin: 0 }}>LLM Ratings</h2>
                            </div>
                            {llmStats && llmStats.realism.count > 0 ? (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <div style={{ fontSize: '0.8rem', opacity: 0.5, marginBottom: '4px' }}>Realism</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{llmStats.realism.mean}</div>
                                        <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>
                                            σ={llmStats.realism.stdDev} • n={llmStats.realism.count}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.8rem', opacity: 0.5, marginBottom: '4px' }}>Quality</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{llmStats.quality.mean}</div>
                                        <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>
                                            σ={llmStats.quality.stdDev} • n={llmStats.quality.count}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ opacity: 0.5, textAlign: 'center', padding: '20px' }}>No LLM ratings yet</div>
                            )}
                        </div>
                    </div>

                    {/* Score Distribution */}
                    {distribution && (
                        <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '1.1rem', marginBottom: '20px' }}>Score Distribution (1-7)</h2>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                                <div>
                                    <DistributionChart data={distribution.human.realism} label="Human - Realism" color="var(--accent)" />
                                    <DistributionChart data={distribution.human.quality} label="Human - Quality" color="#0070f3" />
                                </div>
                                <div>
                                    <DistributionChart data={distribution.llm.realism} label="LLM - Realism" color="#00ff88" />
                                    <DistributionChart data={distribution.llm.quality} label="LLM - Quality" color="#22c55e" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Model Comparison */}
                    {modelComparison.length > 0 && (
                        <div className="glass-card" style={{ padding: '24px' }}>
                            <h2 style={{ fontSize: '1.1rem', marginBottom: '20px' }}>Model Comparison</h2>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                            <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: '0.85rem', opacity: 0.6 }}>Model</th>
                                            <th style={{ textAlign: 'right', padding: '12px 8px', fontSize: '0.85rem', opacity: 0.6 }}>Ratings</th>
                                            <th style={{ textAlign: 'right', padding: '12px 8px', fontSize: '0.85rem', opacity: 0.6 }}>Avg Realism</th>
                                            <th style={{ textAlign: 'right', padding: '12px 8px', fontSize: '0.85rem', opacity: 0.6 }}>Avg Quality</th>
                                            <th style={{ textAlign: 'right', padding: '12px 8px', fontSize: '0.85rem', opacity: 0.6 }}>Correlation (R)</th>
                                            <th style={{ textAlign: 'right', padding: '12px 8px', fontSize: '0.85rem', opacity: 0.6 }}>Correlation (Q)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {modelComparison.map(model => (
                                            <tr key={model.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                <td style={{ padding: '12px 8px', fontWeight: 500 }}>{model.name}</td>
                                                <td style={{ padding: '12px 8px', textAlign: 'right' }}>{model.totalRatings}</td>
                                                <td style={{ padding: '12px 8px', textAlign: 'right' }}>{model.avgRealism}</td>
                                                <td style={{ padding: '12px 8px', textAlign: 'right' }}>{model.avgQuality}</td>
                                                <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                                                    {model.correlationWithHuman?.realism !== null && model.correlationWithHuman?.realism !== undefined
                                                        ? model.correlationWithHuman.realism.toFixed(2)
                                                        : <span style={{ opacity: 0.4, fontSize: '0.8em' }}>N/A</span>
                                                    }
                                                </td>
                                                <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                                                    {model.correlationWithHuman?.quality !== null && model.correlationWithHuman?.quality !== undefined
                                                        ? model.correlationWithHuman.quality.toFixed(2)
                                                        : <span style={{ opacity: 0.4, fontSize: '0.8em' }}>N/A</span>
                                                    }
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div style={{ marginTop: '12px', fontSize: '0.8rem', opacity: 0.5 }}>
                                Correlation values show Pearson correlation between LLM and human average scores per record
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
