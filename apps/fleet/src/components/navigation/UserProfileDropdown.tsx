'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Lock, LogOut, User } from 'lucide-react';
import { signOut } from '@/app/api/auth/actions';
import ChangePasswordModal from '../auth/ChangePasswordModal';

interface UserProfileDropdownProps {
    email: string;
    role: string;
}

export default function UserProfileDropdown({ email, role }: UserProfileDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                data-testid="user-profile-dropdown-trigger"
                style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px', 
                    padding: '8px 12px',
                    borderRadius: '12px',
                    background: isOpen ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                    transition: 'all 0.2s',
                    textAlign: 'right'
                }}
                className="hover-bright"
            >
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 500 }}>
                        {email}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {role}
                    </div>
                </div>
                <ChevronDown size={16} style={{ 
                    color: 'rgba(255, 255, 255, 0.3)',
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s'
                }} />
            </button>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: '220px',
                    background: 'rgba(15, 15, 25, 0.95)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '16px',
                    padding: '8px',
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
                    zIndex: 100,
                    animation: 'dropdownFade 0.2s ease-out'
                }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', marginBottom: '4px' }}>
                        <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Account</div>
                    </div>
                    
                    <button 
                        onClick={() => {
                            setIsModalOpen(true);
                            setIsOpen(false);
                        }}
                        data-testid="change-password-dropdown-item"
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px 16px',
                            borderRadius: '10px',
                            color: 'rgba(255, 255, 255, 0.8)',
                            fontSize: '0.9rem',
                            textAlign: 'left',
                            background: 'transparent',
                            transition: 'all 0.2s'
                        }}
                        className="hover-subtle"
                    >
                        <Lock size={16} style={{ color: 'var(--accent)' }} />
                        Change Password
                    </button>

                    <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.05)', margin: '4px 0' }}></div>

                    <form action={signOut}>
                        <button 
                            type="submit"
                            data-testid="logout-button"
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '10px 16px',
                                borderRadius: '10px',
                                color: '#ff4444',
                                fontSize: '0.9rem',
                                textAlign: 'left',
                                background: 'transparent',
                                transition: 'all 0.2s'
                            }}
                            className="hover-error-subtle"
                        >
                            <LogOut size={16} />
                            Sign Out
                        </button>
                    </form>
                </div>
            )}

            <ChangePasswordModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
            />

            
        </div>
    );
}
