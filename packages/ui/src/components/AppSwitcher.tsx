'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export interface AppSwitcherProps {
    currentApp: 'user' | 'qa' | 'core' | 'fleet' | 'admin';
    userRole?: string;
}

interface AppConfig {
    name: string;
    label: string;
    port: number;
    roles: string[];
    description: string;
}

const APPS: Record<string, AppConfig> = {
    user: {
        name: 'user',
        label: 'User',
        port: 3001,
        roles: ['USER', 'QA', 'CORE', 'FLEET', 'ADMIN'],
        description: 'Time tracking and links'
    },
    qa: {
        name: 'qa',
        label: 'QA',
        port: 3002,
        roles: ['QA', 'CORE', 'FLEET', 'ADMIN'],
        description: 'Analysis tools'
    },
    core: {
        name: 'core',
        label: 'Core',
        port: 3003,
        roles: ['CORE', 'FLEET', 'ADMIN'],
        description: 'Scoring and review'
    },
    fleet: {
        name: 'fleet',
        label: 'Fleet',
        port: 3004,
        roles: ['FLEET', 'ADMIN'],
        description: 'Fleet management'
    },
    admin: {
        name: 'admin',
        label: 'Admin',
        port: 3005,
        roles: ['ADMIN'],
        description: 'Administration'
    }
};

// Production URLs - MUST be accessed by exact name for Next.js to inline them at build time
const APP_URLS = {
    user: process.env.NEXT_PUBLIC_USER_APP_URL,
    qa: process.env.NEXT_PUBLIC_QA_APP_URL,
    core: process.env.NEXT_PUBLIC_CORE_APP_URL,
    fleet: process.env.NEXT_PUBLIC_FLEET_APP_URL,
    admin: process.env.NEXT_PUBLIC_ADMIN_APP_URL
};

export function AppSwitcher({ currentApp, userRole }: AppSwitcherProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [sessionTokens, setSessionTokens] = useState<{ access: string; refresh: string } | null>(null);

    // Get current session tokens for SSO
    useEffect(() => {
        const getSession = async () => {
            try {
                const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
                const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

                if (!supabaseUrl || !supabaseKey) {
                    console.error('[AppSwitcher] Missing Supabase environment variables');
                    return;
                }

                const supabase = createBrowserClient(supabaseUrl, supabaseKey);
                const { data: { session } } = await supabase.auth.getSession();

                if (session?.access_token && session?.refresh_token) {
                    setSessionTokens({
                        access: session.access_token,
                        refresh: session.refresh_token
                    });
                }
            } catch (error) {
                console.error('[AppSwitcher] Failed to get session:', error);
            }
        };

        getSession();
    }, []);

    const accessibleApps = Object.values(APPS).filter(app =>
        userRole && app.roles.includes(userRole)
    );

    const currentAppConfig = APPS[currentApp];

    if (accessibleApps.length <= 1) {
        return null; // Don't show switcher if user only has access to one app
    }

    return (
        <div style={{
            padding: '12px 24px',
            borderBottom: '1px solid var(--border)',
            position: 'relative'
        }}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.875rem',
                    transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }}
            >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: 'var(--accent)'
                    }} />
                    {currentAppConfig.label}
                </span>
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s'
                    }}
                >
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: '12px',
                    right: '12px',
                    marginTop: '4px',
                    background: 'rgba(20, 20, 25, 0.98)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    zIndex: 1000,
                    overflow: 'hidden',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
                }}>
                    {accessibleApps.map(app => {
                        const isCurrent = app.name === currentApp;

                        // Generate environment-appropriate URL with SSO token
                        const getAppUrl = (appName: keyof typeof APP_URLS, port: number): string => {
                            let baseUrl = '';

                            // In browser, check if we're on localhost
                            if (typeof window !== 'undefined') {
                                const isDevelopment = window.location.hostname === 'localhost' ||
                                                     window.location.hostname === '127.0.0.1';

                                if (isDevelopment) {
                                    baseUrl = `http://localhost:${port}`;
                                } else {
                                    // Production: Use environment variables from APP_URLS
                                    const envUrl = APP_URLS[appName];

                                    if (envUrl) {
                                        baseUrl = envUrl;
                                    } else {
                                        // WARNING: No environment variable set!
                                        console.error(
                                            `AppSwitcher: NEXT_PUBLIC_${appName.toUpperCase()}_APP_URL not set. ` +
                                            `Cross-app navigation will not work correctly. ` +
                                            `Set this environment variable in Vercel with the production URL for the ${appName} app.`
                                        );

                                        // Return empty string to make the link obvious broken
                                        return '#missing-env-var';
                                    }
                                }
                            } else {
                                // Server-side fallback
                                baseUrl = `http://localhost:${port}`;
                            }

                            // Append SSO tokens if available (for cross-app authentication)
                            if (sessionTokens) {
                                const params = new URLSearchParams({
                                    sso_access_token: sessionTokens.access,
                                    sso_refresh_token: sessionTokens.refresh
                                });
                                return `${baseUrl}?${params.toString()}`;
                            }

                            return baseUrl;
                        };

                        const url = getAppUrl(app.name as keyof typeof APP_URLS, app.port);

                        return (
                            <a
                                key={app.name}
                                href={url}
                                style={{
                                    display: 'block',
                                    padding: '12px 16px',
                                    color: isCurrent ? 'var(--accent)' : 'white',
                                    textDecoration: 'none',
                                    background: isCurrent ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                                    borderLeft: isCurrent ? '3px solid var(--accent)' : '3px solid transparent',
                                    transition: 'all 0.2s',
                                    cursor: isCurrent ? 'default' : 'pointer'
                                }}
                                onMouseEnter={(e) => {
                                    if (!isCurrent) {
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isCurrent) {
                                        e.currentTarget.style.background = 'transparent';
                                    }
                                }}
                                onClick={(e) => {
                                    if (isCurrent) {
                                        e.preventDefault();
                                    }
                                }}
                            >
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: '4px'
                                }}>
                                    <span style={{
                                        fontWeight: 600,
                                        fontSize: '0.875rem'
                                    }}>
                                        {app.label}
                                    </span>
                                    {isCurrent && (
                                        <span style={{
                                            fontSize: '0.75rem',
                                            color: 'var(--accent)',
                                            opacity: 0.7
                                        }}>
                                            Current
                                        </span>
                                    )}
                                </div>
                                <div style={{
                                    fontSize: '0.75rem',
                                    color: 'rgba(255, 255, 255, 0.5)'
                                }}>
                                    {app.description}
                                </div>
                            </a>
                        );
                    })}
                </div>
            )}

            {isOpen && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 999
                    }}
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    );
}
