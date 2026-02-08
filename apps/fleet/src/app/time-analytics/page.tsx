'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Construction, Loader2, ShieldAlert } from 'lucide-react';

export default function TimeAnalyticsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);

    useEffect(() => {
        checkAuthorization();
    }, []);

    const checkAuthorization = async () => {
        try {
            // Use the bonus-windows API as a proxy to check authorization
            const res = await fetch('/api/admin/bonus-windows');

            if (res.status === 403) {
                setAuthorized(false);
                setLoading(false);
                return;
            }

            if (res.status === 401) {
                router.push('/auth/login');
                return;
            }

            setAuthorized(true);
        } catch (err) {
            console.error('Failed to check authorization', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <Loader2 className="animate-spin" size={48} color="var(--accent)" />
            </div>
        );
    }

    if (!authorized) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '60vh',
                textAlign: 'center',
                padding: '40px'
            }}>
                <div style={{ padding: '16px', background: 'rgba(255, 77, 77, 0.1)', borderRadius: '16px', marginBottom: '24px' }}>
                    <ShieldAlert size={64} color="#ff4d4d" />
                </div>
                <h1 style={{ fontSize: '2rem', marginBottom: '16px' }}>Access Denied</h1>
                <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '24px' }}>
                    This page is only accessible to Managers and Administrators.
                </p>
                <button
                    onClick={() => router.push('/')}
                    className="btn-primary"
                    style={{ padding: '12px 32px' }}
                >
                    Return to Dashboard
                </button>
            </div>
        );
    }

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 'calc(100vh - 73px)',
            textAlign: 'center',
            padding: '40px'
        }}>
            <div style={{
                padding: '24px',
                background: 'rgba(255, 171, 0, 0.1)',
                borderRadius: '16px',
                marginBottom: '24px'
            }}>
                <Construction size={64} color="#ffab00" />
            </div>

            <h1 className="premium-gradient" style={{ fontSize: '2rem', marginBottom: '12px' }}>
                Time Analytics
            </h1>

            <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '8px', maxWidth: '500px' }}>
                This feature is currently under construction.
            </p>

            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', maxWidth: '500px' }}>
                Advanced time tracking analytics will be available once additional integrations are completed.
            </p>
        </div>
    );
}
