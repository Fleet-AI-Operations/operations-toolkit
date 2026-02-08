'use client';

import { useState, useEffect } from 'react';
import {
    ClipboardList,
    Plus,
    Trash2,
    Loader2,
    CheckCircle2,
    XCircle,
    X,
    Users,
    User,
    Calendar,
    Share2,
    CheckSquare,
    Square
} from 'lucide-react';

interface AssignmentBatch {
    id: string;
    name: string;
    description: string | null;
    projectId: string;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    totalRecords: number;
    completedCount: number;
    dueDate: string | null;
    createdAt: string;
    project: { id: string; name: string };
    raterGroup: { id: string; name: string } | null;
    assignedToUser: { id: string; email: string } | null;
    createdBy: { id: string; email: string };
    _count: { records: number };
}

interface Project {
    id: string;
    name: string;
}

interface RaterGroup {
    id: string;
    name: string;
    _count: { members: number };
}

interface User {
    id: string;
    email: string;
}

interface DataRecord {
    id: string;
    content: string;
    category: string | null;
    type: string;
}

export default function AssignmentsPage() {
    const [batches, setBatches] = useState<AssignmentBatch[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [groups, setGroups] = useState<RaterGroup[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [records, setRecords] = useState<DataRecord[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    // Modal state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [loadingRecords, setLoadingRecords] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        assignmentType: 'group' as 'group' | 'individual',
        raterGroupId: '',
        assignedToUserId: '',
        dueDate: '',
        filterCategory: '' as '' | 'TOP_10' | 'BOTTOM_10',
        filterType: '' as '' | 'TASK' | 'FEEDBACK'
    });
    const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchProjects();
        fetchUsers();
    }, []);

    useEffect(() => {
        if (selectedProjectId) {
            fetchBatches();
            fetchGroups();
            fetchRecords();
        } else {
            setBatches([]);
            setGroups([]);
            setRecords([]);
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
                setUsers(Array.isArray(data) ? data.filter((u: any) => u.role !== 'PENDING') : []);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    const fetchBatches = async () => {
        try {
            const res = await fetch(`/api/assignments?projectId=${selectedProjectId}`);
            if (res.ok) {
                const data = await res.json();
                setBatches(data.batches || []);
            }
        } catch (error) {
            console.error('Error fetching batches:', error);
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

    const fetchRecords = async () => {
        setLoadingRecords(true);
        try {
            let url = `/api/records?projectId=${selectedProjectId}&take=500`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setRecords(data.records || []);
            }
        } catch (error) {
            console.error('Error fetching records:', error);
        } finally {
            setLoadingRecords(false);
        }
    };

    const handleCreateBatch = async () => {
        if (!formData.name.trim() || selectedRecordIds.length === 0) return;
        setSaving(true);
        try {
            const payload: any = {
                projectId: selectedProjectId,
                name: formData.name,
                description: formData.description || null,
                recordIds: selectedRecordIds,
                criteria: {
                    category: formData.filterCategory || null,
                    type: formData.filterType || null
                }
            };

            if (formData.dueDate) {
                payload.dueDate = formData.dueDate;
            }

            if (formData.assignmentType === 'group') {
                payload.raterGroupId = formData.raterGroupId;
            } else {
                payload.assignedToUserId = formData.assignedToUserId;
            }

            const res = await fetch('/api/assignments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to create');
            }

            setStatus({ type: 'success', message: 'Assignment batch created' });
            setShowCreateModal(false);
            resetForm();
            fetchBatches();
        } catch (error: any) {
            setStatus({ type: 'error', message: error.message });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteBatch = async (batch: AssignmentBatch) => {
        if (!confirm(`Delete "${batch.name}"? This cannot be undone.`)) return;
        try {
            const res = await fetch(`/api/assignments/${batch.id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete');
            setStatus({ type: 'success', message: 'Batch deleted' });
            fetchBatches();
        } catch (error: any) {
            setStatus({ type: 'error', message: error.message });
        }
    };

    const handleDistribute = async (batch: AssignmentBatch) => {
        try {
            const res = await fetch(`/api/assignments/${batch.id}/distribute`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to distribute');
            setStatus({ type: 'success', message: `Distributed ${data.distributed} records` });
            fetchBatches();
        } catch (error: any) {
            setStatus({ type: 'error', message: error.message });
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            assignmentType: 'group',
            raterGroupId: '',
            assignedToUserId: '',
            dueDate: '',
            filterCategory: '',
            filterType: ''
        });
        setSelectedRecordIds([]);
    };

    const getFilteredRecords = () => {
        return records.filter(r => {
            if (formData.filterCategory && r.category !== formData.filterCategory) return false;
            if (formData.filterType && r.type !== formData.filterType) return false;
            return true;
        });
    };

    const handleSelectAllFiltered = () => {
        const filtered = getFilteredRecords();
        setSelectedRecordIds(filtered.map(r => r.id));
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'COMPLETED': return '#00ff88';
            case 'IN_PROGRESS': return '#0070f3';
            case 'FAILED': return '#ff4d4d';
            case 'CANCELLED': return '#888';
            default: return '#ffaa00';
        }
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
                        Assignment Batches
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.6)' }}>
                        Create and manage record assignments for raters
                    </p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowCreateModal(true); }}
                    disabled={!selectedProjectId}
                    className="btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <Plus size={20} />
                    Create Batch
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

            {/* Batches List */}
            {!selectedProjectId ? (
                <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
                    <ClipboardList size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                    <p style={{ opacity: 0.6 }}>Select a project to view assignments</p>
                </div>
            ) : batches.length === 0 ? (
                <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
                    <ClipboardList size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                    <p style={{ opacity: 0.6, marginBottom: '16px' }}>No assignment batches yet</p>
                    <button onClick={() => setShowCreateModal(true)} className="btn-primary">
                        Create Your First Batch
                    </button>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '16px' }}>
                    {batches.map(batch => (
                        <div key={batch.id} className="glass-card" style={{ padding: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                        <h3 style={{ fontSize: '1.2rem', margin: 0 }}>{batch.name}</h3>
                                        <span style={{
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            fontSize: '0.7rem',
                                            textTransform: 'uppercase',
                                            background: `${getStatusColor(batch.status)}20`,
                                            color: getStatusColor(batch.status)
                                        }}>
                                            {batch.status}
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', opacity: 0.6, marginBottom: '12px' }}>
                                        {batch.raterGroup ? (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Users size={14} /> {batch.raterGroup.name}
                                            </span>
                                        ) : batch.assignedToUser ? (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <User size={14} /> {batch.assignedToUser.email}
                                            </span>
                                        ) : null}
                                        {batch.dueDate && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Calendar size={14} /> Due: {new Date(batch.dueDate).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>

                                    {/* Progress Bar */}
                                    <div style={{ marginBottom: '8px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                                            <span>Progress</span>
                                            <span>{batch.completedCount}/{batch.totalRecords} ({Math.round((batch.completedCount / batch.totalRecords) * 100)}%)</span>
                                        </div>
                                        <div style={{
                                            height: '6px',
                                            background: 'rgba(255,255,255,0.1)',
                                            borderRadius: '3px',
                                            overflow: 'hidden'
                                        }}>
                                            <div style={{
                                                height: '100%',
                                                width: `${(batch.completedCount / batch.totalRecords) * 100}%`,
                                                background: 'var(--accent)',
                                                transition: 'width 0.3s'
                                            }} />
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {batch.raterGroup && batch.status !== 'COMPLETED' && (
                                        <button
                                            onClick={() => handleDistribute(batch)}
                                            className="btn-secondary"
                                            style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                                            title="Auto-distribute to group members"
                                        >
                                            <Share2 size={16} />
                                            Distribute
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDeleteBatch(batch)}
                                        className="btn-secondary"
                                        style={{ padding: '8px 12px', color: '#ff4d4d' }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Batch Modal */}
            {showCreateModal && (
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
                    <div className="glass-card" style={{ width: '100%', maxWidth: '700px', padding: '32px', maxHeight: '90vh', overflow: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '1.4rem', margin: 0 }}>Create Assignment Batch</h2>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Batch Name</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g., TOP_10 Review - Week 1"
                                    className="input-field"
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Description (optional)</label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Describe this batch..."
                                    className="input-field"
                                    rows={2}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Assign To</label>
                                    <select
                                        value={formData.assignmentType}
                                        onChange={e => setFormData({ ...formData, assignmentType: e.target.value as any })}
                                        className="input-field"
                                    >
                                        <option value="group">Rater Group</option>
                                        <option value="individual">Individual User</option>
                                    </select>
                                </div>
                                <div>
                                    {formData.assignmentType === 'group' ? (
                                        <>
                                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Select Group</label>
                                            <select
                                                value={formData.raterGroupId}
                                                onChange={e => setFormData({ ...formData, raterGroupId: e.target.value })}
                                                className="input-field"
                                            >
                                                <option value="">-- Select group --</option>
                                                {groups.map(g => (
                                                    <option key={g.id} value={g.id}>{g.name} ({g._count.members} members)</option>
                                                ))}
                                            </select>
                                        </>
                                    ) : (
                                        <>
                                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Select User</label>
                                            <select
                                                value={formData.assignedToUserId}
                                                onChange={e => setFormData({ ...formData, assignedToUserId: e.target.value })}
                                                className="input-field"
                                            >
                                                <option value="">-- Select user --</option>
                                                {users.map(u => (
                                                    <option key={u.id} value={u.id}>{u.email}</option>
                                                ))}
                                            </select>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Due Date (optional)</label>
                                <input
                                    type="date"
                                    value={formData.dueDate}
                                    onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                                    className="input-field"
                                    style={{ maxWidth: '200px' }}
                                />
                            </div>

                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '12px', fontWeight: 500 }}>
                                    Select Records ({selectedRecordIds.length} selected)
                                </label>

                                <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    <select
                                        value={formData.filterCategory}
                                        onChange={e => setFormData({ ...formData, filterCategory: e.target.value as any })}
                                        className="input-field"
                                        style={{ width: '150px' }}
                                    >
                                        <option value="">All Categories</option>
                                        <option value="TOP_10">TOP_10</option>
                                        <option value="BOTTOM_10">BOTTOM_10</option>
                                    </select>
                                    <select
                                        value={formData.filterType}
                                        onChange={e => setFormData({ ...formData, filterType: e.target.value as any })}
                                        className="input-field"
                                        style={{ width: '150px' }}
                                    >
                                        <option value="">All Types</option>
                                        <option value="TASK">TASK</option>
                                        <option value="FEEDBACK">FEEDBACK</option>
                                    </select>
                                    <button
                                        onClick={handleSelectAllFiltered}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '10px 16px',
                                            borderRadius: '8px',
                                            border: '1px solid rgba(0,112,243,0.5)',
                                            background: 'rgba(0,112,243,0.15)',
                                            color: '#0070f3',
                                            cursor: 'pointer',
                                            fontWeight: 500,
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        <CheckSquare size={16} />
                                        Select All ({getFilteredRecords().length})
                                    </button>
                                    <button
                                        onClick={() => setSelectedRecordIds([])}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '10px 16px',
                                            borderRadius: '8px',
                                            border: '1px solid rgba(255,255,255,0.2)',
                                            background: 'rgba(255,255,255,0.05)',
                                            color: 'rgba(255,255,255,0.7)',
                                            cursor: 'pointer',
                                            fontWeight: 500
                                        }}
                                    >
                                        <Square size={16} />
                                        Deselect All
                                    </button>
                                </div>

                                {loadingRecords ? (
                                    <div style={{ padding: '24px', textAlign: 'center' }}>
                                        <Loader2 className="animate-spin" size={24} />
                                    </div>
                                ) : (
                                    <div style={{
                                        maxHeight: '200px',
                                        overflow: 'auto',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px'
                                    }}>
                                        {getFilteredRecords().slice(0, 100).map(record => (
                                            <label
                                                key={record.id}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'flex-start',
                                                    gap: '12px',
                                                    padding: '10px 12px',
                                                    cursor: 'pointer',
                                                    borderBottom: '1px solid rgba(255,255,255,0.05)'
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedRecordIds.includes(record.id)}
                                                    onChange={e => {
                                                        if (e.target.checked) {
                                                            setSelectedRecordIds([...selectedRecordIds, record.id]);
                                                        } else {
                                                            setSelectedRecordIds(selectedRecordIds.filter(id => id !== record.id));
                                                        }
                                                    }}
                                                    style={{ width: '16px', height: '16px', marginTop: '2px' }}
                                                />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{
                                                        fontSize: '0.85rem',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis'
                                                    }}>
                                                        {record.content.slice(0, 100)}...
                                                    </div>
                                                    <div style={{ fontSize: '0.7rem', opacity: 0.5, marginTop: '2px' }}>
                                                        {record.type} • {record.category || 'No category'}
                                                    </div>
                                                </div>
                                            </label>
                                        ))}
                                        {getFilteredRecords().length > 100 && (
                                            <div style={{ padding: '12px', textAlign: 'center', opacity: 0.5, fontSize: '0.85rem' }}>
                                                Showing first 100 of {getFilteredRecords().length} records
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="btn-secondary"
                                    style={{ flex: 1, padding: '14px' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateBatch}
                                    disabled={saving || !formData.name.trim() || selectedRecordIds.length === 0 ||
                                        (formData.assignmentType === 'group' && !formData.raterGroupId) ||
                                        (formData.assignmentType === 'individual' && !formData.assignedToUserId)}
                                    className="btn-primary"
                                    style={{ flex: 1, padding: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                                >
                                    {saving ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                                    Create Batch ({selectedRecordIds.length} records)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
