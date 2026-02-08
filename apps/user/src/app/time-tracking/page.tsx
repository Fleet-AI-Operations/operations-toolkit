'use client';

import { Construction, Clock } from 'lucide-react';

export default function TimeTrackingPage() {
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
                Time Tracking
            </h1>

            <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '8px', maxWidth: '500px' }}>
                This feature is currently under construction.
            </p>

            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', maxWidth: '500px' }}>
                Time tracking and analytics features will be available soon.
            </p>
        </div>
    );
}
