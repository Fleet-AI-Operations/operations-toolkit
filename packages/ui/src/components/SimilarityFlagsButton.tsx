'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
    openCount: number;
    flagsUrl: string;
}

export function SimilarityFlagsButton({ openCount, flagsUrl }: Props) {
    const [hovered, setHovered] = useState(false);

    const hasFlags = openCount > 0;
    const tooltipText = hasFlags
        ? `${openCount} open similarity flag${openCount !== 1 ? 's' : ''} — click to view dashboard`
        : 'No open similarity flags';

    return (
        <div style={{ position: 'relative', display: 'inline-flex' }}>
            <a
                href={flagsUrl}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: hovered
                        ? (hasFlags ? 'rgba(249,115,22,0.18)' : 'rgba(255,255,255,0.1)')
                        : (hasFlags ? 'rgba(249,115,22,0.1)' : 'rgba(255,255,255,0.06)'),
                    border: `1px solid ${hovered
                        ? (hasFlags ? 'rgba(249,115,22,0.55)' : 'rgba(255,255,255,0.22)')
                        : (hasFlags ? 'rgba(249,115,22,0.35)' : 'rgba(255,255,255,0.12)')}`,
                    color: hasFlags ? '#f97316' : 'rgba(255,255,255,0.5)',
                    textDecoration: 'none',
                    transition: 'all 0.15s',
                }}
            >
                <AlertTriangle size={18} strokeWidth={2} />
                {hasFlags && (
                    <span style={{
                        background: '#f97316',
                        color: '#fff',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '10px',
                        minWidth: '20px',
                        textAlign: 'center',
                        lineHeight: '1.6',
                    }}>
                        {openCount}
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
