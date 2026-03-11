'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Users, Loader2, ShieldAlert, RefreshCw, TrendingUp, Award, Settings } from 'lucide-react';

interface PodMember {
    id: string;
    email: string;
    name: string | null;
    totalRatings: number;
    positiveRatings: number;
    positiveFeedbackRate: number | null;
}

interface Pod {
    id: string;
    name: string;
    coreLeader: {
        id: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
    };
    members: PodMember[];
    podPositiveRate: number | null;
}

interface DashboardData {
    pods: Pod[];
    windowDays: number;
    asOf: string;
}

function displayName(firstName: string | null, lastName: string | null, email: string): string {
    if (firstName || lastName) return [firstName, lastName].filter(Boolean).join(' ');
    return email;
}

function memberDisplayName(name: string | null, email: string): string {
    return name ?? email;
}

function rateColor(rate: number | null): string {
    if (rate === null) return 'rgba(255,255,255,0.4)';
    if (rate >= 80) return '#00ff88';
    if (rate >= 60) return '#ffab00';
    return '#ff4d4d';
}

function rateLabel(rate: number | null): string {
    if (rate === null) return '—';
    return `${rate}%`;
}

export default function MentorshipDashboardPage() {
    const router = useRouter();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setRefreshing(true);
        setError(null);
        try {
            const res = await fetch('/api/mentorship/dashboard');

            if (res.status === 403) {
                setAuthorized(false);
                setLoading(false);
                return;
            }
            if (res.status === 401) {
                router.push('/login');
                return;
            }
            if (!res.ok) {
                const body = await res.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(body.error || `Server error: ${res.status}`);
            }

            setData(await res.json());
            setAuthorized(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load mentorship data.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <Loader2 className="animate-spin" size={48} color="var(--accent)" />
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ textAlign: 'center', padding: '48px' }}>
                <div style={{
                    padding: '24px', background: 'rgba(255,77,77,0.1)', borderRadius: '12px',
                    marginBottom: '24px', maxWidth: '500px', margin: '0 auto'
                }}>
                    <ShieldAlert size={48} color="#ff4d4d" style={{ marginBottom: '16px' }} />
                    <p style={{ color: '#ff4d4d', marginBottom: '16px', fontSize: '1.1rem' }}>{error}</p>
                    <button onClick={fetchData} className="btn-primary" style={{ padding: '12px 32px' }}>
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!authorized) {
        return (
            <div style={{
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
                alignItems: 'center', minHeight: '60vh', textAlign: 'center'
            }}>
                <div style={{ padding: '16px', background: 'rgba(255,77,77,0.1)', borderRadius: '16px', marginBottom: '24px' }}>
                    <ShieldAlert size={64} color="#ff4d4d" />
                </div>
                <h1 style={{ fontSize: '2rem', marginBottom: '16px' }}>Access Denied</h1>
                <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '24px' }}>
                    This page requires FLEET role or higher.
                </p>
                <button onClick={() => router.push('/')} className="btn-primary" style={{ padding: '12px 32px' }}>
                    Return to Dashboard
                </button>
            </div>
        );
    }

    if (!data) return null;

    const { pods, windowDays } = data;

    const totalMembers = pods.reduce((s, p) => s + p.members.length, 0);
    const podsWithRate = pods.filter(p => p.podPositiveRate !== null);
    const avgPodRate = podsWithRate.length > 0
        ? Math.round(podsWithRate.reduce((s, p) => s + p.podPositiveRate!, 0) / podsWithRate.length)
        : null;

    return (
        <div style={{ padding: '40px', minHeight: 'calc(100vh - 73px)' }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
                    <div>
                        <h1 className="premium-gradient" style={{ fontSize: '2.5rem', marginBottom: '8px' }}>
                            Mentorship Dashboard
                        </h1>
                        <p style={{ color: 'rgba(255,255,255,0.6)' }}>
                            Pod overview &amp; positive feedback rates — last {windowDays} days
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <Link
                            href="/mentorship-config"
                            style={{
                                padding: '8px 14px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '6px',
                                color: 'rgba(255,255,255,0.7)',
                                display: 'flex', alignItems: 'center', gap: '6px',
                                fontSize: '0.85rem', textDecoration: 'none'
                            }}
                        >
                            <Settings size={15} />
                            Configure
                        </Link>
                        <button
                            onClick={fetchData}
                            disabled={refreshing}
                            style={{
                                padding: '8px 12px',
                                background: 'rgba(0,112,243,0.1)',
                                border: '1px solid rgba(0,112,243,0.3)',
                                borderRadius: '6px',
                                color: 'var(--accent)',
                                cursor: refreshing ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', gap: '6px'
                            }}
                            title="Refresh"
                        >
                            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {/* Summary stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                    <div className="glass-card" style={{ padding: '20px' }}>
                        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>Total Pods</div>
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent)' }}>{pods.length}</div>
                    </div>
                    <div className="glass-card" style={{ padding: '20px' }}>
                        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>Total QA Members</div>
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: '#00d2ff' }}>{totalMembers}</div>
                    </div>
                    <div className="glass-card" style={{ padding: '20px' }}>
                        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>Avg Pod Rate</div>
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: rateColor(avgPodRate) }}>
                            {rateLabel(avgPodRate)}
                        </div>
                    </div>
                    <div className="glass-card" style={{ padding: '20px' }}>
                        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>Rating Window</div>
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ffab00' }}>{windowDays}d</div>
                    </div>
                </div>

                {/* Empty state */}
                {pods.length === 0 && (
                    <div className="glass-card" style={{
                        padding: '64px 32px', textAlign: 'center',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px'
                    }}>
                        <div style={{ padding: '16px', background: 'rgba(0,112,243,0.1)', borderRadius: '16px' }}>
                            <Users size={48} color="var(--accent)" />
                        </div>
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>No pods configured</h2>
                        <p style={{ color: 'rgba(255,255,255,0.5)', maxWidth: '400px', marginBottom: '8px' }}>
                            Create mentorship pods via the configuration panel to start tracking QA team analytics.
                        </p>
                        <Link
                            href="/mentorship-config"
                            className="btn-primary"
                            style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 24px', textDecoration: 'none' }}
                        >
                            <Settings size={16} />
                            Go to Configuration
                        </Link>
                    </div>
                )}

                {/* Pod cards */}
                {pods.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '24px' }}>
                        {pods.map(pod => (
                            <PodCard key={pod.id} pod={pod} windowDays={windowDays} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function PodCard({ pod, windowDays }: { pod: Pod; windowDays: number }) {
    return (
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Pod header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '4px' }}>{pod.name}</h2>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {pod.members.length} QA member{pod.members.length !== 1 ? 's' : ''}
                    </div>
                </div>
                {/* Pod aggregate rate badge */}
                <div style={{
                    padding: '6px 14px',
                    background: pod.podPositiveRate !== null
                        ? `${rateColor(pod.podPositiveRate)}22`
                        : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${rateColor(pod.podPositiveRate)}55`,
                    borderRadius: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    flexShrink: 0
                }}>
                    <TrendingUp size={14} color={rateColor(pod.podPositiveRate)} />
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: rateColor(pod.podPositiveRate) }}>
                        {rateLabel(pod.podPositiveRate)}
                    </span>
                </div>
            </div>

            {/* Core leader */}
            <div style={{
                padding: '12px 16px',
                background: 'rgba(0,112,243,0.08)',
                border: '1px solid rgba(0,112,243,0.2)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
            }}>
                <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: 'rgba(0,112,243,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0
                }}>
                    <Award size={16} color="var(--accent)" />
                </div>
                <div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(0,112,243,0.8)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
                        Lead
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                        {displayName(pod.coreLeader.firstName, pod.coreLeader.lastName, pod.coreLeader.email)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                        {pod.coreLeader.email}
                    </div>
                </div>
            </div>

            {/* Members */}
            {pod.members.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px', color: 'rgba(255,255,255,0.3)', fontSize: '0.9rem' }}>
                    No QA members assigned
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                        QA Members — positive rate ({windowDays}d)
                    </div>
                    {pod.members.map(member => (
                        <MemberRow key={member.id} member={member} />
                    ))}
                </div>
            )}
        </div>
    );
}

function MemberRow({ member }: { member: PodMember }) {
    const color = rateColor(member.positiveFeedbackRate);
    const rate = member.positiveFeedbackRate;

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '10px 12px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.06)'
        }}>
            {/* Avatar initial */}
            <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)',
                flexShrink: 0
            }}>
                {(member.name?.[0] ?? member.email[0]).toUpperCase()}
            </div>

            {/* Name + email */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {memberDisplayName(member.name, member.email)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {member.email}
                </div>
            </div>

            {/* Rate + bar */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color }}>
                    {rateLabel(rate)}
                </span>
                <div style={{ width: '72px', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                        height: '100%',
                        width: rate !== null ? `${rate}%` : '0%',
                        background: color,
                        borderRadius: '2px',
                        transition: 'width 0.4s ease'
                    }} />
                </div>
                {member.totalRatings > 0 && (
                    <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>
                        {member.positiveRatings}/{member.totalRatings}
                    </span>
                )}
                {member.totalRatings === 0 && (
                    <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)' }}>
                        no ratings
                    </span>
                )}
            </div>
        </div>
    );
}
