'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
const APPS = {
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
export function AppSwitcher({ currentApp, userRole }) {
    const [isOpen, setIsOpen] = useState(false);
    const accessibleApps = Object.values(APPS).filter(app => userRole && app.roles.includes(userRole));
    const currentAppConfig = APPS[currentApp];
    if (accessibleApps.length <= 1) {
        return null; // Don't show switcher if user only has access to one app
    }
    return (_jsxs("div", { style: {
            padding: '12px 24px',
            borderBottom: '1px solid var(--border)',
            position: 'relative'
        }, children: [_jsxs("button", { onClick: () => setIsOpen(!isOpen), style: {
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
                }, onMouseEnter: (e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                }, onMouseLeave: (e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }, children: [_jsxs("span", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsx("span", { style: {
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    background: 'var(--accent)'
                                } }), currentAppConfig.label] }), _jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", style: {
                            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s'
                        }, children: _jsx("polyline", { points: "6 9 12 15 18 9" }) })] }), isOpen && (_jsx("div", { style: {
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
                }, children: accessibleApps.map(app => {
                    const isCurrent = app.name === currentApp;
                    const url = `http://localhost:${app.port}`;
                    return (_jsxs("a", { href: url, style: {
                            display: 'block',
                            padding: '12px 16px',
                            color: isCurrent ? 'var(--accent)' : 'white',
                            textDecoration: 'none',
                            background: isCurrent ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                            borderLeft: isCurrent ? '3px solid var(--accent)' : '3px solid transparent',
                            transition: 'all 0.2s',
                            cursor: isCurrent ? 'default' : 'pointer'
                        }, onMouseEnter: (e) => {
                            if (!isCurrent) {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                            }
                        }, onMouseLeave: (e) => {
                            if (!isCurrent) {
                                e.currentTarget.style.background = 'transparent';
                            }
                        }, onClick: (e) => {
                            if (isCurrent) {
                                e.preventDefault();
                            }
                        }, children: [_jsxs("div", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: '4px'
                                }, children: [_jsx("span", { style: {
                                            fontWeight: 600,
                                            fontSize: '0.875rem'
                                        }, children: app.label }), isCurrent && (_jsx("span", { style: {
                                            fontSize: '0.75rem',
                                            color: 'var(--accent)',
                                            opacity: 0.7
                                        }, children: "Current" }))] }), _jsx("div", { style: {
                                    fontSize: '0.75rem',
                                    color: 'rgba(255, 255, 255, 0.5)'
                                }, children: app.description })] }, app.name));
                }) })), isOpen && (_jsx("div", { style: {
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 999
                }, onClick: () => setIsOpen(false) }))] }));
}
