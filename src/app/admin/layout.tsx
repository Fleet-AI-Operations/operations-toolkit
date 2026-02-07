'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Users, ShieldAlert, Database, Sparkles, Activity, Shield, ListChecks } from 'lucide-react';
import { useRoleCheck } from '@/hooks/useRoleCheck';

const adminNavItems = [
    {
        href: '/admin/ai-settings',
        label: 'AI Settings',
        icon: Sparkles,
        description: 'Configure AI provider and models'
    },
    {
        href: '/admin/configuration',
        label: 'System Management',
        icon: Database,
        description: 'Bulk operations and maintenance'
    },
    {
        href: '/admin/queue-monitor',
        label: 'Queue Monitor',
        icon: ListChecks,
        description: 'Monitor ingestion job queue'
    },
    {
        href: '/admin/users',
        label: 'User Management',
        icon: Users,
        description: 'Manage user roles and permissions'
    },
    {
        href: '/admin/api-status',
        label: 'API Status',
        icon: Activity,
        description: 'Monitor REST endpoint health'
    },
    {
        href: '/admin/audit-logs',
        label: 'Audit Logs',
        icon: Shield,
        description: 'Track user actions and operations'
    },
];

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const { isAuthorized } = useRoleCheck({
        allowedRoles: ['ADMIN'],
        redirectOnUnauthorized: '/',
        redirectOnUnauthenticated: '/login'
    });

    if (isAuthorized === null) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
                <div className="spinner" />
            </div>
        );
    }

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
                        <ShieldAlert size={24} color="#ff4d4d" />
                        <h2 className="premium-gradient" style={{ fontSize: '1.5rem', margin: 0 }}>
                            Admin Console
                        </h2>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
                        System administration
                    </p>
                </div>

                <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {adminNavItems.map((item) => {
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
