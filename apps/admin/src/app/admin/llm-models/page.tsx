'use client';

import { useState, useEffect } from 'react';
import {
    Bot,
    Plus,
    Trash2,
    Edit2,
    Play,
    Loader2,
    CheckCircle2,
    XCircle,
    DollarSign,
    Zap,
    BarChart3,
    X,
    PlayCircle,
    StopCircle,
    RefreshCw,
    Star,
    ExternalLink
} from 'lucide-react';
import Link from 'next/link';
import { OPENROUTER_MODEL_OPTIONS } from '@/lib/constants';

interface LLMModelConfig {
    id: string;
    name: string;
    modelId: string;
    isActive: boolean;
    priority: number;
    inputCostPer1k: number | null;
    outputCostPer1k: number | null;
    totalTokensUsed: number;
    totalCost: number;
    totalRatings: number;
    createdAt: string;
    updatedAt: string;
    _count?: {
        evaluationJobs: number;
    };
}

interface TestResult {
    success: boolean;
    response?: string;
    latency?: number;
    error?: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

interface Project {
    id: string;
    name: string;
}

interface EvaluationJob {
    id: string;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
    totalRecords: number;
    processedCount: number;
    errorCount: number;
    tokensUsed: number;
    cost: number;
    createdAt: string;
    completedAt: string | null;
    modelConfig: {
        name: string;
        modelId: string;
    };
}

// Model preset interface for the quick select
interface ModelPreset {
    id: string;
    name: string;
    inputCost: number | null;
    outputCost: number | null;
    fromDatabase: boolean;
}

export default function LLMModelsPage() {
    const [models, setModels] = useState<LLMModelConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingModel, setEditingModel] = useState<LLMModelConfig | null>(null);
    const [testingId, setTestingId] = useState<string | null>(null);
    const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    // Bulk evaluation state
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [evaluationJobs, setEvaluationJobs] = useState<EvaluationJob[]>([]);
    const [startingEvaluation, setStartingEvaluation] = useState(false);
    const [loadingJobs, setLoadingJobs] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        modelId: '',
        isActive: true,
        priority: 0,
        inputCostPer1k: '',
        outputCostPer1k: '',
        systemPrompt: '',
        usePreset: true
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchModels();
        fetchProjects();
    }, []);

    useEffect(() => {
        if (selectedProjectId) {
            fetchEvaluationJobs();
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
            }
        } catch (error) {
            console.error('Error fetching projects:', error);
        }
    };

    const fetchEvaluationJobs = async () => {
        if (!selectedProjectId) return;
        setLoadingJobs(true);
        try {
            const res = await fetch(`/api/evaluation/bulk-llm?projectId=${selectedProjectId}`);
            if (res.ok) {
                const data = await res.json();
                setEvaluationJobs(data.jobs || []);
            }
        } catch (error) {
            console.error('Error fetching evaluation jobs:', error);
        } finally {
            setLoadingJobs(false);
        }
    };

    const handleStartBulkEvaluation = async (modelId?: string) => {
        if (!selectedProjectId) {
            setStatus({ type: 'error', message: 'Please select a project first' });
            return;
        }
        setStartingEvaluation(true);
        try {
            const res = await fetch('/api/evaluation/bulk-llm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: selectedProjectId,
                    ...(modelId ? { modelConfigId: modelId } : { allModels: true })
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to start evaluation');
            setStatus({ type: 'success', message: modelId ? 'Evaluation started' : `Started ${data.jobIds?.length || 1} evaluation job(s)` });
            fetchEvaluationJobs();
        } catch (error: any) {
            setStatus({ type: 'error', message: error.message });
        } finally {
            setStartingEvaluation(false);
        }
    };

    const handleCancelJob = async (jobId: string) => {
        try {
            const res = await fetch(`/api/evaluation/bulk-llm/${jobId}/cancel`, { method: 'POST' });
            if (!res.ok) throw new Error('Failed to cancel');
            setStatus({ type: 'success', message: 'Job cancelled' });
            fetchEvaluationJobs();
        } catch (error: any) {
            setStatus({ type: 'error', message: error.message });
        }
    };

    const fetchModels = async () => {
        try {
            const res = await fetch('/api/admin/llm-models');
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();
            setModels(data.models);
        } catch (error) {
            console.error('Error fetching models:', error);
            setStatus({ type: 'error', message: 'Failed to load models' });
        } finally {
            setLoading(false);
        }
    };

    // Generate dynamic presets from saved models + OPENROUTER_MODEL_OPTIONS
    const getModelPresets = (): ModelPreset[] => {
        const presets: ModelPreset[] = [];
        const seenIds = new Set<string>();

        // First, add all existing models from database (they have accurate pricing)
        for (const model of models) {
            presets.push({
                id: model.modelId,
                name: model.name,
                inputCost: model.inputCostPer1k,
                outputCost: model.outputCostPer1k,
                fromDatabase: true
            });
            seenIds.add(model.modelId);
        }

        // Then add OPENROUTER_MODEL_OPTIONS that aren't already in database
        for (const modelId of OPENROUTER_MODEL_OPTIONS) {
            if (!seenIds.has(modelId)) {
                // Extract a display name from the model ID
                const nameParts = modelId.split('/');
                const displayName = nameParts[nameParts.length - 1]
                    .split('-')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');
                presets.push({
                    id: modelId,
                    name: displayName,
                    inputCost: null,
                    outputCost: null,
                    fromDatabase: false
                });
                seenIds.add(modelId);
            }
        }

        return presets;
    };

    const handlePresetSelect = (preset: ModelPreset) => {
        setFormData({
            ...formData,
            name: preset.name,
            modelId: preset.id,
            inputCostPer1k: preset.inputCost?.toString() || '',
            outputCostPer1k: preset.outputCost?.toString() || ''
        });
    };

    const handleSaveModel = async () => {
        setSaving(true);
        setStatus(null);

        try {
            const payload = {
                name: formData.name.trim(),
                modelId: formData.modelId.trim(),
                isActive: formData.isActive,
                priority: formData.priority,
                inputCostPer1k: formData.inputCostPer1k ? parseFloat(formData.inputCostPer1k) : null,
                outputCostPer1k: formData.outputCostPer1k ? parseFloat(formData.outputCostPer1k) : null,
                systemPrompt: formData.systemPrompt.trim() || null
            };

            const url = editingModel
                ? `/api/admin/llm-models/${editingModel.id}`
                : '/api/admin/llm-models';
            const method = editingModel ? 'PATCH' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to save');
            }

            setStatus({ type: 'success', message: editingModel ? 'Model updated' : 'Model added' });
            setShowAddModal(false);
            setEditingModel(null);
            resetForm();
            fetchModels();
        } catch (error: any) {
            setStatus({ type: 'error', message: error.message });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteModel = async (model: LLMModelConfig) => {
        if (!confirm(`Delete "${model.name}"? This cannot be undone.`)) return;

        try {
            const res = await fetch(`/api/admin/llm-models/${model.id}`, { method: 'DELETE' });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to delete');
            }
            setStatus({ type: 'success', message: 'Model deleted' });
            fetchModels();
        } catch (error: any) {
            setStatus({ type: 'error', message: error.message });
        }
    };

    const handleTestModel = async (model: LLMModelConfig) => {
        setTestingId(model.id);
        setTestResults(prev => ({ ...prev, [model.id]: { success: false } }));

        try {
            const res = await fetch(`/api/admin/llm-models/${model.id}/test`, { method: 'POST' });
            const result = await res.json();
            setTestResults(prev => ({ ...prev, [model.id]: result }));
        } catch (error: any) {
            setTestResults(prev => ({
                ...prev,
                [model.id]: { success: false, error: error.message }
            }));
        } finally {
            setTestingId(null);
        }
    };

    const handleToggleActive = async (model: LLMModelConfig) => {
        try {
            const res = await fetch(`/api/admin/llm-models/${model.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !model.isActive })
            });
            if (!res.ok) throw new Error('Failed to update');
            fetchModels();
        } catch (error) {
            setStatus({ type: 'error', message: 'Failed to update model status' });
        }
    };

    const openEditModal = (model: LLMModelConfig & { systemPrompt?: string | null }) => {
        setEditingModel(model);
        setFormData({
            name: model.name,
            modelId: model.modelId,
            isActive: model.isActive,
            priority: model.priority,
            inputCostPer1k: model.inputCostPer1k?.toString() || '',
            outputCostPer1k: model.outputCostPer1k?.toString() || '',
            systemPrompt: model.systemPrompt || '',
            usePreset: false
        });
        setShowAddModal(true);
    };

    const resetForm = () => {
        setFormData({
            name: '',
            modelId: '',
            isActive: true,
            priority: 0,
            inputCostPer1k: '',
            outputCostPer1k: '',
            systemPrompt: '',
            usePreset: true
        });
    };

    const formatCost = (cost: number) => {
        return cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(2)}`;
    };

    const formatTokens = (tokens: number) => {
        if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
        if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
        return tokens.toString();
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
                        LLM Model Configuration
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.6)' }}>
                        Configure OpenRouter models for bulk Likert evaluations
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <Link
                        href="/likert-scoring"
                        className="btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <Star size={20} />
                        Likert Scoring
                        <ExternalLink size={14} />
                    </Link>
                    <button
                        onClick={() => { resetForm(); setEditingModel(null); setShowAddModal(true); }}
                        className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <Plus size={20} />
                        Add Model
                    </button>
                </div>
            </header>

            {status && (
                <div className="glass-card" style={{
                    padding: '16px 24px',
                    marginBottom: '24px',
                    border: `1px solid ${status.type === 'success' ? 'var(--success)' : '#ff4d4d'}`,
                    background: `${status.type === 'success' ? 'rgba(0,255,136,0.05)' : 'rgba(255,77,77,0.05)'}`,
                    color: status.type === 'success' ? '#00ff88' : '#ff4d4d',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    {status.type === 'success' ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                    {status.message}
                </div>
            )}

            {/* Models Grid */}
            {models.length === 0 ? (
                <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
                    <Bot size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                    <p style={{ opacity: 0.6, marginBottom: '16px' }}>No models configured yet</p>
                    <button
                        onClick={() => { resetForm(); setShowAddModal(true); }}
                        className="btn-primary"
                    >
                        Add Your First Model
                    </button>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '16px' }}>
                    {models.map(model => (
                        <div key={model.id} className="glass-card" style={{ padding: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div
                                        style={{
                                            width: '48px',
                                            height: '48px',
                                            borderRadius: '12px',
                                            background: model.isActive ? 'rgba(0,255,136,0.1)' : 'rgba(255,255,255,0.05)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        <Bot size={24} color={model.isActive ? '#00ff88' : 'rgba(255,255,255,0.3)'} />
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <h3 style={{ fontSize: '1.2rem', margin: 0 }}>{model.name}</h3>
                                            {!model.isActive && (
                                                <span style={{
                                                    padding: '2px 8px',
                                                    borderRadius: '4px',
                                                    background: 'rgba(255,255,255,0.1)',
                                                    fontSize: '0.7rem',
                                                    textTransform: 'uppercase'
                                                }}>
                                                    Disabled
                                                </span>
                                            )}
                                        </div>
                                        <code style={{ fontSize: '0.85rem', opacity: 0.6 }}>{model.modelId}</code>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        onClick={() => handleTestModel(model)}
                                        disabled={testingId === model.id}
                                        className="btn-secondary"
                                        style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                                        title="Test connection"
                                    >
                                        {testingId === model.id ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : (
                                            <Play size={16} />
                                        )}
                                        Test
                                    </button>
                                    <button
                                        onClick={() => openEditModal(model)}
                                        className="btn-secondary"
                                        style={{ padding: '8px 12px' }}
                                        title="Edit"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteModel(model)}
                                        className="btn-secondary"
                                        style={{ padding: '8px 12px', color: '#ff4d4d' }}
                                        title="Delete"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Stats Row */}
                            <div style={{
                                marginTop: '20px',
                                paddingTop: '16px',
                                borderTop: '1px solid rgba(255,255,255,0.05)',
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4, 1fr)',
                                gap: '16px'
                            }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', opacity: 0.5, marginBottom: '4px' }}>
                                        <BarChart3 size={12} />
                                        Ratings
                                    </div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                                        {model.totalRatings.toLocaleString()}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', opacity: 0.5, marginBottom: '4px' }}>
                                        <Zap size={12} />
                                        Tokens
                                    </div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                                        {formatTokens(model.totalTokensUsed)}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', opacity: 0.5, marginBottom: '4px' }}>
                                        <DollarSign size={12} />
                                        Total Cost
                                    </div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                                        {formatCost(model.totalCost)}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.5, marginBottom: '4px' }}>
                                        Cost/1K tokens
                                    </div>
                                    <div style={{ fontSize: '0.9rem' }}>
                                        {model.inputCostPer1k != null ? `$${model.inputCostPer1k}` : '—'} in / {model.outputCostPer1k != null ? `$${model.outputCostPer1k}` : '—'} out
                                    </div>
                                </div>
                            </div>

                            {/* Test Result */}
                            {testResults[model.id] && (
                                <div style={{
                                    marginTop: '16px',
                                    padding: '12px 16px',
                                    borderRadius: '8px',
                                    background: testResults[model.id].success ? 'rgba(0,255,136,0.05)' : 'rgba(255,77,77,0.05)',
                                    border: `1px solid ${testResults[model.id].success ? 'rgba(0,255,136,0.2)' : 'rgba(255,77,77,0.2)}'}`
                                }}>
                                    {testResults[model.id].success ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <CheckCircle2 size={16} color="#00ff88" />
                                            <span style={{ color: '#00ff88' }}>
                                                Connected • {testResults[model.id].latency}ms latency • {testResults[model.id].usage?.totalTokens} tokens
                                            </span>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <XCircle size={16} color="#ff4d4d" />
                                            <span style={{ color: '#ff4d4d' }}>
                                                {testResults[model.id].error || 'Connection failed'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Enable/Disable Toggle */}
                            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => handleToggleActive(model)}
                                    style={{
                                        background: 'none',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        color: model.isActive ? '#ff4d4d' : '#00ff88',
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        fontSize: '0.8rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {model.isActive ? 'Disable' : 'Enable'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Bulk Evaluation Section */}
            {models.length > 0 && (
                <div className="glass-card" style={{ padding: '24px', marginTop: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <PlayCircle size={24} color="var(--accent)" />
                        <h2 style={{ fontSize: '1.3rem', margin: 0 }}>Bulk Evaluation</h2>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Select Project</label>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <select
                                value={selectedProjectId}
                                onChange={e => setSelectedProjectId(e.target.value)}
                                className="input-field"
                                style={{ flex: 1 }}
                            >
                                <option value="">-- Select a project --</option>
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                            <button
                                onClick={() => handleStartBulkEvaluation()}
                                disabled={!selectedProjectId || startingEvaluation || models.filter(m => m.isActive).length === 0}
                                className="btn-primary"
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}
                            >
                                {startingEvaluation ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : (
                                    <PlayCircle size={18} />
                                )}
                                Run All Active Models
                            </button>
                        </div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.5, marginTop: '8px' }}>
                            {models.filter(m => m.isActive).length} active model(s) will evaluate all unrated records
                        </div>
                    </div>

                    {/* Evaluation Jobs */}
                    {selectedProjectId && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <h3 style={{ fontSize: '1rem', margin: 0, opacity: 0.8 }}>Recent Jobs</h3>
                                <button
                                    onClick={fetchEvaluationJobs}
                                    disabled={loadingJobs}
                                    style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <RefreshCw size={14} className={loadingJobs ? 'animate-spin' : ''} />
                                    Refresh
                                </button>
                            </div>

                            {evaluationJobs.length === 0 ? (
                                <div style={{ padding: '24px', textAlign: 'center', opacity: 0.5, border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px' }}>
                                    No evaluation jobs yet
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {evaluationJobs.map(job => (
                                        <div key={job.id} style={{
                                            padding: '12px 16px',
                                            borderRadius: '8px',
                                            background: 'rgba(255,255,255,0.02)',
                                            border: '1px solid rgba(255,255,255,0.05)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{
                                                    width: '8px',
                                                    height: '8px',
                                                    borderRadius: '50%',
                                                    background: job.status === 'COMPLETED' ? '#00ff88' :
                                                               job.status === 'PROCESSING' ? '#0070f3' :
                                                               job.status === 'FAILED' ? '#ff4d4d' :
                                                               job.status === 'CANCELLED' ? '#888' : '#ffaa00'
                                                }} />
                                                <div>
                                                    <div style={{ fontWeight: 500 }}>{job.modelConfig.name}</div>
                                                    <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                                                        {job.processedCount}/{job.totalRecords} records • {job.errorCount} errors • ${job.cost.toFixed(4)}
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <span style={{
                                                    padding: '4px 8px',
                                                    borderRadius: '4px',
                                                    fontSize: '0.75rem',
                                                    textTransform: 'uppercase',
                                                    background: job.status === 'COMPLETED' ? 'rgba(0,255,136,0.1)' :
                                                               job.status === 'PROCESSING' ? 'rgba(0,112,243,0.1)' :
                                                               job.status === 'FAILED' ? 'rgba(255,77,77,0.1)' : 'rgba(255,255,255,0.05)',
                                                    color: job.status === 'COMPLETED' ? '#00ff88' :
                                                           job.status === 'PROCESSING' ? '#0070f3' :
                                                           job.status === 'FAILED' ? '#ff4d4d' : 'inherit'
                                                }}>
                                                    {job.status}
                                                </span>
                                                {['PENDING', 'PROCESSING'].includes(job.status) && (
                                                    <button
                                                        onClick={() => handleCancelJob(job.id)}
                                                        style={{
                                                            background: 'none',
                                                            border: '1px solid rgba(255,77,77,0.3)',
                                                            color: '#ff4d4d',
                                                            padding: '4px 8px',
                                                            borderRadius: '4px',
                                                            fontSize: '0.75rem',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px'
                                                        }}
                                                    >
                                                        <StopCircle size={12} />
                                                        Cancel
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Add/Edit Modal */}
            {showAddModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.8)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div className="glass-card" style={{ width: '100%', maxWidth: '600px', padding: '32px', maxHeight: '90vh', overflow: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '1.4rem', margin: 0 }}>
                                {editingModel ? 'Edit Model' : 'Add Model'}
                            </h2>
                            <button
                                onClick={() => { setShowAddModal(false); setEditingModel(null); }}
                                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Preset Selection (only for new models) */}
                        {!editingModel && (
                            <div style={{ marginBottom: '24px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <label style={{ fontWeight: 500 }}>Quick Select</label>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, usePreset: !formData.usePreset })}
                                        style={{
                                            background: 'none',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            color: 'var(--accent)',
                                            padding: '4px 12px',
                                            borderRadius: '4px',
                                            fontSize: '0.8rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {formData.usePreset ? 'Custom Model' : 'Use Presets'}
                                    </button>
                                </div>

                                {formData.usePreset && (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                                        {getModelPresets().map(preset => (
                                            <button
                                                key={preset.id}
                                                type="button"
                                                onClick={() => handlePresetSelect(preset)}
                                                style={{
                                                    padding: '12px',
                                                    borderRadius: '8px',
                                                    border: formData.modelId === preset.id
                                                        ? '1px solid var(--accent)'
                                                        : preset.fromDatabase
                                                            ? '1px solid rgba(0,255,136,0.2)'
                                                            : '1px solid rgba(255,255,255,0.1)',
                                                    background: formData.modelId === preset.id
                                                        ? 'rgba(0,112,243,0.1)'
                                                        : preset.fromDatabase
                                                            ? 'rgba(0,255,136,0.03)'
                                                            : 'rgba(255,255,255,0.02)',
                                                    textAlign: 'left',
                                                    cursor: 'pointer',
                                                    color: 'inherit'
                                                }}
                                            >
                                                <div style={{ fontWeight: 500, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    {preset.name}
                                                    {preset.fromDatabase && (
                                                        <span style={{ fontSize: '0.65rem', background: 'rgba(0,255,136,0.15)', padding: '2px 6px', borderRadius: '4px', color: '#00ff88' }}>
                                                            Saved
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>
                                                    {preset.inputCost != null && preset.outputCost != null
                                                        ? `$${preset.inputCost} / $${preset.outputCost} per 1K`
                                                        : preset.id}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Form Fields */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Display Name</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g., GPT-4o"
                                    className="input-field"
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Model ID (OpenRouter)</label>
                                <input
                                    type="text"
                                    value={formData.modelId}
                                    onChange={e => setFormData({ ...formData, modelId: e.target.value })}
                                    placeholder="e.g., openai/gpt-4o"
                                    className="input-field"
                                />
                                <div style={{ fontSize: '0.8rem', opacity: 0.5, marginTop: '6px' }}>
                                    Find model IDs at <a href="https://openrouter.ai/models" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>openrouter.ai/models</a>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Input Cost ($/1K tokens)</label>
                                    <input
                                        type="number"
                                        step="0.001"
                                        value={formData.inputCostPer1k}
                                        onChange={e => setFormData({ ...formData, inputCostPer1k: e.target.value })}
                                        placeholder="e.g., 2.5"
                                        className="input-field"
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Output Cost ($/1K tokens)</label>
                                    <input
                                        type="number"
                                        step="0.001"
                                        value={formData.outputCostPer1k}
                                        onChange={e => setFormData({ ...formData, outputCostPer1k: e.target.value })}
                                        placeholder="e.g., 10"
                                        className="input-field"
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Priority</label>
                                <input
                                    type="number"
                                    value={formData.priority}
                                    onChange={e => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                                    className="input-field"
                                />
                                <div style={{ fontSize: '0.8rem', opacity: 0.5, marginTop: '6px' }}>
                                    Lower numbers run first in bulk evaluations
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                                    System Prompt (Rubric)
                                </label>
                                <textarea
                                    value={formData.systemPrompt}
                                    onChange={e => setFormData({ ...formData, systemPrompt: e.target.value })}
                                    placeholder="Enter custom evaluation rubric. Must output JSON..."
                                    className="input-field"
                                    rows={5}
                                    style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                                />
                                <div style={{ fontSize: '0.8rem', opacity: 0.5, marginTop: '4px' }}>
                                    Leave empty to use default system prompt.
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    checked={formData.isActive}
                                    onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                                    style={{ width: '18px', height: '18px' }}
                                />
                                <label htmlFor="isActive" style={{ cursor: 'pointer' }}>
                                    Enable for evaluations
                                </label>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                                <button
                                    onClick={() => { setShowAddModal(false); setEditingModel(null); }}
                                    className="btn-secondary"
                                    style={{ flex: 1, padding: '14px' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveModel}
                                    disabled={saving || !formData.name.trim() || !formData.modelId.trim()}
                                    className="btn-primary"
                                    style={{ flex: 1, padding: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                                >
                                    {saving ? (
                                        <>
                                            <Loader2 className="animate-spin" size={20} />
                                            Saving...
                                        </>
                                    ) : (
                                        editingModel ? 'Update Model' : 'Add Model'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
