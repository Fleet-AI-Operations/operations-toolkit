'use client';

import { Construction } from 'lucide-react';

export default function LinksPage() {
    return (
        <div style={{
            width: '100%',
            maxWidth: '600px',
            margin: '80px auto 0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '24px'
        }}>
            <div style={{
                padding: '20px',
                borderRadius: '16px',
                background: 'rgba(255, 180, 0, 0.1)',
                border: '1px solid rgba(255, 180, 0, 0.2)',
            }}>
                <Construction size={48} color="rgba(255, 180, 0, 0.8)" />
            </div>

            <div>
                <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '12px' }}>
                    Under Construction
                </h1>
                <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '1rem', lineHeight: '1.6' }}>
                    This page is currently being updated. Links and resources will be available here soon.
                </p>
            </div>
        </div>
    );
}
