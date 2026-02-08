'use client';

import { ExternalLink, BookOpen, FileText } from 'lucide-react';

interface LinkItem {
    title: string;
    description: string;
    url: string;
    icon: any;
    category: string;
}

export default function LinksPage() {
    // You can update this list over time
    const links: LinkItem[] = [
        {
            title: 'QA Guidelines',
            description: 'Quality assurance standards and testing procedures',
            url: 'https://fleetai.notion.site/QA-Guidelines-2f5fe5dd3fba80daa9b8f63a6ba85c56#2f5fe5dd3fba81af82efe72c747b2931',
            icon: FileText,
            category: 'General'
        },
        {
            title: 'Kinesis',
            description: 'Project Kinesis guidelines and documentation',
            url: 'https://fleetai.notion.site/Project-Kinesis-Guidelines-2d6fe5dd3fba8023aa78e345939dac3d',
            icon: BookOpen,
            category: 'Project Guidelines'
        },
        {
            title: 'Meridian',
            description: 'Project Meridian guidelines and documentation',
            url: 'https://fleetai.notion.site/Project-Meridian-Guidelines-2eafe5dd3fba80079b86de5dce865477',
            icon: BookOpen,
            category: 'Project Guidelines'
        },
        {
            title: 'Iterum',
            description: 'Project Iterum guidelines and documentation',
            url: 'https://www.notion.so/user-interviews/Project-Iterum-Guidelines-2e72a080ec4c80689bf1ec085f0eca49',
            icon: BookOpen,
            category: 'Project Guidelines'
        },
    ];

    // Group links by category
    const categories = Array.from(new Set(links.map(link => link.category)));

    return (
        <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ marginBottom: '48px' }}>
                <h1 className="premium-gradient" style={{ fontSize: '2.5rem', marginBottom: '8px' }}>
                    Quick Links
                </h1>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1.1rem' }}>
                    Helpful resources and external tools
                </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
                {categories.map(category => (
                    <section key={category}>
                        <h2 style={{
                            fontSize: '1.5rem',
                            marginBottom: '24px',
                            paddingBottom: '12px',
                            borderBottom: '1px solid rgba(255,255,255,0.1)'
                        }}>
                            {category}
                        </h2>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                            gap: '20px'
                        }}>
                            {links
                                .filter(link => link.category === category)
                                .map((link, index) => {
                                    const Icon = link.icon;
                                    const isExternal = link.url.startsWith('http');

                                    return (
                                        <a
                                            key={index}
                                            href={link.url}
                                            target={isExternal ? '_blank' : '_self'}
                                            rel={isExternal ? 'noopener noreferrer' : undefined}
                                            className="glass-card"
                                            style={{
                                                padding: '24px',
                                                textDecoration: 'none',
                                                color: 'inherit',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '16px',
                                                transition: 'all 0.2s ease',
                                                cursor: 'pointer',
                                                position: 'relative',
                                                overflow: 'hidden'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = 'translateY(-4px)';
                                                e.currentTarget.style.borderColor = 'var(--accent)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = 'translateY(0)';
                                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                                                <div style={{
                                                    padding: '12px',
                                                    borderRadius: '8px',
                                                    background: 'rgba(0,112,243,0.1)',
                                                    flexShrink: 0
                                                }}>
                                                    <Icon size={24} color="var(--accent)" />
                                                </div>

                                                <div style={{ flex: 1 }}>
                                                    <div style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        marginBottom: '8px'
                                                    }}>
                                                        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
                                                            {link.title}
                                                        </h3>
                                                        {isExternal && (
                                                            <ExternalLink size={14} style={{ opacity: 0.5 }} />
                                                        )}
                                                    </div>

                                                    <p style={{
                                                        fontSize: '0.9rem',
                                                        opacity: 0.7,
                                                        lineHeight: '1.5',
                                                        margin: 0
                                                    }}>
                                                        {link.description}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Hover Effect */}
                                            <div style={{
                                                position: 'absolute',
                                                bottom: 0,
                                                left: 0,
                                                right: 0,
                                                height: '2px',
                                                background: 'linear-gradient(90deg, var(--accent), #00d2ff)',
                                                transform: 'scaleX(0)',
                                                transition: 'transform 0.3s ease',
                                                transformOrigin: 'left'
                                            }}
                                                className="link-hover-bar"
                                            />
                                        </a>
                                    );
                                })}
                        </div>
                    </section>
                ))}
            </div>

            <style jsx>{`
                a:hover .link-hover-bar {
                    transform: scaleX(1);
                }
            `}</style>
        </div>
    );
}
