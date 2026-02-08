'use client';

import React from 'react';
import { Folder, ChevronDown, Loader2 } from 'lucide-react';
import { useProjectContext } from '@/context/ProjectContext';

export default function ProjectSelector() {
    const { projects, selectedProjectId, setSelectedProjectId, loading, error } = useProjectContext();

    if (loading && projects.length === 0) {
        return (
            <div className="glass-card" style={{ 
                padding: '8px 16px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px',
                height: '40px',
                minWidth: '200px'
            }}>
                <Loader2 size={18} className="spinner" color="var(--accent)" />
                <span style={{ fontSize: '0.9rem', opacity: 0.5 }}>Loading projects...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="glass-card" style={{ 
                padding: '8px 16px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px',
                height: '40px',
                border: '1px solid rgba(255, 68, 68, 0.2)'
            }}>
                <Folder size={18} color="#ff4444" />
                <span style={{ fontSize: '0.9rem', color: '#ff4444' }}>Error loading projects</span>
            </div>
        );
    }

    return (
        <div className="glass-card" style={{ 
            padding: '8px 16px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            height: '40px',
            transition: 'all 0.2s',
            border: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
            <Folder size={18} color="var(--accent)" />
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    style={{ 
                        background: 'none', 
                        color: 'white', 
                        border: 'none', 
                        outline: 'none', 
                        fontSize: '0.9rem', 
                        cursor: 'pointer',
                        appearance: 'none',
                        paddingRight: '24px',
                        fontWeight: 500,
                        width: 'auto',
                        maxWidth: '250px'
                    }}
                >
                    {projects.length === 0 && <option value="">No Projects</option>}
                    {projects.map(p => (
                        <option key={p.id} value={p.id} style={{ background: '#1a1a2e', color: 'white' }}>
                            {p.name}
                        </option>
                    ))}
                </select>
                <ChevronDown 
                    size={14} 
                    style={{ 
                        position: 'absolute', 
                        right: 0, 
                        pointerEvents: 'none',
                        opacity: 0.5
                    }} 
                />
            </div>
        </div>
    );
}
