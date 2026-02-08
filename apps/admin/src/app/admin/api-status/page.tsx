'use client';

import { useState, useEffect } from 'react';
import { Activity, CheckCircle2, XCircle, Loader2, RefreshCw, Clock, Zap, Github } from 'lucide-react';

interface EndpointStatus {
    name: string;
    endpoint: string;
    method: string;
    status: 'checking' | 'success' | 'error' | 'warning';
    statusCode?: number;
    responseTime?: number;
    error?: string;
    lastChecked?: Date;
}

export default function APIStatusPage() {
    const [endpoints, setEndpoints] = useState<EndpointStatus[]>([]);
    const [checking, setChecking] = useState(false);
    const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);

    const endpointList: Omit<EndpointStatus, 'status' | 'statusCode' | 'responseTime' | 'error' | 'lastChecked'>[] = [
        // Core API endpoints
        { name: 'System Info', endpoint: '/api/admin/info', method: 'GET' },
        { name: 'AI Settings', endpoint: '/api/admin/settings', method: 'GET' },
        { name: 'Projects List', endpoint: '/api/projects', method: 'GET' },
        { name: 'Users List', endpoint: '/api/admin/users', method: 'GET' },
        { name: 'AI Balance', endpoint: '/api/ai/balance', method: 'GET' },
        { name: 'AI Status', endpoint: '/api/ai/status', method: 'GET' },

        // Data endpoints
        { name: 'Records', endpoint: '/api/records?take=1', method: 'GET' },
    ];

    useEffect(() => {
        checkEndpoints();
    }, []);

    const checkEndpoints = async () => {
        setChecking(true);
        const results: EndpointStatus[] = [];

        for (const endpoint of endpointList) {
            const startTime = performance.now();
            let result: EndpointStatus = {
                ...endpoint,
                status: 'checking',
                lastChecked: new Date()
            };

            try {
                const response = await fetch(endpoint.endpoint, {
                    method: endpoint.method,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                const endTime = performance.now();
                const responseTime = Math.round(endTime - startTime);

                if (response.ok) {
                    result.status = 'success';
                    result.statusCode = response.status;
                    result.responseTime = responseTime;
                } else if (response.status === 401 || response.status === 403) {
                    result.status = 'warning';
                    result.statusCode = response.status;
                    result.responseTime = responseTime;
                    result.error = 'Authentication required';
                } else {
                    result.status = 'error';
                    result.statusCode = response.status;
                    result.responseTime = responseTime;
                    const data = await response.json().catch(() => ({}));
                    result.error = data.error || response.statusText;
                }
            } catch (error: any) {
                const endTime = performance.now();
                result.status = 'error';
                result.responseTime = Math.round(endTime - startTime);
                result.error = error.message || 'Network error';
            }

            results.push(result);
            setEndpoints([...results]); // Update progressively
        }

        setLastCheckTime(new Date());
        setChecking(false);
    };

    const getStatusIcon = (status: EndpointStatus['status']) => {
        switch (status) {
            case 'success':
                return <CheckCircle2 size={20} color="#00ff88" />;
            case 'error':
                return <XCircle size={20} color="#ff4444" />;
            case 'warning':
                return <Activity size={20} color="#ffab00" />;
            case 'checking':
                return <Loader2 size={20} color="var(--accent)" className="animate-spin" />;
        }
    };

    const getStatusColor = (status: EndpointStatus['status']) => {
        switch (status) {
            case 'success': return '#00ff88';
            case 'error': return '#ff4444';
            case 'warning': return '#ffab00';
            case 'checking': return 'var(--accent)';
        }
    };

    const successCount = endpoints.filter(e => e.status === 'success').length;
    const errorCount = endpoints.filter(e => e.status === 'error').length;
    const warningCount = endpoints.filter(e => e.status === 'warning').length;
    const avgResponseTime = endpoints.length > 0
        ? Math.round(endpoints.reduce((sum, e) => sum + (e.responseTime || 0), 0) / endpoints.length)
        : 0;

    return (
        <div>
            <header style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px' }}>
                    <div>
                        <h1 className="premium-gradient" style={{ fontSize: '2rem', marginBottom: '8px' }}>
                            API Status Monitor
                        </h1>
                        <p style={{ color: 'rgba(255,255,255,0.6)' }}>
                            Real-time health check of REST endpoints
                        </p>
                    </div>
                    <button
                        onClick={checkEndpoints}
                        disabled={checking}
                        className="btn-primary"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 20px'
                        }}
                    >
                        <RefreshCw size={18} className={checking ? 'animate-spin' : ''} />
                        {checking ? 'Checking...' : 'Refresh All'}
                    </button>
                </div>
                <a
                    href="https://github.com/Fleet-AI-Operations/percentage-tool"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: 'rgba(255,255,255,0.6)',
                        fontSize: '0.85rem',
                        textDecoration: 'none',
                        transition: 'color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
                >
                    <Github size={16} />
                    Fleet-AI-Operations/percentage-tool
                </a>
            </header>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
                <div className="glass-card" style={{ padding: '20px' }}>
                    <div style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '8px' }}>Success</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#00ff88' }}>
                        {successCount}
                    </div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '4px' }}>
                        {endpoints.length > 0 ? Math.round((successCount / endpoints.length) * 100) : 0}% healthy
                    </div>
                </div>

                <div className="glass-card" style={{ padding: '20px' }}>
                    <div style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '8px' }}>Warnings</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ffab00' }}>
                        {warningCount}
                    </div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '4px' }}>
                        Auth required
                    </div>
                </div>

                <div className="glass-card" style={{ padding: '20px' }}>
                    <div style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '8px' }}>Errors</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ff4444' }}>
                        {errorCount}
                    </div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '4px' }}>
                        Failed requests
                    </div>
                </div>

                <div className="glass-card" style={{ padding: '20px' }}>
                    <div style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '8px' }}>Avg Response</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent)' }}>
                        {avgResponseTime}ms
                    </div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '4px' }}>
                        {endpoints.length} endpoints
                    </div>
                </div>
            </div>

            {/* Last Checked */}
            {lastCheckTime && (
                <div style={{ marginBottom: '24px', fontSize: '0.85rem', opacity: 0.6, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={14} />
                    Last checked: {lastCheckTime.toLocaleTimeString()}
                </div>
            )}

            {/* Endpoints List */}
            <div className="glass-card" style={{ padding: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <Activity size={24} color="var(--accent)" />
                    <h2 style={{ fontSize: '1.3rem', margin: 0 }}>Endpoint Status</h2>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {endpoints.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
                            <Loader2 className="animate-spin" size={32} style={{ margin: '0 auto 16px' }} />
                            Checking endpoints...
                        </div>
                    ) : (
                        endpoints.map((endpoint, index) => (
                            <div
                                key={index}
                                className="glass-card"
                                style={{
                                    padding: '16px 20px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    borderLeft: `3px solid ${getStatusColor(endpoint.status)}`
                                }}
                            >
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    {getStatusIcon(endpoint.status)}
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '4px' }}>
                                            {endpoint.name}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', opacity: 0.6, fontFamily: 'monospace' }}>
                                            {endpoint.method} {endpoint.endpoint}
                                        </div>
                                        {endpoint.error && (
                                            <div style={{ fontSize: '0.75rem', color: '#ff4444', marginTop: '4px' }}>
                                                {endpoint.error}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                                    {endpoint.statusCode && (
                                        <div style={{
                                            padding: '4px 12px',
                                            borderRadius: '4px',
                                            background: 'rgba(255,255,255,0.05)',
                                            fontSize: '0.8rem',
                                            fontWeight: 600,
                                            fontFamily: 'monospace'
                                        }}>
                                            {endpoint.statusCode}
                                        </div>
                                    )}

                                    {endpoint.responseTime !== undefined && (
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            fontSize: '0.85rem',
                                            opacity: 0.7
                                        }}>
                                            <Zap size={14} />
                                            {endpoint.responseTime}ms
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Performance Insights */}
            {endpoints.length > 0 && (
                <div className="glass-card" style={{ padding: '24px', marginTop: '24px' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Performance Insights</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '0.9rem' }}>
                        <div>
                            <div style={{ opacity: 0.6, marginBottom: '4px' }}>Fastest Endpoint</div>
                            <div style={{ fontWeight: 600 }}>
                                {endpoints.reduce((fastest, e) =>
                                    (e.responseTime || Infinity) < (fastest.responseTime || Infinity) ? e : fastest
                                , endpoints[0])?.name} ({endpoints.reduce((fastest, e) =>
                                    (e.responseTime || Infinity) < (fastest.responseTime || Infinity) ? e : fastest
                                , endpoints[0])?.responseTime}ms)
                            </div>
                        </div>
                        <div>
                            <div style={{ opacity: 0.6, marginBottom: '4px' }}>Slowest Endpoint</div>
                            <div style={{ fontWeight: 600 }}>
                                {endpoints.reduce((slowest, e) =>
                                    (e.responseTime || 0) > (slowest.responseTime || 0) ? e : slowest
                                , endpoints[0])?.name} ({endpoints.reduce((slowest, e) =>
                                    (e.responseTime || 0) > (slowest.responseTime || 0) ? e : slowest
                                , endpoints[0])?.responseTime}ms)
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
