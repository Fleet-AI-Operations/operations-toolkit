'use client';

import { useState, useEffect } from 'react';
import { Wallet } from 'lucide-react';

interface AIStatus {
    provider: string;
    balance?: {
        credits: number;
        usage: number;
        limit?: number;
    } | null;
}

export default function BalanceIndicator() {
    const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);

    useEffect(() => {
        const fetchAiStatus = async () => {
            try {
                const res = await fetch('/api/ai/balance');
                if (!res.ok) return;
                const data = await res.json();
                setAiStatus(data);
            } catch (err) {
                console.error('[BalanceIndicator] Failed to fetch AI status:', err);
            }
        };

        fetchAiStatus();
        const interval = setInterval(fetchAiStatus, 60000);
        return () => clearInterval(interval);
    }, []);

    if (!aiStatus?.balance || typeof aiStatus.balance.credits !== 'number') {
        return null;
    }

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            background: 'rgba(0, 255, 136, 0.05)',
            border: '1px solid rgba(0, 255, 136, 0.1)',
            borderRadius: '8px',
            fontSize: '0.85rem'
        }} title={aiStatus.provider === 'openrouter' ? `OpenRouter Balance: $${aiStatus.balance.credits.toFixed(4)}` : 'AI Credits'}>
            <Wallet size={16} color="#00ff88" />
            <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontWeight: 500 }}>
                Balance: <span style={{ color: '#00ff88', fontWeight: 700 }}>${aiStatus.balance.credits.toFixed(4)}</span>
            </span>
        </div>
    );
}
