'use client';

import { useState, useEffect } from 'react';
import {
    Users,
    Plus,
    Trash2,
    Edit2,
    Loader2,
    CheckCircle2,
    XCircle,
    X,
    UserPlus,
    UserMinus
} from 'lucide-react';

interface RaterGroup {
    id: string;
    name: string;
    description: string | null;
    projectId: string;
    createdAt: string;
    _count: {
        members: number;
        assignments: number;
    };
    members: {
        id: string;
        userId: string;
        joinedAt: string;
        user: {
            id: string;
            email: string;
        };
    }[];
}

interface Project {
    id: string;
    name: string;
}

interface User {
    id: string;
    email: string;
    role: string;
}

export default function RaterGroupsPage() {
    const [groups, setGroups] = useState<RaterGroup[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    // Modal state
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [editingGroup, setEditingGroup] = useState<RaterGroup | null>(null);
    const [showMemberModal, setShowMemberModal] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState<RaterGroup | null>(null);

    // Form state
    const [formData, setFormData] = useState({ name: '', description: '' });
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchProjects();
        fetchUsers();
    }, []);

    useEffect(() => {
        if (selectedProjectId) {
            fetchGroups();
        } else {
            setGroups([]);
        }
    }, [selectedProjectId]);

    const fetchProjects = async () => {
        try {
            const res = await fetch('/api/projects');
            if (res.ok) {
                const data = await res.json();
                // Handle both wrapped { projects: [] } and direct array formats
                const projectList = Array.isArray(data) ? data : (data.projects || []);
                setProjects(projectList);
                if (projectList.length > 0) {
                    setSelectedProjectId(projectList[0].id);
                }
            }
        } catch (error) {
            console.error('Error fetching projects:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/admin/users');
            if (res.ok) {
                const data = await res.json();
                setUsers(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    const fetchGroups = async () => {
        try {
            const res = await fetch(`/api/rater-groups?projectId=${selectedProjectId}`);
            if (res.ok) {
                const data = await res.json();
                setGroups(data.groups || []);
            }
        } catch (error) {
            console.error('Error fetching groups:', error);
        }
    };

    const handleSaveGroup = async () => {
        if (!formData.name.trim()) return;
        setSaving(true);
        try {
            const url = editingGroup
                ? `/api/rater-groups/${editingGroup.id}`
                : '/api/rater-groups';
            const method = editingGroup ? 'PATCH' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: selectedProjectId,
                    name: formData.name,
                    description: formData.description
                })
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to save');
            }

            setStatus({ type: 'success', message: editingGroup ? 'Group updated' : 'Group created' });
            setShowGroupModal(false);
            setEditingGroup(null);
            setFormData({ name: '', description: '' });
            fetchGroups();
        } catch (error: any) {
            setStatus({ type: 'error', message: error.message });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteGroup = async (group: RaterGroup) => {
        if (!confirm(`Delete "${group.name}"? This cannot be undone.`)) return;
        try {
            const res = await fetch(`/api/rater-groups/${group.id}`, { method: 'DELETE' });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to delete');
            }
            setStatus({ type: 'success', message: 'Group deleted' });
            fetchGroups();
        } catch (error: any) {
            setStatus({ type: 'error', message: error.message });
        }
    };

    const handleAddMembers = async () => {
        if (!selectedGroup || selectedUserIds.length === 0) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/rater-groups/${selectedGroup.id}/members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userIds: selectedUserIds })
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to add members');
            }

            const data = await res.json();
            setStatus({ type: 'success', message: `Added ${data.added} member(s)` });
            setShowMemberModal(false);
            setSelectedUserIds([]);
            fetchGroups();
        } catch (error: any) {
            setStatus({ type: 'error', message: error.message });
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveMember = async (group: RaterGroup, userId: string) => {
        const member = group.members.find(m => m.userId === userId);
        if (!confirm(`Remove ${member?.user.email} from ${group.name}?`)) return;

        try {
            const res = await fetch(`/api/rater-groups/${group.id}/members/${userId}`, {
                method: 'DELETE'
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to remove member');
            }

            setStatus({ type: 'success', message: 'Member removed' });
            fetchGroups();
        } catch (error: any) {
            setStatus({ type: 'error', message: error.message });
        }
    };

    const openEditModal = (group: RaterGroup) => {
        setEditingGroup(group);
        setFormData({ name: group.name, description: group.description || '' });
        setShowGroupModal(true);
    };

    const openMemberModal = (group: RaterGroup) => {
        setSelectedGroup(group);
        setSelectedUserIds([]);
        setShowMemberModal(true);
    };

    const getAvailableUsers = () => {
        if (!selectedGroup) return users;
        const memberIds = new Set(selectedGroup.members.map(m => m.userId));
        return users.filter(u => !memberIds.has(u.id));
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
                <Loader2 className="animate-spin" size={48} color="var(--accent)" />
            </div>
        );
    }

    return (
        <div>
            <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 className="premium-gradient" style={{ fontSize: '2rem', marginBottom: '8px' }}>
                        Rater Groups
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.6)' }}>
                        Organize raters into teams for assignment distribution
                    </p>
                </div>
                <button
                    onClick={() => { setFormData({ name: '', description: '' }); setEditingGroup(null); setShowGroupModal(true); }}
                    disabled={!selectedProjectId}
                    className="btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <Plus size={20} />
                    New Group
                </button>
            </header>

            {status && (
                <div className="glass-card" style={{
                    padding: '16px 24px',
                    marginBottom: '24px',
                    border: `1px solid ${status.type === 'success' ? 'var(--success)' : '#ff4d4d'}`,
                    background: `${status.type === 'success' ? 'rgba(0,255,136,0.05)' : 'rgba(255,77,77,0.05)'}`,
                    color: status.type === 'success' ? '#00ff88' : '#ff4d4d',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    {status.type === 'success' ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                    {status.message}
                </div>
            )}

            {/* Project Selection */}
            <div className="glass-card" style={{ padding: '20px', marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Select Project</label>
                <select
                    value={selectedProjectId}
                    onChange={e => setSelectedProjectId(e.target.value)}
                    className="input-field"
                    style={{ maxWidth: '400px' }}
                >
                    <option value="">-- Select a project --</option>
                    {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
            </div>

            {/* Groups List */}
            {!selectedProjectId ? (
                <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
                    <Users size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                    <p style={{ opacity: 0.6 }}>Select a project to view rater groups</p>
                </div>
            ) : groups.length === 0 ? (
                <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
                    <Users size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                    <p style={{ opacity: 0.6, marginBottom: '16px' }}>No rater groups yet</p>
                    <button onClick={() => setShowGroupModal(true)} className="btn-primary">
                        Create Your First Group
                    </button>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '16px' }}>
                    {groups.map(group => (
                        <div key={group.id} className="glass-card" style={{ padding: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>{group.name}</h3>
                                    {group.description && (
                                        <p style={{ opacity: 0.6, fontSize: '0.9rem', marginBottom: '12px' }}>
                                            {group.description}
                                        </p>
                                    )}
                                    <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', opacity: 0.6 }}>
                                        <span>{group._count.members} member(s)</span>
                                        <span>{group._count.assignments} assignment(s)</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        onClick={() => openMemberModal(group)}
                                        className="btn-secondary"
                                        style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        <UserPlus size={16} />
                                        Add Members
                                    </button>
                                    <button
                                        onClick={() => openEditModal(group)}
                                        className="btn-secondary"
                                        style={{ padding: '8px 12px' }}
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteGroup(group)}
                                        className="btn-secondary"
                                        style={{ padding: '8px 12px', color: '#ff4d4d' }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Members List */}
                            {group.members.length > 0 && (
                                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ fontSize: '0.8rem', opacity: 0.5, marginBottom: '8px' }}>Members</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {group.members.map(member => (
                                            <div
                                                key={member.id}
                                                style={{
                                                    padding: '6px 12px',
                                                    borderRadius: '6px',
                                                    background: 'rgba(255,255,255,0.05)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    fontSize: '0.85rem'
                                                }}
                                            >
                                                {member.user.email}
                                                <button
                                                    onClick={() => handleRemoveMember(group, member.userId)}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        color: '#ff4d4d',
                                                        cursor: 'pointer',
                                                        padding: '2px'
                                                    }}
                                                >
                                                    <UserMinus size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Create/Edit Group Modal */}
            {showGroupModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.8)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div className="glass-card" style={{ width: '100%', maxWidth: '500px', padding: '32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '1.4rem', margin: 0 }}>
                                {editingGroup ? 'Edit Group' : 'New Group'}
                            </h2>
                            <button
                                onClick={() => { setShowGroupModal(false); setEditingGroup(null); }}
                                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Group Name</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g., Team Alpha"
                                    className="input-field"
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Description (optional)</label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Describe the group's purpose..."
                                    className="input-field"
                                    rows={3}
                                    style={{ resize: 'vertical' }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                                <button
                                    onClick={() => { setShowGroupModal(false); setEditingGroup(null); }}
                                    className="btn-secondary"
                                    style={{ flex: 1, padding: '14px' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveGroup}
                                    disabled={saving || !formData.name.trim()}
                                    className="btn-primary"
                                    style={{ flex: 1, padding: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                                >
                                    {saving ? <Loader2 className="animate-spin" size={20} /> : null}
                                    {editingGroup ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Members Modal */}
            {showMemberModal && selectedGroup && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.8)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div className="glass-card" style={{ width: '100%', maxWidth: '500px', padding: '32px', maxHeight: '80vh', overflow: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '1.4rem', margin: 0 }}>
                                Add Members to {selectedGroup.name}
                            </h2>
                            <button
                                onClick={() => { setShowMemberModal(false); setSelectedGroup(null); }}
                                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                                Select Users ({selectedUserIds.length} selected)
                            </label>
                            <div style={{ maxHeight: '300px', overflow: 'auto', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}>
                                {getAvailableUsers().length === 0 ? (
                                    <div style={{ padding: '24px', textAlign: 'center', opacity: 0.5 }}>
                                        All users are already members
                                    </div>
                                ) : (
                                    getAvailableUsers().map(user => (
                                        <label
                                            key={user.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px',
                                                padding: '12px 16px',
                                                cursor: 'pointer',
                                                borderBottom: '1px solid rgba(255,255,255,0.05)'
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedUserIds.includes(user.id)}
                                                onChange={e => {
                                                    if (e.target.checked) {
                                                        setSelectedUserIds([...selectedUserIds, user.id]);
                                                    } else {
                                                        setSelectedUserIds(selectedUserIds.filter(id => id !== user.id));
                                                    }
                                                }}
                                                style={{ width: '18px', height: '18px' }}
                                            />
                                            <div>
                                                <div>{user.email}</div>
                                                <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{user.role}</div>
                                            </div>
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => { setShowMemberModal(false); setSelectedGroup(null); }}
                                className="btn-secondary"
                                style={{ flex: 1, padding: '14px' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddMembers}
                                disabled={saving || selectedUserIds.length === 0}
                                className="btn-primary"
                                style={{ flex: 1, padding: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                            >
                                {saving ? <Loader2 className="animate-spin" size={20} /> : <UserPlus size={20} />}
                                Add {selectedUserIds.length} Member(s)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
