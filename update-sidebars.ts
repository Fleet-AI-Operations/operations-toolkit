/**
 * Script to update Sidebar navigation for each app
 * Each app should only show links to routes that exist within that app
 */

// Fleet App Routes
const fleetSections = `
    const sections: NavSection[] = [
        {
            title: 'Overview',
            items: [
                { label: 'Dashboard', href: '/', icon: LayoutDashboard },
            ]
        },
        {
            title: 'Fleet Management',
            role: ['FLEET', 'ADMIN'],
            items: [
                { label: 'Ingest Data', href: '/ingest', icon: Database },
                { label: 'Project Management', href: '/manage', icon: Settings },
                { label: 'Analytics', href: '/analytics', icon: BarChart3 },
            ]
        },
        {
            title: 'Operations',
            role: ['FLEET', 'ADMIN'],
            items: [
                { label: 'Bonus Windows', href: '/bonus-windows', icon: Target },
                { label: 'Activity Over Time', href: '/activity-over-time', icon: BarChart3 },
                { label: 'Time Analytics', href: '/time-analytics', icon: TrendingUp },
                { label: 'Waiting Approval', href: '/waiting-approval', icon: Clock },
            ]
        },
        {
            title: 'System',
            role: ['ADMIN'],
            items: [
                { label: 'Bug Reports', href: '/bug-reports', icon: Bug },
                { label: 'Admin', href: '/admin', icon: ShieldCheck },
            ]
        }
    ];
`;

// QA App Routes
const qaSections = `
    const sections: NavSection[] = [
        {
            title: 'Overview',
            items: [
                { label: 'Dashboard', href: '/', icon: LayoutDashboard },
            ]
        },
        {
            title: 'Analysis',
            role: ['QA', 'CORE', 'FLEET', 'ADMIN'],
            items: [
                { label: 'Records', href: '/records', icon: FileText },
                { label: 'Similarity', href: '/similarity', icon: Sparkles },
                { label: 'Top/Bottom 10', href: '/topbottom10', icon: FileCheck },
                { label: 'Top Prompts', href: '/top-prompts', icon: ShieldAlert },
                { label: 'Compare', href: '/compare', icon: GitCompare },
            ]
        }
    ];
`;

// Core App Routes
const coreSections = `
    const sections: NavSection[] = [
        {
            title: 'Overview',
            items: [
                { label: 'Dashboard', href: '/', icon: LayoutDashboard },
            ]
        },
        {
            title: 'Scoring',
            role: ['CORE', 'FLEET', 'ADMIN'],
            items: [
                { label: 'Likert Scoring', href: '/likert-scoring', icon: Star },
                { label: 'Candidate Review', href: '/candidate-review', icon: MessageSquare },
                { label: 'My Assignments', href: '/my-assignments', icon: ClipboardList },
            ]
        }
    ];
`;

// Admin App Routes
const adminSections = `
    const sections: NavSection[] = [
        {
            title: 'Overview',
            items: [
                { label: 'Dashboard', href: '/', icon: LayoutDashboard },
            ]
        },
        {
            title: 'Administration',
            role: ['ADMIN'],
            items: [
                { label: 'Admin Dashboard', href: '/admin', icon: ShieldCheck },
                { label: 'Users', href: '/admin/users', icon: Users },
                { label: 'Audit Logs', href: '/admin/audit-logs', icon: FileText },
                { label: 'Configuration', href: '/admin/configuration', icon: Settings },
            ]
        },
        {
            title: 'System Settings',
            role: ['ADMIN'],
            items: [
                { label: 'AI Settings', href: '/admin/ai-settings', icon: Bot },
                { label: 'LLM Models', href: '/admin/llm-models', icon: Sparkles },
                { label: 'API Status', href: '/admin/api-status', icon: Activity },
            ]
        },
        {
            title: 'Management',
            role: ['ADMIN'],
            items: [
                { label: 'Rater Groups', href: '/admin/rater-groups', icon: Users },
                { label: 'Assignments', href: '/admin/assignments', icon: ClipboardList },
            ]
        }
    ];
`;

// User App Routes
const userSections = `
    const sections: NavSection[] = [
        {
            title: 'Overview',
            items: [
                { label: 'Dashboard', href: '/', icon: LayoutDashboard },
                { label: 'Links', href: '/links', icon: LinkIcon },
            ]
        },
        {
            title: 'Time Tracking',
            items: [
                { label: 'Time Tracking', href: '/time-tracking', icon: Clock },
                { label: 'Bonus Windows', href: '/time-tracking/bonus-windows', icon: Target },
                { label: 'Analytics', href: '/time-tracking/time-analytics', icon: TrendingUp },
            ]
        }
    ];
`;

export const sidebarConfigs = {
    fleet: fleetSections,
    qa: qaSections,
    core: coreSections,
    admin: adminSections,
    user: userSections
};
