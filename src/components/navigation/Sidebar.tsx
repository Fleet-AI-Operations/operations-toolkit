'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Database,
    FileText,
    Sparkles,
    FileCheck,
    Star,
    ShieldAlert,
    Settings,
    Link as LinkIcon,
    ShieldCheck,
    Activity,
    ChevronLeft,
    ChevronRight,
    MessageSquare,
    LucideIcon,
    Bot,
    Users,
    ClipboardList,
    Target,
    BarChart3,
    TrendingUp,
    Bug,
    Clock,
    FolderKanban
} from 'lucide-react';
import { useState } from 'react';
import type { UserRole } from '@prisma/client';
import { hasPermission } from '@/lib/permissions';

interface NavItem {
    label: string;
    href: string;
    icon: LucideIcon;
    requiredRole?: UserRole; // Minimum role required (uses hierarchical permissions)
    badge?: string; // Optional badge (e.g., "New", "Beta")
}

interface NavSection {
    title: string;
    items: NavItem[];
    requiredRole?: UserRole; // Minimum role required for entire section
}

export default function Sidebar({ userRole }: { userRole?: UserRole }) {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);

    const sections: NavSection[] = [
        {
            title: 'User Tools',
            requiredRole: 'USER', // Minimum role required
            items: [
                { label: 'Time Recording', href: '/time-recording', icon: Clock, badge: 'New' },
                { label: 'Links', href: '/links', icon: LinkIcon },
            ]
        },
        {
            title: 'QA Tools',
            requiredRole: 'QA',
            items: [
                { label: 'Dashboard', href: '/', icon: LayoutDashboard },
                { label: 'Records', href: '/records', icon: FileText },
                { label: 'Similarity', href: '/similarity', icon: Sparkles },
                { label: 'Top/Bottom 10', href: '/topbottom10', icon: FileCheck },
                { label: 'Top Prompts', href: '/top-prompts', icon: ShieldAlert },
                { label: 'My Assignments', href: '/my-assignments', icon: ClipboardList },
            ]
        },
        {
            title: 'Core Tools',
            requiredRole: 'CORE',
            items: [
                { label: 'Likert Scoring', href: '/likert-scoring', icon: Star },
                { label: 'Review Decisions', href: '/topbottom10/review', icon: FileCheck, badge: 'New' },
            ]
        },
        {
            title: 'Fleet Tools',
            requiredRole: 'FLEET',
            items: [
                // Data section
                { label: 'Ingest', href: '/ingest', icon: Database },
                // Performance section
                { label: 'Bonus Windows', href: '/bonus-windows', icon: Target },
                { label: 'Activity Over Time', href: '/activity-over-time', icon: BarChart3 },
                { label: 'Time Analytics', href: '/time-analytics', icon: TrendingUp },
                { label: 'Analytics', href: '/analytics', icon: BarChart3 },
                // Management section
                { label: 'Project Management', href: '/manage', icon: FolderKanban },
                { label: 'Candidate Review', href: '/candidate-review', icon: MessageSquare },
                { label: 'Rater Groups', href: '/admin/rater-groups', icon: Users },
                { label: 'Assignments', href: '/admin/assignments', icon: ClipboardList },
            ]
        },
        {
            title: 'Admin Tools',
            requiredRole: 'ADMIN',
            items: [
                { label: 'User Management', href: '/admin/users', icon: Users },
                { label: 'Bug Reports', href: '/bug-reports', icon: Bug },
                { label: 'Audit Logs', href: '/admin/audit-logs', icon: FileText },
                { label: 'Configuration', href: '/admin/configuration', icon: Settings },
                { label: 'AI Settings', href: '/admin/ai-settings', icon: Bot },
                { label: 'LLM Models', href: '/admin/llm-models', icon: Sparkles },
                { label: 'API Status', href: '/admin/api-status', icon: Activity },
                { label: 'System Status', href: '/status', icon: ShieldCheck },
            ]
        }
    ];

    const isSectionVisible = (section: NavSection) => {
        if (!section.requiredRole) return true; // No role requirement
        return hasPermission(userRole, section.requiredRole);
    };

    const isItemVisible = (item: NavItem) => {
        if (!item.requiredRole) return true; // No role requirement
        return hasPermission(userRole, item.requiredRole);
    };

    return (
        <aside style={{
            width: collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
            background: 'rgba(5, 5, 10, 0.4)',
            backdropFilter: 'blur(20px)',
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'sticky',
            top: 0,
            height: '100vh',
            zIndex: 100
        }}>
            <div style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', marginBottom: '20px' }}>
                {!collapsed && (
                    <span className="premium-gradient" style={{ fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.02em' }}>
                        OPERATIONS
                    </span>
                )}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    style={{
                        color: 'rgba(255, 255, 255, 0.4)',
                        padding: '4px',
                        borderRadius: '6px',
                        background: 'rgba(255, 255, 255, 0.05)'
                    }}
                    aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px' }}>
                {sections.map((section, idx) => {
                    if (!isSectionVisible(section)) return null;
                    const visibleItems = section.items.filter(isItemVisible);
                    if (visibleItems.length === 0) return null;

                    return (
                        <div key={idx} style={{ marginBottom: '24px' }}>
                            {!collapsed && <div className="sidebar-section-title">{section.title}</div>}
                            {visibleItems.map((item, i) => {
                                const active = pathname === item.href;
                                return (
                                    <Link
                                        key={i}
                                        href={item.href}
                                        className={`sidebar-link ${active ? 'active' : ''}`}
                                        title={collapsed ? item.label : ''}
                                    >
                                        <item.icon size={20} />
                                        {!collapsed && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                                                {item.label}
                                                {item.badge && (
                                                    <span style={{
                                                        fontSize: '0.65rem',
                                                        padding: '2px 6px',
                                                        borderRadius: '4px',
                                                        background: 'rgba(0, 112, 243, 0.2)',
                                                        color: 'var(--accent)',
                                                        fontWeight: 600
                                                    }}>
                                                        {item.badge}
                                                    </span>
                                                )}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </aside>
    );
}
