'use client';

import { useState, useEffect } from 'react';
import { Cloud, Server, Settings, Save, Loader2, CheckCircle2, XCircle } from 'lucide-react';

interface SystemInfo {
    database: { host: string; port: string };
    ai: {
        provider: string;
        host: string;
        llmModel: string;
        embeddingModel: string;
    };
}

interface AdminSettings {
    ai_provider: string;
    ai_host: string;
    llm_model: string;
    embedding_model: string;
    openrouter_key: string;
}

export default function AISettingsPage() {
    const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const [settings, setSettings] = useState<AdminSettings>({
        ai_provider: 'lmstudio',
        ai_host: '',
        llm_model: '',
        embedding_model: '',
        openrouter_key: ''
    });
    const [useCustomLlm, setUseCustomLlm] = useState(false);
    const [useCustomEmbedding, setUseCustomEmbedding] = useState(false);

    // Popular model options
    const lmStudioModels = {
        llm: [
            'meta-llama-3.1-8b-instruct',
            'meta-llama-3-8b-instruct',
            'mistral-7b-instruct-v0.3',
            'mixtral-8x7b-instruct',
            'qwen2.5-7b-instruct',
            'gemma-2-9b-it',
            'phi-3-mini-4k-instruct'
        ],
        embedding: [
            'text-embedding-nomic-embed-text-v1.5',
            'bge-large-en-v1.5',
            'gte-large',
            'all-minilm-l6-v2'
        ]
    };

    const openRouterModels = {
        llm: [
            'google/gemini-3-flash-preview',
            'anthropic/claude-sonnet-4.5',
            'deepseek/deepseek-v3.2',
            'anthropic/claude-opus-4.5',
            'x-ai/grok-4.1-fast',
            'openai/gpt-oss-120b',
            'moonshotai/kimi-k2.5'],
        embedding: [
            'openai/text-embedding-3-small',
            'openai/text-embedding-3-large',
            'openai/text-embedding-ada-002'
        ]
    };

    useEffect(() => {
        loadSettings();
        fetchSystemInfo();
    }, []);

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

    const loadSettings = async () => {
        try {
            const res = await fetch('/api/admin/settings');
            const data = await res.json();
            setSettings(data);

            // Check if current models are in the predefined lists
            const models = data.ai_provider === 'openrouter' ? openRouterModels : lmStudioModels;
            setUseCustomLlm(!models.llm.includes(data.llm_model));
            setUseCustomEmbedding(!models.embedding.includes(data.embedding_model));
        } catch (error) {
            console.error('Failed to load settings:', error);
            setStatus({ type: 'error', message: 'Failed to load configuration.' });
        }
    };

    const saveSettings = async () => {
        setSaving(true);
        setStatus(null);
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });

            if (!res.ok) throw new Error('Failed to save');

            setStatus({ type: 'success', message: 'Configuration saved successfully. Changes will take effect for new AI operations.' });
            setTimeout(() => {
                fetchSystemInfo();
            }, 1000);
        } catch (error) {
            setStatus({ type: 'error', message: 'Failed to save configuration.' });
        } finally {
            setSaving(false);
        }
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
            <header style={{ marginBottom: '32px' }}>
                <h1 className="premium-gradient" style={{ fontSize: '2rem', marginBottom: '8px' }}>
                    AI Configuration
                </h1>
                <p style={{ color: 'rgba(255,255,255,0.6)' }}>
                    Configure your AI provider, models, and API settings
                </p>
            </header>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {status && (
                    <div className="glass-card" style={{
                        padding: '16px 24px',
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

                {/* Current Status */}
                {systemInfo && (
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 10px #00ff88' }}></div>
                            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Current Configuration</h2>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            {systemInfo.ai.provider === 'OpenRouter' ? (
                                <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,112,243,0.1)', color: '#0070f3' }}>
                                    <Cloud size={24} />
                                </div>
                            ) : (
                                <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,255,136,0.1)', color: '#00ff88' }}>
                                    <Server size={24} />
                                </div>
                            )}
                            <div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{systemInfo.ai.provider}</div>
                                <div style={{ fontSize: '0.85rem', opacity: 0.6 }}>{systemInfo.ai.host}</div>
                            </div>
                        </div>

                        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.5, marginBottom: '4px' }}>LLM Model</div>
                                <div style={{ fontSize: '0.9rem', fontFamily: 'monospace' }}>{systemInfo.ai.llmModel}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.5, marginBottom: '4px' }}>Embedding Model</div>
                                <div style={{ fontSize: '0.9rem', fontFamily: 'monospace' }}>{systemInfo.ai.embeddingModel}</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Configuration Form */}
                <div className="glass-card" style={{ padding: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                        <Settings size={24} color="var(--accent)" />
                        <h2 style={{ fontSize: '1.3rem', margin: 0 }}>Provider Settings</h2>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* Provider Selection */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>AI Provider</label>
                            <select
                                value={settings.ai_provider}
                                onChange={e => {
                                    const newProvider = e.target.value;
                                    const newModels = newProvider === 'openrouter' ? openRouterModels : lmStudioModels;
                                    setSettings({
                                        ...settings,
                                        ai_provider: newProvider,
                                        llm_model: newModels.llm[0],
                                        embedding_model: newModels.embedding[0]
                                    });
                                    setUseCustomLlm(false);
                                    setUseCustomEmbedding(false);
                                }}
                                className="input-field"
                            >
                                <option value="lmstudio">LM Studio (Local)</option>
                                <option value="openrouter">OpenRouter (Cloud)</option>
                            </select>
                            <div style={{ fontSize: '0.8rem', opacity: 0.5, marginTop: '6px' }}>
                                {settings.ai_provider === 'lmstudio'
                                    ? 'Use local AI models via LM Studio for maximum privacy'
                                    : 'Use cloud-based AI models via OpenRouter API'}
                            </div>
                        </div>

                        {/* LM Studio Host */}
                        {settings.ai_provider === 'lmstudio' && (
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Host URL</label>
                                <input
                                    type="text"
                                    value={settings.ai_host}
                                    onChange={e => setSettings({ ...settings, ai_host: e.target.value })}
                                    placeholder="http://localhost:1234/v1"
                                    className="input-field"
                                />
                                <div style={{ fontSize: '0.8rem', opacity: 0.5, marginTop: '6px' }}>
                                    URL where LM Studio is running (default: http://localhost:1234/v1)
                                </div>
                            </div>
                        )}

                        {/* OpenRouter API Key */}
                        {settings.ai_provider === 'openrouter' && (
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>API Key</label>
                                <input
                                    type="password"
                                    value={settings.openrouter_key}
                                    onChange={e => setSettings({ ...settings, openrouter_key: e.target.value })}
                                    placeholder="sk-or-v1-..."
                                    className="input-field"
                                />
                                <div style={{ fontSize: '0.8rem', opacity: 0.5, marginTop: '6px' }}>
                                    Get your API key from <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>openrouter.ai/keys</a>
                                </div>
                            </div>
                        )}

                        <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>

                        {/* LLM Model */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <label style={{ fontWeight: 500 }}>LLM Model</label>
                                <button
                                    type="button"
                                    onClick={() => setUseCustomLlm(!useCustomLlm)}
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
                                    {useCustomLlm ? 'Use Preset' : 'Custom Model'}
                                </button>
                            </div>
                            {useCustomLlm ? (
                                <input
                                    type="text"
                                    value={settings.llm_model}
                                    onChange={e => setSettings({ ...settings, llm_model: e.target.value })}
                                    placeholder="Enter custom model name"
                                    className="input-field"
                                />
                            ) : (
                                <select
                                    value={settings.llm_model}
                                    onChange={e => setSettings({ ...settings, llm_model: e.target.value })}
                                    className="input-field"
                                >
                                    {(settings.ai_provider === 'openrouter' ? openRouterModels.llm : lmStudioModels.llm).map(model => (
                                        <option key={model} value={model}>{model}</option>
                                    ))}
                                </select>
                            )}
                            <div style={{ fontSize: '0.8rem', opacity: 0.5, marginTop: '6px' }}>
                                Used for alignment analysis and text generation
                            </div>
                        </div>

                        {/* Embedding Model */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <label style={{ fontWeight: 500 }}>Embedding Model</label>
                                <button
                                    type="button"
                                    onClick={() => setUseCustomEmbedding(!useCustomEmbedding)}
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
                                    {useCustomEmbedding ? 'Use Preset' : 'Custom Model'}
                                </button>
                            </div>
                            {useCustomEmbedding ? (
                                <input
                                    type="text"
                                    value={settings.embedding_model}
                                    onChange={e => setSettings({ ...settings, embedding_model: e.target.value })}
                                    placeholder="Enter custom model name"
                                    className="input-field"
                                />
                            ) : (
                                <select
                                    value={settings.embedding_model}
                                    onChange={e => setSettings({ ...settings, embedding_model: e.target.value })}
                                    className="input-field"
                                >
                                    {(settings.ai_provider === 'openrouter' ? openRouterModels.embedding : lmStudioModels.embedding).map(model => (
                                        <option key={model} value={model}>{model}</option>
                                    ))}
                                </select>
                            )}
                            <div style={{ fontSize: '0.8rem', opacity: 0.5, marginTop: '6px' }}>
                                Used for semantic search and similarity analysis
                            </div>
                        </div>

                        {/* Save Button */}
                        <div style={{ marginTop: '8px' }}>
                            <button
                                onClick={saveSettings}
                                disabled={saving}
                                className="btn-primary"
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '14px'
                                }}
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save size={20} />
                                        Save Configuration
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
