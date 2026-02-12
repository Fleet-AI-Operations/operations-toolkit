
'use client';

import { useState, useEffect } from 'react';
import { Shield, User as UserIcon, Loader2, UserPlus, KeyRound } from 'lucide-react';

interface Profile {
    id: string;
    email: string;
    role: 'USER' | 'QA' | 'CORE' | 'FLEET' | 'MANAGER' | 'ADMIN';
    mustResetPassword?: boolean;
    createdAt: string;
}

export default function UserManagementPage() {
    const [users, setUsers] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [actioningId, setActioningId] = useState<string | null>(null);

    // Create User Form State
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRole, setNewRole] = useState('USER');
    const [isCreating, setIsCreating] = useState(false);

    // Password Reset State
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetUserId, setResetUserId] = useState<string | null>(null);
    const [resetUserEmail, setResetUserEmail] = useState<string>('');
    const [resetPassword, setResetPassword] = useState('');
    const [resetConfirmPassword, setResetConfirmPassword] = useState('');
    const [isResetting, setIsResetting] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/admin/users');
            const data = await res.json();
            if (Array.isArray(data)) {
                setUsers(data);
            }
        } catch (err) {
            console.error('Failed to fetch users', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUser = async (e: any) => {
        e.preventDefault();
        setIsCreating(true);
        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: newEmail, password: newPassword, role: newRole })
            });

            if (res.ok) {
                const newUser = await res.json();
                setUsers([newUser, ...users]);
                setShowCreateForm(false);
                setNewEmail('');
                setNewPassword('');
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to create user');
            }
        } catch (err) {
            console.error('Create user error:', err);
        } finally {
            setIsCreating(false);
        }
    };

    const updateRole = async (userId: string, newRole: string) => {
        setActioningId(userId);
        try {
            const res = await fetch('/api/admin/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, role: newRole })
            });
            if (res.ok) {
                setUsers(users.map(u => u.id === userId ? { ...u, role: newRole as any } : u));
            }
        } catch (err) {
            console.error('Failed to update role', err);
        } finally {
            setActioningId(null);
        }
    };

    const openResetModal = (user: Profile) => {
        setResetUserId(user.id);
        setResetUserEmail(user.email);
        setResetPassword('');
        setResetConfirmPassword('');
        setShowResetModal(true);
    };

    const handleResetPassword = async (e: any) => {
        e.preventDefault();

        if (resetPassword !== resetConfirmPassword) {
            alert('Passwords do not match');
            return;
        }

        if (resetPassword.length < 8) {
            alert('Password must be at least 8 characters long');
            return;
        }

        setIsResetting(true);
        try {
            const res = await fetch('/api/admin/users/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: resetUserId, password: resetPassword })
            });

            if (res.ok) {
                const data = await res.json();
                setUsers(users.map(u => u.id === resetUserId ? { ...u, mustResetPassword: true } : u));
                setShowResetModal(false);
                alert(`Password reset for ${resetUserEmail}. They will be required to change it on next login.`);
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to reset password');
            }
        } catch (err) {
            console.error('Reset password error:', err);
            alert('Failed to reset password');
        } finally {
            setIsResetting(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <Loader2 className="animate-spin" size={48} color="var(--accent)" />
            </div>
        );
    }

    return (
        <div>
            <header style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                        <h1 className="premium-gradient" style={{ fontSize: '2rem', marginBottom: '8px' }}>User Management</h1>
                        <p style={{ color: 'rgba(255,255,255,0.6)' }}>Create new users and manage roles and permissions.</p>
                    </div>
                    <button
                        onClick={() => setShowCreateForm(!showCreateForm)}
                        className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px' }}
                    >
                        <UserPlus size={18} /> {showCreateForm ? 'Cancel' : 'Add New User'}
                    </button>
                </div>
            </header>

            {/* Role Descriptions */}
            <div className="glass-card" style={{ padding: '24px', marginBottom: '32px', background: 'rgba(0,112,243,0.03)' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--accent)' }}>
                    Role Permissions
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                    <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px', color: '#00ff88' }}>
                            USER
                        </div>
                        <div style={{ fontSize: '0.85rem', opacity: 0.7, lineHeight: '1.5' }}>
                            Standard access to view and interact with projects. Can access main features but cannot manage users.
                        </div>
                    </div>
                    <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px', color: '#ffab00' }}>
                            QA
                        </div>
                        <div style={{ fontSize: '0.85rem', opacity: 0.7, lineHeight: '1.5' }}>
                            Quality Assurance tools including records, analysis, and similarity search.
                        </div>
                    </div>
                    <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px', color: '#00d2ff' }}>
                            CORE
                        </div>
                        <div style={{ fontSize: '0.85rem', opacity: 0.7, lineHeight: '1.5' }}>
                            Core team features including Likert scoring and review decisions.
                        </div>
                    </div>
                    <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px', color: '#9c27b0' }}>
                            FLEET
                        </div>
                        <div style={{ fontSize: '0.85rem', opacity: 0.7, lineHeight: '1.5' }}>
                            Fleet management including ingestion, analytics, projects, and bonus windows.
                        </div>
                    </div>
                    <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px', color: '#2196f3' }}>
                            MANAGER (Legacy)
                        </div>
                        <div style={{ fontSize: '0.85rem', opacity: 0.7, lineHeight: '1.5' }}>
                            Same permissions as FLEET. Kept for backward compatibility.
                        </div>
                    </div>
                    <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px', color: '#ff4d4d' }}>
                            ADMIN
                        </div>
                        <div style={{ fontSize: '0.85rem', opacity: 0.7, lineHeight: '1.5' }}>
                            Full system access including user management, role assignment, and system configuration.
                        </div>
                    </div>
                </div>
            </div>

            <main style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
                {/* Create User Form */}
                {showCreateForm && (
                    <section className="glass-card" style={{ padding: '32px', border: '1px solid var(--accent)' }}>
                        <h2 style={{ fontSize: '1.25rem', marginBottom: '24px' }}>Create New User</h2>
                        <form onSubmit={handleCreateUser} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '20px', alignItems: 'flex-end' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>Email Address</label>
                                <input
                                    type="email"
                                    required
                                    className="input-field"
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    placeholder="user@example.com"
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>Initial Password</label>
                                <input
                                    type="password"
                                    required
                                    className="input-field"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="••••••••"
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>Role</label>
                                <select
                                    className="input-field"
                                    value={newRole}
                                    onChange={(e) => setNewRole(e.target.value)}
                                    style={{ padding: '10px' }}
                                >
                                    <option value="USER">User</option>
                                    <option value="QA">QA</option>
                                    <option value="CORE">Core</option>
                                    <option value="FLEET">Fleet</option>
                                    <option value="MANAGER">Manager (Legacy)</option>
                                    <option value="ADMIN">Admin</option>
                                </select>
                            </div>
                            <div style={{ gridColumn: 'span 3', display: 'flex', justifyContent: 'flex-end' }}>
                                <button type="submit" className="btn-primary" disabled={isCreating} style={{ padding: '12px 32px' }}>
                                    {isCreating ? <Loader2 className="animate-spin" size={20} /> : 'Create User & Require Password Reset'}
                                </button>
                            </div>
                        </form>
                    </section>
                )}

                {/* All Users Section */}
                <section>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                        <div style={{ padding: '8px', background: 'rgba(0, 112, 243, 0.1)', borderRadius: '8px' }}>
                            <Shield size={20} color="var(--accent)" />
                        </div>
                        <h2 style={{ fontSize: '1.25rem' }}>All Users ({users.length})</h2>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {users.map(user => (
                            <UserRow
                                key={user.id}
                                user={user}
                                onRoleChange={(role) => updateRole(user.id, role)}
                                onResetPassword={() => openResetModal(user)}
                                isActioning={actioningId === user.id}
                            />
                        ))}
                    </div>
                </section>
            </main>

            {/* Password Reset Modal */}
            {showResetModal && (
                <div
                    onClick={() => setShowResetModal(false)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.7)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 1000,
                        backdropFilter: 'blur(4px)'
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="glass-card"
                        style={{
                            width: '100%',
                            maxWidth: '500px',
                            padding: '32px',
                            border: '1px solid var(--accent)',
                            margin: '20px'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                            <div style={{ padding: '8px', background: 'rgba(0, 112, 243, 0.1)', borderRadius: '8px' }}>
                                <KeyRound size={24} color="var(--accent)" />
                            </div>
                            <h2 style={{ fontSize: '1.5rem' }}>Reset Password</h2>
                        </div>

                        <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '24px' }}>
                            Set a new password for <strong>{resetUserEmail}</strong>. They will be required to change it on their next login.
                        </p>

                        <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>New Password</label>
                                <input
                                    type="password"
                                    required
                                    className="input-field"
                                    value={resetPassword}
                                    onChange={(e) => setResetPassword(e.target.value)}
                                    placeholder="At least 8 characters"
                                    autoFocus
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>Confirm Password</label>
                                <input
                                    type="password"
                                    required
                                    className="input-field"
                                    value={resetConfirmPassword}
                                    onChange={(e) => setResetConfirmPassword(e.target.value)}
                                    placeholder="Must match"
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowResetModal(false)}
                                    disabled={isResetting}
                                    style={{
                                        padding: '10px 24px',
                                        background: 'rgba(255,255,255,0.05)',
                                        color: 'white',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontSize: '0.9rem',
                                        fontWeight: '500'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isResetting}
                                    className="btn-primary"
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px' }}
                                >
                                    {isResetting ? <Loader2 className="animate-spin" size={20} /> : 'Reset Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

function UserRow({ user, onRoleChange, onResetPassword, isActioning }: {
    user: Profile,
    onRoleChange?: (role: string) => void,
    onResetPassword?: () => void,
    isActioning: boolean
}) {
    return (
        <div className="glass-card" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 24px',
            opacity: isActioning ? 0.6 : 1
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.05)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    border: '1px solid rgba(255,255,255,0.1)'
                }}>
                    <UserIcon size={20} color="rgba(255,255,255,0.6)" />
                </div>
                <div>
                    <div style={{ fontWeight: 600, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {user.email}
                        {user.mustResetPassword && (
                            <span style={{
                                fontSize: '0.7rem',
                                color: '#ffab00',
                                background: 'rgba(255, 171, 0, 0.1)',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontWeight: '500'
                            }}>
                                Must Reset Password
                            </span>
                        )}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>
                        Joined {new Date(user.createdAt).toLocaleDateString()}
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                    onClick={onResetPassword}
                    disabled={isActioning}
                    style={{
                        padding: '8px 12px',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(255,255,255,0.05)',
                        color: 'white',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                    }}
                    title="Reset user password"
                >
                    <KeyRound size={16} />
                    Reset Password
                </button>
                <select
                    value={user.role}
                    onChange={(e) => onRoleChange?.(e.target.value)}
                    disabled={isActioning}
                    style={{
                        background: 'rgba(255,255,255,0.05)',
                        color: 'white',
                        border: '1px solid rgba(255,255,255,0.1)',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        outline: 'none',
                        cursor: 'pointer'
                    }}
                >
                    <option value="USER">User</option>
                    <option value="QA">QA</option>
                    <option value="CORE">Core</option>
                    <option value="FLEET">Fleet</option>
                    <option value="MANAGER">Manager (Legacy)</option>
                    <option value="ADMIN">Admin</option>
                </select>
            </div>
        </div>
    );
}
