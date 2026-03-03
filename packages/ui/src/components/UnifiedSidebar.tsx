'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Clock,
    Link as LinkIcon,
    FileText,
    Sparkles,
    ShieldAlert,
    FileCheck,
    Star,
    Search,
    BarChart3,
    Database,
    BookMarked,
    ScanSearch,
    SearchCheck,
    MessageSquare,
    Target,
    ClipboardList,
    Users,
    CalendarCheck,
    Bug,
    Settings,
    Bot,
    Activity,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    ExternalLink,
    LucideIcon,
} from 'lucide-react';
import { useState } from 'react';

type AppName = 'user' | 'qa' | 'core' | 'fleet' | 'admin';

const APP_PORTS: Record<AppName, number> = {
    user: 3001,
    qa: 3002,
    core: 3003,
    fleet: 3004,
    admin: 3005,
};

// Production URLs — must be accessed by exact name for Next.js to inline them at build time
const APP_URLS = {
    user: process.env.NEXT_PUBLIC_USER_APP_URL,
    qa: process.env.NEXT_PUBLIC_QA_APP_URL,
    core: process.env.NEXT_PUBLIC_CORE_APP_URL,
    fleet: process.env.NEXT_PUBLIC_FLEET_APP_URL,
    admin: process.env.NEXT_PUBLIC_ADMIN_APP_URL,
};

const ROLE_WEIGHTS: Record<string, number> = {
    PENDING: 0,
    USER: 1,
    QA: 2,
    CORE: 3,
    FLEET: 4,
    MANAGER: 5,
    ADMIN: 6,
};

interface NavItem {
    label: string;
    href: string;
    icon: LucideIcon;
    app: AppName;
}

interface NavSection {
    title: string;
    minRole: string;
    items: NavItem[];
    hideInApps?: AppName[];
}

const NAV_SECTIONS: NavSection[] = [
    {
        title: 'Core Tools',
        minRole: 'CORE',
        items: [
            { label: 'Alignment Scoring', href: '/alignment-scoring', icon: Sparkles, app: 'core' },
            { label: 'Likert Scoring', href: '/likert-scoring', icon: Star, app: 'core' },
            { label: 'Task Search', href: '/task-search', icon: Search, app: 'core' },
        ],
    },
    {
        title: 'Data Management',
        minRole: 'FLEET',
        items: [
            { label: 'Analytics', href: '/analytics', icon: BarChart3, app: 'fleet' },
            { label: 'Ingest Data', href: '/ingest', icon: Database, app: 'fleet' },
            { label: 'Guidelines', href: '/guidelines', icon: FileCheck, app: 'fleet' },
        ],
    },
    {
        title: 'Management',
        minRole: 'FLEET',
        hideInApps: ['core'],
        items: [
            { label: 'Assignments', href: '/assignments', icon: ClipboardList, app: 'fleet' },
            { label: 'Rater Groups', href: '/rater-groups', icon: Users, app: 'fleet' },
        ],
    },
    {
        title: 'Operations Tools',
        minRole: 'FLEET',
        items: [
            { label: 'Activity Over Time', href: '/activity-over-time', icon: BarChart3, app: 'fleet' },
            { label: 'Bonus Windows', href: '/bonus-windows', icon: Target, app: 'fleet' },
            { label: 'Time Reporting - Quick Screen', href: '/time-reporting-screening', icon: Clock, app: 'fleet' },
            { label: 'Time Reporting - Deep Analysis', href: '/time-reporting-analysis', icon: Clock, app: 'fleet' },
            { label: 'Time Reporting - Meetings', href: '/time-reporting-meetings', icon: CalendarCheck, app: 'fleet' },
        ],
    },
    {
        title: 'QA Tools',
        minRole: 'QA',
        items: [
            { label: 'Records', href: '/records', icon: FileText, app: 'qa' },
            { label: 'Similarity Search', href: '/similarity', icon: Sparkles, app: 'qa' },
            { label: 'Top Prompts', href: '/top-prompts', icon: ShieldAlert, app: 'qa' },
            { label: 'Top/Bottom 10', href: '/topbottom10', icon: FileCheck, app: 'qa' },
        ],
    },
    {
        title: 'Resources',
        minRole: 'USER',
        items: [
            { label: 'Links', href: '/links', icon: LinkIcon, app: 'user' },
        ],
    },
    {
        title: 'Site Administration and Configuration',
        minRole: 'ADMIN',
        items: [
            { label: 'AI Settings', href: '/admin/ai-settings', icon: Bot, app: 'admin' },
            { label: 'API Status', href: '/admin/api-status', icon: Activity, app: 'admin' },
            { label: 'Audit Logs', href: '/admin/audit-logs', icon: FileText, app: 'admin' },
            { label: 'Bug Reports', href: '/bug-reports', icon: Bug, app: 'admin' },
            { label: 'Configuration', href: '/admin/configuration', icon: Settings, app: 'admin' },
            { label: 'LLM Models', href: '/admin/llm-models', icon: Sparkles, app: 'admin' },
            { label: 'Notification Settings', href: '/admin/notification-settings', icon: MessageSquare, app: 'admin' },
            { label: 'Users', href: '/admin/users', icon: Users, app: 'admin' },
        ],
    },
    {
        title: 'Tasks & Feedback Tools',
        minRole: 'FLEET',
        items: [
            { label: 'AI Quality Rater', href: '/ai-quality-rating', icon: Sparkles, app: 'fleet' },
            { label: 'Exemplar Tasks', href: '/exemplar-tasks', icon: BookMarked, app: 'fleet' },
            { label: 'Full Similarity Check', href: '/full-similarity-check', icon: ScanSearch, app: 'fleet' },
            { label: 'Prompt Authenticity Checker', href: '/prompt-authenticity', icon: SearchCheck, app: 'fleet' },
            { label: 'QA Feedback Analysis', href: '/qa-feedback-analysis', icon: MessageSquare, app: 'fleet' },
        ],
    },
    // {
    //     title: 'Time Tracking',
    //     minRole: 'USER',
    //     items: [
    //         { label: 'Time Tracking', href: '/time-tracking', icon: Clock, app: 'user' },
    //     ],
    // },
];

