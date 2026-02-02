'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Database,
    FileText,
    Clock,
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
    LucideIcon
} from 'lucide-react';
import { useState } from 'react';

interface NavItem {
    label: string;
    href: string;
    icon: LucideIcon;
    role?: string[];
}

interface NavSection {
    title: string;
    items: NavItem[];
    role?: string[];
}

export default function Sidebar({ userRole }: { userRole?: string }) {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);

    const sections: NavSection[] = [
        {
            title: 'Overview',
            items: [
                { label: 'Dashboard', href: '/', icon: LayoutDashboard },
                { label: 'Links', href: '/links', icon: LinkIcon },
            ]
        },
        {
            title: 'Analysis',
            items: [
                { label: 'Records', href: '/records', icon: FileText },
                { label: 'Similarity', href: '/similarity', icon: Sparkles },
                { label: 'Top/Bottom 10', href: '/topbottom10', icon: FileCheck },
                { label: 'Likert Scoring', href: '/likert-scoring', icon: Star },
                { label: 'Top Prompts', href: '/top-prompts', icon: ShieldAlert },
            ]
        },
        {
            title: 'Operations Tools',
            items: [
                { label: 'Ingest', href: '/ingest', icon: Database },
                { label: 'Time Tracking', href: '/time-tracking', icon: Clock, role: ['ADMIN', 'MANAGER'] },
                { label: 'Project Management', href: '/manage', icon: Settings, role: ['ADMIN', 'MANAGER'] },
            ]
        },
        {
            title: 'System',
            role: ['ADMIN'],
            items: [
                { label: 'Admin', href: '/admin', icon: ShieldCheck },
                { label: 'Status', href: '/status', icon: Activity },
            ]
        }
    ];

    const isSectionVisible = (section: NavSection) => {
        if (!section.role || section.role.length === 0) return true;
        if (!userRole) return false;
        return section.role.includes(userRole);
    };

    const isItemVisible = (item: NavItem) => {
        if (!item.role || item.role.length === 0) return true;
        if (!userRole) return false;
        return item.role.includes(userRole);
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
                                        {!collapsed && <span>{item.label}</span>}
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
