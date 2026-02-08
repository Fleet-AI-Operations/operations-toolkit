'use client';

import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, XCircle, Loader2, Server, Database } from 'lucide-react';

interface SystemStatus {
    server: 'up' | 'down' | 'checking';
    database: 'connected' | 'disconnected' | 'checking';
    timestamp: string;
}

export default function StatusPage() {
    const [status, setStatus] = useState<SystemStatus>({
        server: 'checking',
        database: 'checking',
        timestamp: new Date().toISOString()
    });

    const checkStatus = useCallback(async () => {
        setStatus(prev => ({
            ...prev,
            server: 'checking',
            database: 'checking'
        }));

        try {
            const response = await fetch('/api/status');

            if (response.ok) {
                const data = await response.json();
                setStatus({
                    server: 'up',
                    database: data.database ? 'connected' : 'disconnected',
                    timestamp: new Date().toISOString()
                });
            } else {
                setStatus({
                    server: 'up', // Server responded, even if with error
                    database: 'disconnected',
                    timestamp: new Date().toISOString()
                });
            }
        } catch (error) {
            setStatus({
                server: 'down',
                database: 'disconnected',
                timestamp: new Date().toISOString()
            });
        }
    }, []);

    useEffect(() => {
        checkStatus();
        // Auto-refresh every 30 seconds
        const interval = setInterval(checkStatus, 30000);
        return () => clearInterval(interval);
    }, [checkStatus]);

    const getStatusIcon = (isUp: boolean, isChecking: boolean) => {
        if (isChecking) {
            return <Loader2 className="animate-spin" size={48} color="var(--accent)" />;
        }
        return isUp ? (
            <CheckCircle2 size={48} color="#00ff88" />
        ) : (
            <XCircle size={48} color="#ff4444" />
        );
    };

    const getStatusColor = (isUp: boolean, isChecking: boolean) => {
        if (isChecking) return 'var(--accent)';
        return isUp ? '#00ff88' : '#ff4444';
    };

    const serverUp = status.server === 'up';
    const serverChecking = status.server === 'checking';
    const dbConnected = status.database === 'connected';
    const dbChecking = status.database === 'checking';

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '40px 20px'
        }}>
            <div style={{ maxWidth: '600px', width: '100%' }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                    <h1 className="premium-gradient" style={{ fontSize: '3rem', marginBottom: '16px' }}>
                        System Status
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1.1rem' }}>
                        Real-time service health monitoring
                    </p>
                </div>

                {/* Status Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '48px' }}>
                    {/* Server Status */}
                    <div
                        className="glass-card"
                        style={{
                            padding: '32px',
                            borderLeft: `4px solid ${getStatusColor(serverUp, serverChecking)}`,
                            transition: 'all 0.3s ease'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                            <div style={{
                                padding: '16px',
                                borderRadius: '12px',
                                background: serverChecking ? 'rgba(0,112,243,0.1)' : serverUp ? 'rgba(0,255,136,0.1)' : 'rgba(255,68,68,0.1)'
                            }}>
                                <Server size={32} color={getStatusColor(serverUp, serverChecking)} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '8px' }}>
                                    Web Server
                                </div>
                                <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>
                                    Application server status
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                {getStatusIcon(serverUp, serverChecking)}
                                <div style={{
                                    marginTop: '8px',
                                    fontSize: '1.2rem',
                                    fontWeight: 700,
                                    color: getStatusColor(serverUp, serverChecking)
                                }}>
                                    {serverChecking ? 'Checking...' : serverUp ? 'Operational' : 'Down'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Database Status */}
                    <div
                        className="glass-card"
                        style={{
                            padding: '32px',
                            borderLeft: `4px solid ${getStatusColor(dbConnected, dbChecking)}`,
                            transition: 'all 0.3s ease'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                            <div style={{
                                padding: '16px',
                                borderRadius: '12px',
                                background: dbChecking ? 'rgba(0,112,243,0.1)' : dbConnected ? 'rgba(0,255,136,0.1)' : 'rgba(255,68,68,0.1)'
                            }}>
                                <Database size={32} color={getStatusColor(dbConnected, dbChecking)} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '8px' }}>
                                    Database
                                </div>
                                <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>
                                    Database connectivity status
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                {getStatusIcon(dbConnected, dbChecking)}
                                <div style={{
                                    marginTop: '8px',
                                    fontSize: '1.2rem',
                                    fontWeight: 700,
                                    color: getStatusColor(dbConnected, dbChecking)
                                }}>
                                    {dbChecking ? 'Checking...' : dbConnected ? 'Connected' : 'Disconnected'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Overall Status */}
                <div className="glass-card" style={{ padding: '24px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.9rem', opacity: 0.6, marginBottom: '8px' }}>
                        Overall System Status
                    </div>
                    <div style={{
                        fontSize: '2rem',
                        fontWeight: 700,
                        color: (serverUp && dbConnected) ? '#00ff88' : (serverUp || dbConnected) ? '#ffab00' : '#ff4444'
                    }}>
                        {(serverChecking || dbChecking) ? 'Checking...' :
                            (serverUp && dbConnected) ? 'All Systems Operational' :
                            (serverUp || dbConnected) ? 'Partial Outage' :
                            'Service Unavailable'}
                    </div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.5, marginTop: '12px' }}>
                        Last updated: {new Date(status.timestamp).toLocaleTimeString()}
                    </div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.4, marginTop: '4px' }}>
                        Auto-refreshes every 30 seconds
                    </div>
                </div>
            </div>
        </div>
    );
}
