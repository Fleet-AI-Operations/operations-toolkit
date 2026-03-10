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
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    ExternalLink,
    LucideIcon,
    UserSearch,
} from 'lucide-react';
import { useState, useMemo } from 'react';

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
            { label: 'Similarity Flags', href: '/similarity-flags', icon: AlertTriangle, app: 'core' },
            { label: 'Task Creator Deep-Dive', href: '/task-creator-deep-dive', icon: UserSearch, app: 'core' },
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
            { label: 'Time Reporting - Deep Analysis', href: '/time-reporting-analysis', icon: Clock, app: 'fleet' },
            { label: 'Time Reporting - Meetings', href: '/time-reporting-meetings', icon: CalendarCheck, app: 'fleet' },
            { label: 'Time Reporting - Quick Screen', href: '/time-reporting-screening', icon: Clock, app: 'fleet' },
            { label: 'Weekly Task Metrics', href: '/weekly-task-metrics', icon: BarChart3, app: 'fleet' },
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
        title: 'Workforce Monitoring',
        minRole: 'FLEET',
        items: [
            { label: 'Workers', href: '/workforce-monitoring', icon: UserSearch, app: 'fleet' },
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
    const [searchQuery, setSearchQuery] = useState('');

    const userWeight = userRole ? (ROLE_WEIGHTS[userRole] ?? -1) : -1;

    function getBaseUrl(app: AppName): string {
        const envUrl = APP_URLS[app];
        if (envUrl) return envUrl;
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

    const visibleSections = useMemo(() =>
        NAV_SECTIONS.filter(section => {
            const minWeight = ROLE_WEIGHTS[section.minRole] ?? 0;
            if (userWeight < minWeight) return false;
            if (section.hideInApps?.includes(currentApp)) return false;
            return true;
        }),
        [userWeight, currentApp]
    );

    const searchResults = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return null;
        return visibleSections.flatMap(section =>
            section.items
                .filter(item => item.label.toLowerCase().includes(q))
                .map(item => ({ ...item, sectionTitle: section.title }))
        );
    }, [searchQuery, visibleSections]);

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
                    onClick={() => { setCollapsed(!collapsed); setSearchQuery(''); }}
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

            {!collapsed && (
                <div style={{ padding: '0 12px 16px' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={14} style={{
                            position: 'absolute',
                            left: '10px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'rgba(255,255,255,0.3)',
                            pointerEvents: 'none',
                        }} />
                        <input
                            type="text"
                            placeholder="Search tools..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                                padding: '7px 10px 7px 32px',
                                color: 'rgba(255,255,255,0.85)',
                                fontSize: '0.8rem',
                                outline: 'none',
                                boxSizing: 'border-box',
                            }}
                            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; }}
                            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                        />
                    </div>
                </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px' }}>
                {searchResults !== null ? (
                    searchResults.length === 0 ? (
                        <div style={{
                            padding: '12px',
                            fontSize: '0.8rem',
                            color: 'rgba(255,255,255,0.35)',
                            textAlign: 'center',
                        }}>
                            No tools found
                        </div>
                    ) : (
                        searchResults.map((item) => {
                            const isInternal = item.app === currentApp;
                            const active = isInternal && pathname === item.href;

                            if (isInternal) {
                                return (
                                    <Link
                                        key={`${item.app}:${item.href}`}
                                        href={item.href}
                                        className={`sidebar-link ${active ? 'active' : ''}`}
                                    >
                                        <item.icon size={20} />
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0, flex: 1 }}>
                                            <span>{item.label}</span>
                                            <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.sectionTitle}</span>
                                        </div>
                                    </Link>
                                );
                            }

                            return (
                                <a
                                    key={`${item.app}:${item.href}`}
                                    href={`${getBaseUrl(item.app)}${item.href}`}
                                    className="sidebar-link"
                                >
                                    <item.icon size={20} />
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flex: 1, minWidth: 0 }}>
                                        <span style={{ flex: 1 }}>{item.label}</span>
                                        <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.sectionTitle}</span>
                                    </div>
                                    <ExternalLink size={12} style={{ opacity: 0.4, flexShrink: 0 }} />
                                </a>
                            );
                        })
                    )
                ) : (
                    visibleSections.map((section) => {
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
                                                {!collapsed && <span style={{ flex: 1 }}>{item.label}</span>}
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
                    })
                )}
            </div>
        </aside>
    );
}