export interface UnifiedSidebarProps {
    currentApp: AppName;
    userRole?: string;
}

export function UnifiedSidebar({ currentApp, userRole }: UnifiedSidebarProps) {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

    const userWeight = userRole ? (ROLE_WEIGHTS[userRole] ?? -1) : -1;

    function getBaseUrl(app: AppName): string {
        if (typeof window !== 'undefined') {
            const isDev =
                window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1';

            if (isDev) {
                return `http://localhost:${APP_PORTS[app]}`;
            }

            const envUrl = APP_URLS[app];
            if (envUrl) return envUrl;

            console.error(
                `UnifiedSidebar: NEXT_PUBLIC_${app.toUpperCase()}_APP_URL not set. ` +
                `Cross-app navigation will not work correctly.`
            );
            return '#missing-env-var';
        }
        return `http://localhost:${APP_PORTS[app]}`;
    }

    const toggleSection = (title: string) => {
        setCollapsedSections(prev => {
            const next = new Set(prev);
            if (next.has(title)) {
                next.delete(title);
            } else {
                next.add(title);
            }
            return next;
        });
    };

    const visibleSections = NAV_SECTIONS.filter(section => {
        const minWeight = ROLE_WEIGHTS[section.minRole] ?? 0;
        if (userWeight < minWeight) return false;
        if (section.hideInApps?.includes(currentApp)) return false;
        return true;
    });

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
            <div style={{
                padding: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'space-between',
                marginBottom: '20px'
            }}>
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
                >
                    {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px' }}>
                {visibleSections.map((section) => {
                    const isSectionCollapsed = collapsedSections.has(section.title);

                    return (
                        <div key={section.title} style={{ marginBottom: '24px' }}>
                            {!collapsed && (
                                <button
                                    onClick={() => toggleSection(section.title)}
                                    className="sidebar-section-title"
                                    style={{
                                        all: 'unset',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        width: '100%',
                                        cursor: 'pointer',
                                        padding: '8px 12px',
                                        marginBottom: '4px',
                                        borderRadius: '6px',
                                        transition: 'background 0.2s',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'transparent';
                                    }}
                                >
                                    <span style={{
                                        fontSize: '0.7rem',
                                        fontWeight: 800,
                                        letterSpacing: '0.1em',
                                        textTransform: 'uppercase',
                                        color: 'rgba(255, 255, 255, 0.5)',
                                    }}>
                                        {section.title}
                                    </span>
                                    <ChevronDown
                                        size={14}
                                        style={{
                                            color: 'rgba(255, 255, 255, 0.4)',
                                            transform: isSectionCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                                            transition: 'transform 0.2s',
                                        }}
                                    />
                                </button>
                            )}
                            {!isSectionCollapsed && section.items.map((item) => {
                                const isInternal = item.app === currentApp;
                                const active = isInternal && pathname === item.href;

                                if (isInternal) {
                                    return (
                                        <Link
                                            key={`${item.app}:${item.href}`}
                                            href={item.href}
                                            className={`sidebar-link ${active ? 'active' : ''}`}
                                            title={collapsed ? item.label : ''}
                                            style={{ justifyContent: collapsed ? 'center' : undefined }}
                                        >
                                            <item.icon size={20} />
                                            {!collapsed && <span>{item.label}</span>}
                                        </Link>
                                    );
                                }

                                return (
                                    <a
                                        key={`${item.app}:${item.href}`}
                                        href={`${getBaseUrl(item.app)}${item.href}`}
                                        className="sidebar-link"
                                        title={collapsed ? item.label : ''}
                                        style={{ justifyContent: collapsed ? 'center' : undefined }}
                                    >
                                        <item.icon size={20} />
                                        {!collapsed && (
                                            <>
                                                <span style={{ flex: 1 }}>{item.label}</span>
                                                <ExternalLink size={12} style={{ opacity: 0.4, flexShrink: 0 }} />
                                            </>
                                        )}
                                    </a>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </aside>
    );
}
