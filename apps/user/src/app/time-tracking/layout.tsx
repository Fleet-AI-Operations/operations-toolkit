'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Target, Clock, TrendingUp } from 'lucide-react';

const timeTrackingNavItems = [
    {
        href: '/time-tracking/bonus-windows',
        label: 'Bonus Windows',
        icon: Target,
        description: 'Configure and track performance windows'
    },
    {
        href: '/time-tracking/time-analytics',
        label: 'Time Analytics',
        icon: TrendingUp,
        description: 'Advanced time tracking analytics'
    },
];

export default function TimeTrackingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    return (
        <div style={{ display: 'flex', minHeight: 'calc(100vh - 73px)', gap: '0' }}>
            {/* Sidebar */}
            <aside style={{
                width: '280px',
                background: 'rgba(255,255,255,0.02)',
                borderRight: '1px solid var(--border)',
                padding: '32px 0',
                position: 'sticky',
                top: '73px',
                height: 'calc(100vh - 73px)',
                overflowY: 'auto'
            }}>
                <div style={{ paddingLeft: '24px', marginBottom: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <Clock size={24} color="var(--accent)" />
                        <h2 className="premium-gradient" style={{ fontSize: '1.5rem', margin: 0 }}>
                            Time & Bonus
                        </h2>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
                        Performance tracking & management
                    </p>
                </div>

                <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {timeTrackingNavItems.map((item) => {
                        const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '12px',
                                    padding: '12px 24px',
                                    textDecoration: 'none',
                                    color: isActive ? '#fff' : 'rgba(255,255,255,0.6)',
                                    background: isActive ? 'rgba(0,112,243,0.1)' : 'transparent',
                                    borderLeft: `3px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                                        e.currentTarget.style.color = '#fff';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.color = 'rgba(255,255,255,0.6)';
                                    }
                                }}
                            >
                                <Icon size={20} style={{ marginTop: '2px', flexShrink: 0 }} />
                                <div>
                                    <div style={{ fontWeight: isActive ? 600 : 500, fontSize: '0.95rem', marginBottom: '2px' }}>
                                        {item.label}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.6, lineHeight: '1.3' }}>
                                        {item.description}
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </nav>

                <div style={{
                    marginTop: '32px',
                    paddingLeft: '24px',
                    paddingRight: '24px',
                    paddingTop: '24px',
                    borderTop: '1px solid var(--border)'
                }}>
                    <Link
                        href="/"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            color: 'rgba(255,255,255,0.5)',
                            fontSize: '0.85rem',
                            textDecoration: 'none',
                            transition: 'color 0.2s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
                    >
                        ← Back to Dashboard
                    </Link>
                </div>
            </aside>

            {/* Main Content */}
            <main style={{
                flex: 1,
                padding: '40px',
                maxWidth: '1200px',
                width: '100%'
            }}>
                {children}
            </main>
        </div>
    );
}
