'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Users, Plus, Trash2, Edit2, Loader2, CheckCircle2, XCircle,
    X, UserPlus, UserMinus, ShieldAlert, Award
} from 'lucide-react';

interface UserProfile {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
}

interface QAUser {
    email: string;
    name: string | null;
}

interface PodMember {
    id: string;
    qaEmail: string;
    qaName: string | null;
}

interface Pod {
    id: string;
    name: string;
    coreLeader: UserProfile;
    members: PodMember[];
}

function displayName(u: UserProfile): string {
    if (u.firstName || u.lastName) return [u.firstName, u.lastName].filter(Boolean).join(' ');
    return u.email;
}

function memberDisplayName(m: PodMember): string {
    return m.qaName ?? m.qaEmail;
}

export default function MentorshipConfigPage() {
    const router = useRouter();
    const [pods, setPods] = useState<Pod[]>([]);
    const [coreUsers, setCoreUsers] = useState<UserProfile[]>([]);
    const [qaUsers, setQaUsers] = useState<QAUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [saving, setSaving] = useState(false);

    // Pod modal state
    const [showPodModal, setShowPodModal] = useState(false);
    const [editingPod, setEditingPod] = useState<Pod | null>(null);
    const [podForm, setPodForm] = useState({ name: '', coreLeaderId: '' });

    // Member modal state
    const [showMemberModal, setShowMemberModal] = useState(false);
    const [memberTargetPod, setMemberTargetPod] = useState<Pod | null>(null);
    const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
    const [memberSearch, setMemberSearch] = useState('');

    useEffect(() => {
        loadAll();
    }, []);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [podsRes, coreRes, qaRes] = await Promise.all([
                fetch('/api/mentorship/pods'),
                fetch('/api/mentorship/users?minRole=CORE&maxRole=FLEET'),
                fetch('/api/mentorship/users?source=feedback_records'),
            ]);

            if (podsRes.status === 401) { router.push('/login'); return; }
            if (podsRes.status === 403 || coreRes.status === 403 || qaRes.status === 403) {
                setAuthorized(false);
                setLoading(false);
                return;
            }

            const [podsData, coreData, qaData] = await Promise.all([
                podsRes.json(), coreRes.json(), qaRes.json()
            ]);

            if (!podsRes.ok) throw new Error(podsData.error ?? 'Failed to load pods.');
            if (!coreRes.ok) throw new Error(coreData.error ?? 'Failed to load leaders.');
            if (!qaRes.ok) throw new Error(qaData.error ?? 'Failed to load QA members.');

            setPods(podsData.pods ?? []);
            setCoreUsers(coreData.users ?? []);
            setQaUsers(qaData.users ?? []);
            setAuthorized(true);
        } catch (err: any) {
            setStatus({ type: 'error', message: err.message ?? 'Failed to load configuration data.' });
        } finally {
            setLoading(false);
        }
    };

    const showStatus = (type: 'success' | 'error', message: string) => {
        setStatus({ type, message });
        setTimeout(() => setStatus(null), 4000);
    };

    // --- Pod CRUD ---
    const openCreatePod = () => {
        setEditingPod(null);
        setPodForm({ name: '', coreLeaderId: '' });
        setShowPodModal(true);
    };

    const openEditPod = (pod: Pod) => {
        setEditingPod(pod);
        setPodForm({ name: pod.name, coreLeaderId: pod.coreLeader.id });
        setShowPodModal(true);
    };

    const handleSavePod = async () => {
        if (!podForm.name.trim() || !podForm.coreLeaderId) return;
        setSaving(true);
        try {
            const url = editingPod ? `/api/mentorship/pods/${editingPod.id}` : '/api/mentorship/pods';
            const method = editingPod ? 'PATCH' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: podForm.name, coreLeaderId: podForm.coreLeaderId })
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || 'Failed to save pod.');
            }

            showStatus('success', editingPod ? 'Pod updated.' : 'Pod created.');
            setShowPodModal(false);
            await loadAll();
        } catch (err: any) {
            showStatus('error', err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDeletePod = async (pod: Pod) => {
        if (!confirm(`Delete pod "${pod.name}"? This cannot be undone.`)) return;
        try {
            const res = await fetch(`/api/mentorship/pods/${pod.id}`, { method: 'DELETE' });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || 'Failed to delete pod.');
            }
            showStatus('success', `Pod "${pod.name}" deleted.`);
            await loadAll();
        } catch (err: any) {
            showStatus('error', err.message);
        }
    };

    // --- Member management ---
    const openAddMembers = (pod: Pod) => {
        setMemberTargetPod(pod);
        setSelectedEmails([]);
        setMemberSearch('');
        setShowMemberModal(true);
    };

    const handleAddMembers = async () => {
        if (!memberTargetPod || selectedEmails.length === 0) return;
        setSaving(true);
        try {
            const members = selectedEmails.map(email => {
                const u = qaUsers.find(q => q.email === email);
                return { qaEmail: email, qaName: u?.name ?? null };
            });
            const res = await fetch(`/api/mentorship/pods/${memberTargetPod.id}/members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ members })
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || 'Failed to add members.');
            }

            const data = await res.json();
            showStatus('success', `Added ${data.added} member(s).`);
            setShowMemberModal(false);
            await loadAll();
        } catch (err: any) {
            showStatus('error', err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveMember = async (pod: Pod, member: PodMember) => {
        if (!confirm(`Remove ${memberDisplayName(member)} from "${pod.name}"?`)) return;
        try {
            const res = await fetch(`/api/mentorship/pods/${pod.id}/members/${member.id}`, { method: 'DELETE' });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || 'Failed to remove member.');
            }
            showStatus('success', 'Member removed.');
            await loadAll();
        } catch (err: any) {
            showStatus('error', err.message);
        }
    };

    const availableQaUsers = (pod: Pod) => {
        const memberEmails = new Set(pod.members.map(m => m.qaEmail.toLowerCase()));
        return qaUsers.filter(u => !memberEmails.has(u.email.toLowerCase()));
    };

    // --- Render states ---
    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <Loader2 className="animate-spin" size={48} color="var(--accent)" />
            </div>
        );
    }

    if (!authorized) {
        return (
            <div style={{
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
                alignItems: 'center', minHeight: '60vh', textAlign: 'center'
            }}>
                <div style={{ padding: '16px', background: 'rgba(255,77,77,0.1)', borderRadius: '16px', marginBottom: '24px' }}>
                    <ShieldAlert size={64} color="#ff4d4d" />
                </div>
                <h1 style={{ fontSize: '2rem', marginBottom: '16px' }}>Access Denied</h1>
                <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '24px' }}>
                    This page requires FLEET role or higher.
                </p>
                <button onClick={() => router.push('/')} className="btn-primary" style={{ padding: '12px 32px' }}>
                    Return to Dashboard
                </button>
            </div>
        );
    }

    return (
        <div style={{ padding: '40px', minHeight: 'calc(100vh - 73px)' }}>
            <div style={{ maxWidth: '1000px', margin: '0 auto' }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
                    <div>
                        <h1 className="premium-gradient" style={{ fontSize: '2.5rem', marginBottom: '8px' }}>
                            Pod Configuration
                        </h1>
                        <p style={{ color: 'rgba(255,255,255,0.6)' }}>
                            Manage mentorship pods — one CORE or FLEET leader, multiple QA members
                        </p>
                    </div>
                    <button
                        onClick={openCreatePod}
                        className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
                    >
                        <Plus size={18} />
                        New Pod
                    </button>
                </div>

                {/* Status banner */}
                {status && (
                    <div style={{
                        padding: '14px 20px',
                        marginBottom: '24px',
                        borderRadius: '10px',
                        border: `1px solid ${status.type === 'success' ? 'rgba(0,255,136,0.3)' : 'rgba(255,77,77,0.3)'}`,
                        background: status.type === 'success' ? 'rgba(0,255,136,0.06)' : 'rgba(255,77,77,0.06)',
                        color: status.type === 'success' ? '#00ff88' : '#ff4d4d',
                        display: 'flex', alignItems: 'center', gap: '10px'
                    }}>
                        {status.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                        {status.message}
                    </div>
                )}

                {/* Empty state */}
                {pods.length === 0 && (
                    <div className="glass-card" style={{
                        padding: '64px 32px', textAlign: 'center',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px'
                    }}>
                        <div style={{ padding: '16px', background: 'rgba(0,112,243,0.1)', borderRadius: '16px' }}>
                            <Users size={48} color="var(--accent)" />
                        </div>
                        <h2 style={{ fontSize: '1.5rem' }}>No pods yet</h2>
                        <p style={{ color: 'rgba(255,255,255,0.5)', maxWidth: '360px' }}>
                            Create your first mentorship pod by clicking "New Pod" above.
                        </p>
                    </div>
                )}

                {/* Pod list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {pods.map(pod => (
                        <div key={pod.id} className="glass-card" style={{ padding: '24px' }}>
                            {/* Pod header row */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                <div>
                                    <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '4px' }}>{pod.name}</h2>
                                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>
                                        {pod.members.length} QA member{pod.members.length !== 1 ? 's' : ''}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        onClick={() => openAddMembers(pod)}
                                        style={{
                                            padding: '7px 14px',
                                            background: 'rgba(0,112,243,0.1)',
                                            border: '1px solid rgba(0,112,243,0.3)',
                                            borderRadius: '6px',
                                            color: 'var(--accent)',
                                            cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            fontSize: '0.85rem'
                                        }}
                                    >
                                        <UserPlus size={15} />
                                        Add Members
                                    </button>
                                    <button
                                        onClick={() => openEditPod(pod)}
                                        style={{
                                            padding: '7px 10px',
                                            background: 'rgba(255,255,255,0.05)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '6px',
                                            color: 'rgba(255,255,255,0.7)',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <Edit2 size={15} />
                                    </button>
                                    <button
                                        onClick={() => handleDeletePod(pod)}
                                        style={{
                                            padding: '7px 10px',
                                            background: 'rgba(255,77,77,0.08)',
                                            border: '1px solid rgba(255,77,77,0.2)',
                                            borderRadius: '6px',
                                            color: '#ff4d4d',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </div>

                            {/* Core leader */}
                            <div style={{
                                padding: '10px 14px',
                                background: 'rgba(0,112,243,0.06)',
                                border: '1px solid rgba(0,112,243,0.15)',
                                borderRadius: '8px',
                                display: 'flex', alignItems: 'center', gap: '10px',
                                marginBottom: pod.members.length > 0 ? '12px' : '0'
                            }}>
                                <Award size={16} color="var(--accent)" />
                                <div>
                                    <span style={{ fontSize: '0.7rem', color: 'rgba(0,112,243,0.8)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '8px' }}>
                                        Lead
                                    </span>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{displayName(pod.coreLeader)}</span>
                                    <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginLeft: '8px' }}>{pod.coreLeader.email}</span>
                                </div>
                            </div>

                            {/* QA members */}
                            {pod.members.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {pod.members.map(member => (
                                        <div
                                            key={member.id}
                                            style={{
                                                padding: '5px 10px 5px 12px',
                                                background: 'rgba(255,255,255,0.04)',
                                                border: '1px solid rgba(255,255,255,0.08)',
                                                borderRadius: '20px',
                                                display: 'flex', alignItems: 'center', gap: '8px',
                                                fontSize: '0.85rem'
                                            }}
                                        >
                                            <span>{memberDisplayName(member)}</span>
                                            <button
                                                onClick={() => handleRemoveMember(pod, member)}
                                                style={{
                                                    background: 'none', border: 'none',
                                                    color: 'rgba(255,77,77,0.7)', cursor: 'pointer',
                                                    padding: '2px', display: 'flex', alignItems: 'center'
                                                }}
                                                title={`Remove ${memberDisplayName(member)}`}
                                            >
                                                <UserMinus size={13} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Create / Edit Pod Modal */}
            {showPodModal && (
                <Modal onClose={() => setShowPodModal(false)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h2 style={{ fontSize: '1.4rem', margin: 0 }}>
                            {editingPod ? 'Edit Pod' : 'New Pod'}
                        </h2>
                        <CloseButton onClick={() => setShowPodModal(false)} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, fontSize: '0.9rem' }}>Pod Name</label>
                            <input
                                type="text"
                                value={podForm.name}
                                onChange={e => setPodForm({ ...podForm, name: e.target.value })}
                                placeholder="e.g., Pod Alpha"
                                className="input-field"
                                autoFocus
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, fontSize: '0.9rem' }}>Pod Leader (CORE or FLEET)</label>
                            {coreUsers.length === 0 ? (
                                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
                                    No users with CORE or FLEET role found.
                                </p>
                            ) : (
                                <select
                                    value={podForm.coreLeaderId}
                                    onChange={e => setPodForm({ ...podForm, coreLeaderId: e.target.value })}
                                    className="input-field"
                                >
                                    <option value="">— Select a leader —</option>
                                    {coreUsers.map(u => (
                                        <option key={u.id} value={u.id}>
                                            {displayName(u)} ({u.email})
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                            <button
                                onClick={() => setShowPodModal(false)}
                                style={{
                                    flex: 1, padding: '12px',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px', color: 'rgba(255,255,255,0.7)',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSavePod}
                                disabled={saving || !podForm.name.trim() || !podForm.coreLeaderId}
                                className="btn-primary"
                                style={{ flex: 1, padding: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                            >
                                {saving && <Loader2 className="animate-spin" size={18} />}
                                {editingPod ? 'Update Pod' : 'Create Pod'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Add Members Modal */}
            {showMemberModal && memberTargetPod && (
                <Modal onClose={() => setShowMemberModal(false)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h2 style={{ fontSize: '1.4rem', margin: 0 }}>
                            Add Members to <span style={{ color: 'var(--accent)' }}>{memberTargetPod.name}</span>
                        </h2>
                        <CloseButton onClick={() => setShowMemberModal(false)} />
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginBottom: '10px' }}>
                            QA team members · {selectedEmails.length} selected
                        </div>
                        <input
                            type="text"
                            value={memberSearch}
                            onChange={e => setMemberSearch(e.target.value)}
                            placeholder="Search by name or email…"
                            className="input-field"
                            style={{ marginBottom: '10px' }}
                            autoFocus
                        />
                        <div style={{
                            maxHeight: '280px', overflowY: 'auto',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '10px'
                        }}>
                            {(() => {
                                const query = memberSearch.toLowerCase();
                                const filtered = availableQaUsers(memberTargetPod).filter(u =>
                                    (u.name ?? '').toLowerCase().includes(query) ||
                                    u.email.toLowerCase().includes(query)
                                );
                                if (availableQaUsers(memberTargetPod).length === 0) return (
                                    <div style={{ padding: '32px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>
                                        {qaUsers.length === 0
                                            ? 'No users with feedback records found.'
                                            : 'All eligible users are already in this pod.'}
                                    </div>
                                );
                                if (filtered.length === 0) return (
                                    <div style={{ padding: '32px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>
                                        No results for "{memberSearch}"
                                    </div>
                                );
                                return filtered.map((u, i, arr) => (
                                    <label
                                        key={u.email}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '12px',
                                            padding: '12px 16px', cursor: 'pointer',
                                            borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                            background: selectedEmails.includes(u.email) ? 'rgba(0,112,243,0.06)' : 'transparent'
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedEmails.includes(u.email)}
                                            onChange={e => {
                                                setSelectedEmails(prev =>
                                                    e.target.checked ? [...prev, u.email] : prev.filter(x => x !== u.email)
                                                );
                                            }}
                                            style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }}
                                        />
                                        <div>
                                            <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{u.name ?? u.email}</div>
                                            {u.name && <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>{u.email}</div>}
                                        </div>
                                    </label>
                                ));
                            })()}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            onClick={() => setShowMemberModal(false)}
                            style={{
                                flex: 1, padding: '12px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px', color: 'rgba(255,255,255,0.7)',
                                cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleAddMembers}
                            disabled={saving || selectedEmails.length === 0}
                            className="btn-primary"
                            style={{ flex: 1, padding: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                        >
                            {saving && <Loader2 className="animate-spin" size={18} />}
                            {saving ? 'Adding…' : `Add ${selectedEmails.length || ''} Member${selectedEmails.length !== 1 ? 's' : ''}`}
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
    return (
        <div
            style={{
                position: 'fixed', inset: 0,
                background: 'rgba(0,0,0,0.75)',
                backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 1000, padding: '24px'
            }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="glass-card" style={{ width: '100%', maxWidth: '520px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
                {children}
            </div>
        </div>
    );
}

function CloseButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '4px' }}
        >
            <X size={22} />
        </button>
    );
}
