'use client';

import { useState } from 'react';
import { Flag } from 'lucide-react';

interface Props {
    count: number;
    workforceUrl: string;
}

export function ReviewRequestedButton({ count, workforceUrl }: Props) {
    const [hovered, setHovered] = useState(false);

    const hasItems = count > 0;
    const tooltipText = hasItems
        ? `${count} review request${count !== 1 ? 's' : ''} pending — click to view`
        : 'No pending review requests';

    return (
        <div style={{ position: 'relative', display: 'inline-flex' }}>
            <a
                href={`${workforceUrl}?flagged=flagged`}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: hovered
                        ? (hasItems ? 'rgba(251,113,33,0.18)' : 'rgba(255,255,255,0.1)')
                        : (hasItems ? 'rgba(251,113,33,0.1)' : 'rgba(255,255,255,0.06)'),
                    border: `1px solid ${hovered
                        ? (hasItems ? 'rgba(251,113,33,0.55)' : 'rgba(255,255,255,0.22)')
                        : (hasItems ? 'rgba(251,113,33,0.35)' : 'rgba(255,255,255,0.12)')}`,
                    color: hasItems ? 'rgba(251,191,36,0.9)' : 'rgba(255,255,255,0.5)',
                    textDecoration: 'none',
                    transition: 'all 0.15s',
                }}
            >
                <Flag size={18} strokeWidth={2} />
                {hasItems && (
                    <span style={{
                        background: 'rgba(251,113,33,0.85)',
                        color: '#fff',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '10px',
                        minWidth: '20px',
                        textAlign: 'center',
                        lineHeight: '1.6',
                    }}>
                        {count > 99 ? '99+' : count}
                    </span>
                )}
            </a>

            {hovered && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    background: 'rgba(20,20,25,0.97)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '0.8rem',
                    color: 'rgba(255,255,255,0.85)',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    zIndex: 200,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                }}>
                    <div style={{
                        position: 'absolute',
                        top: '-5px',
                        right: '18px',
                        width: '8px',
                        height: '8px',
                        background: 'rgba(20,20,25,0.97)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderBottom: 'none',
                        borderRight: 'none',
                        transform: 'rotate(45deg)',
                    }} />
                    {tooltipText}
                </div>
            )}
        </div>
    );
}
