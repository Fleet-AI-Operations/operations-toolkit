'use client';

import { Construction } from 'lucide-react';

export default function TimeAnalyticsPage() {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '60vh',
            textAlign: 'center'
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
