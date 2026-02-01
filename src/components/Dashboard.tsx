'use client';

import { useState, useEffect } from 'react';
import { Folder, Settings, Database, BarChart3, ShieldAlert, FileCheck, Sparkles, Wallet } from 'lucide-react';
import Link from 'next/link';

interface Project {
    id: string;
    name: string;
}

interface Record {
    id: string;
    source: string;
    content: string;
    type: 'TASK' | 'FEEDBACK';
    category: 'TOP_10' | 'BOTTOM_10';
    metadata: any;
    alignmentAnalysis?: string | null;
    createdAt: string;
}

interface AIStatus {
    provider: string;
    balance?: {
        credits: number;
        usage: number;
        limit?: number;
    } | null;
}

const extractAlignmentScore = (analysis: string | null | undefined): string | null => {
    if (!analysis) return null;
    // Look for patterns like "Alignment Score (0-100): 85" or "Score (0-100)\n85"
    const regex = /(?:Alignment Score \(0-100\)|Score)[:\s\n]*(\d+)/i;
    const match = analysis.match(regex);
    return match ? match[1] : null;
};

export default function Dashboard() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [records, setRecords] = useState<Record[]>([]);
    const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);

    // UI State
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchProjects();
        fetchAiStatus();
    }, []);

    const fetchAiStatus = async () => {
        try {
            const res = await fetch('/api/ai/balance');
            const data = await res.json();
            setAiStatus(data);
        } catch (err) {
            console.error('Failed to fetch AI status', err);
        }
    };

    useEffect(() => {
        if (selectedProject) {
            fetchRecords(selectedProject.id);
        } else {
            setRecords([]);
        }
    }, [selectedProject]);

    const fetchProjects = async () => {
        try {
            const res = await fetch('/api/projects');
            const data = await res.json();
            if (Array.isArray(data)) {
                setProjects(data);
                if (data.length > 0 && !selectedProject) {
                    setSelectedProject(data[0]);
                }
            } else {
                console.error('Failed to fetch projects:', data.error || 'Unknown error');
                setProjects([]);
            }
        } catch (err) {
            console.error('Failed to fetch projects', err);
            setProjects([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchRecords = async (projectId: string) => {
        setLoading(true);
        try {
            // Fetch Top 10% and Bottom 10% specifically to avoid loading "Standard" records
            const [topRes, bottomRes] = await Promise.all([
                fetch(`/api/records?projectId=${projectId}&take=500&category=TOP_10`),
                fetch(`/api/records?projectId=${projectId}&take=500&category=BOTTOM_10`)
            ]);

            const topData = await topRes.json();
            const bottomData = await bottomRes.json();

            setRecords([...(topData.records || []), ...(bottomData.records || [])]);
        } catch (err) {
            console.error(err);
            setRecords([]);
        } finally {
            setLoading(false);
        }
    };


    const filteredRecords = (type: string, category: string) =>
        records.filter(r => r.type === type && r.category === category);

    return (
        <div className="container" style={{ maxWidth: '1400px' }}>
            <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="premium-gradient" style={{ fontSize: '2.5rem', marginBottom: '8px' }}>Task Data</h1>
                    <p style={{ color: 'rgba(255,255,255,0.6)' }}>Analyze Top and Bottom Percentages</p>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <Link href="/analytics" className="glass-card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
                        <BarChart3 size={18} /> Analytics
                    </Link>

                    <Link href={`/similarity?projectId=${selectedProject?.id}`} className="glass-card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
                        <Sparkles size={18} /> Similarity
                    </Link>

                    <Link href="/ingest" className="glass-card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
                        <Database size={18} /> Ingest
                    </Link>
                    
                    <Link href={`/topbottom10?projectId=${selectedProject?.id}`} className="glass-card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
                        <FileCheck size={18} /> Top/Bottom 10
                    </Link>

                    <Link href={`/top-prompts?projectId=${selectedProject?.id}`} className="glass-card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
                        <ShieldAlert size={18} /> Top Prompts
                    </Link>

                    <Link href="/manage" className="glass-card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
                        <Settings size={18} /> Manage
                    </Link>


                    {aiStatus?.provider === 'openrouter' && aiStatus.balance && typeof aiStatus.balance.credits === 'number' && (
                        <div className="glass-card" style={{
                            padding: '8px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '0.85rem',
                            background: 'rgba(0, 255, 136, 0.05)',
                            border: '1px solid rgba(0, 255, 136, 0.1)'
                        }}>
                            <Wallet size={16} color="#00ff88" />
                            <span style={{ color: 'rgba(255,255,255,0.7)' }}>
                                Balance: <span style={{ color: '#00ff88', fontWeight: 600 }}>
                                    ${aiStatus.balance.credits.toFixed(4)}
                                </span>
                            </span>
                        </div>
                    )}

                    <div className="glass-card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Folder size={18} color="#0070f3" />
                        <select
                            value={selectedProject?.id || ''}
                            onChange={(e) => {
                                const p = projects.find(p => p.id === e.target.value);
                                setSelectedProject(p || null);
                            }}
                            style={{ background: 'none', color: 'white', border: 'none', outline: 'none', fontSize: '0.9rem', cursor: 'pointer' }}
                        >
                            {projects.length === 0 && <option value="">No Projects</option>}
                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                </div>
            </header>

            <main style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

                {!selectedProject ? (
                    <div className="glass-card" style={{ textAlign: 'center', padding: '100px', opacity: 0.5 }}>
                        <h2>No project selected</h2>
                        <p>Create a project in <b>Manage</b> to start.</p>
                        <Link href="/manage" className="btn-primary" style={{ display: 'inline-flex', marginTop: '20px', padding: '10px 24px' }}>Go to Management</Link>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                        {/* Tasks Section */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '4px', height: '24px', background: 'var(--accent)' }}></div>
                                <h2 style={{ fontSize: '1.5rem' }}>Tasks</h2>
                            </div>
                            <DataSection
                                title="Top 10% Tasks"
                                records={filteredRecords('TASK', 'TOP_10')}
                                type="TASK"
                                category="TOP_10"
                                projectId={selectedProject.id}
                            />
                            <DataSection
                                title="Bottom 10% Tasks"
                                records={filteredRecords('TASK', 'BOTTOM_10')}
                                type="TASK"
                                category="BOTTOM_10"
                                projectId={selectedProject.id}
                            />
                        </div>

                        {/* Feedback Section */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '4px', height: '24px', background: '#00ff88' }}></div>
                                <h2 style={{ fontSize: '1.5rem' }}>Feedback</h2>
                            </div>
                            <DataSection
                                title="Top 10% Feedback"
                                records={filteredRecords('FEEDBACK', 'TOP_10')}
                                type="FEEDBACK"
                                category="TOP_10"
                                projectId={selectedProject.id}
                            />
                            <DataSection
                                title="Bottom 10% Feedback"
                                records={filteredRecords('FEEDBACK', 'BOTTOM_10')}
                                type="FEEDBACK"
                                category="BOTTOM_10"
                                projectId={selectedProject.id}
                            />
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

function DataSection({ title, records, type, category, projectId }: {
    title: string,
    records: Record[],
    type: string,
    category: string,
    projectId: string
}) {
    // Only show top 5 on dashboard
    const displayRecords = records.slice(0, 5);

    return (
        <section className="glass-card" style={{ minHeight: '300px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '1.1rem', opacity: 0.8 }}>{title}</h3>
                {records.length > 5 && (
                    <Link
                        href={`/records?projectId=${projectId}&type=${type}&category=${category}`}
                        style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 600 }}
                    >View All →</Link>
                )}
            </div>
            {displayRecords.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', opacity: 0.3, fontSize: '1rem' }}>No data</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {displayRecords.map(record => (
                        <div key={record.id} style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
                            <ExpandableText content={record.content} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {type === 'TASK' && (
                                        <div style={{
                                            fontSize: '0.7rem',
                                            background: record.metadata?.avg_score !== undefined ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                                            color: record.metadata?.avg_score !== undefined ? '#00ff88' : 'rgba(255, 255, 255, 0.4)',
                                            fontWeight: 700,
                                            padding: '4px 10px',
                                            borderRadius: '20px',
                                            border: `1px solid ${record.metadata?.avg_score !== undefined ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 255, 255, 0.1)'}`,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}>
                                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: record.metadata?.avg_score !== undefined ? '#00ff88' : 'rgba(255, 255, 255, 0.3)' }}></div>
                                            Quality: {record.metadata?.avg_score !== undefined
                                                ? `${(parseFloat(record.metadata.avg_score) * 1).toFixed(0)}%`
                                                : 'N/A'}
                                        </div>
                                    )}

                                    {record.alignmentAnalysis ? (
                                        <Link
                                            href={`/compare?id=${record.id}`}
                                            style={{
                                                fontSize: '0.7rem',
                                                background: 'rgba(0, 112, 243, 0.1)',
                                                color: 'var(--accent)',
                                                fontWeight: 700,
                                                padding: '4px 10px',
                                                borderRadius: '20px',
                                                border: '1px solid rgba(0, 112, 243, 0.2)',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                textDecoration: 'none',
                                                transition: 'all 0.2s'
                                            }}
                                            className="hover-bright"
                                        >
                                            <Sparkles size={10} />
                                            Alignment: {extractAlignmentScore(record.alignmentAnalysis)}%
                                        </Link>
                                    ) : (
                                        <Link
                                            href={`/compare?id=${record.id}`}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                fontSize: '0.75rem',
                                                color: 'var(--accent)',
                                                fontWeight: 600,
                                                padding: '4px 8px',
                                                borderRadius: '6px',
                                                background: 'rgba(0, 112, 243, 0.05)',
                                                transition: 'all 0.2s',
                                                textDecoration: 'none'
                                            }}
                                            className="hover-bright"
                                        >
                                            <FileCheck size={14} /> Generate Alignment Score
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

function ExpandableText({ content }: { content: string }) {
    const [expanded, setExpanded] = useState(false);

    // Only make it interactive if it looks long enough to probably be truncated
    // This is a rough heuristic since line-clamp depends on width, but avoids
    // clicks on very short items.
    const isLikelyLong = content.length > 150;

    return (
        <div
            onClick={() => isLikelyLong && setExpanded(!expanded)}
            style={{
                fontSize: '0.9rem',
                color: 'rgba(255,255,255,0.9)',
                marginBottom: '12px',
                overflow: 'hidden',
                display: expanded ? 'block' : '-webkit-box',
                WebkitLineClamp: expanded ? 'unset' : 3,
                WebkitBoxOrient: 'vertical',
                lineHeight: '1.5',
                cursor: isLikelyLong ? 'pointer' : 'default',
                transition: 'all 0.2s'
            }}
            title={isLikelyLong && !expanded ? "Click to expand" : ""}
        >
            {content}
            {isLikelyLong && !expanded && (
                <span style={{ fontSize: '0.7rem', color: 'var(--accent)', marginLeft: '4px', opacity: 0.8 }}>(more)</span>
            )}
        </div>
    );
}
