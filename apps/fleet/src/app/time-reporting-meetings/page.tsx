'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X, Save, Search, Calendar } from 'lucide-react';

interface Meeting {
  id: string;
  title: string;
  description: string | null;
  isRecurring: boolean;
  recurrencePattern: string | null;
  expectedDurationHours: number | null;
  category: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'One-time' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
];

const CATEGORY_OPTIONS = [
  { value: 'team-sync', label: 'Team Sync' },
  { value: 'planning', label: 'Planning' },
  { value: '1-on-1', label: '1-on-1' },
  { value: 'all-hands', label: 'All Hands' },
  { value: 'training', label: 'Training' },
  { value: 'client', label: 'Client Meeting' },
  { value: 'other', label: 'Other' },
];

export default function TimeReportingMeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    isRecurring: false,
    recurrencePattern: 'none',
    expectedDurationHours: 1,
    category: 'other',
    isActive: true,
  });

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/time-reporting/meetings');
      if (response.ok) {
        const data = await response.json();
        setMeetings(data.meetings || []);
      }
    } catch (error) {
      console.error('Error fetching meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingMeeting(null);
    setFormData({
      title: '',
      description: '',
      isRecurring: false,
      recurrencePattern: 'none',
      expectedDurationHours: 1,
      category: 'other',
      isActive: true,
    });
    setShowModal(true);
  };

  const openEditModal = (meeting: Meeting) => {
    setEditingMeeting(meeting);
    setFormData({
      title: meeting.title,
      description: meeting.description || '',
      isRecurring: meeting.isRecurring,
      recurrencePattern: meeting.recurrencePattern || 'none',
      expectedDurationHours: meeting.expectedDurationHours || 1,
      category: meeting.category || 'other',
      isActive: meeting.isActive,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingMeeting(null);
    setFormData({
      title: '',
      description: '',
      isRecurring: false,
      recurrencePattern: 'none',
      expectedDurationHours: 1,
      category: 'other',
      isActive: true,
    });
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      alert('Meeting title is required');
      return;
    }

    try {
      const url = editingMeeting
        ? `/api/time-reporting/meetings/${editingMeeting.id}`
        : '/api/time-reporting/meetings';
      
      const method = editingMeeting ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          recurrencePattern: formData.isRecurring ? formData.recurrencePattern : null,
        }),
      });

      if (response.ok) {
        fetchMeetings();
        closeModal();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to save meeting');
      }
    } catch (error) {
      console.error('Error saving meeting:', error);
      alert('Network error');
    }
  };

  const handleDelete = async (meetingId: string) => {
    if (!confirm('Are you sure you want to delete this meeting? This will affect any time reports that reference it.')) {
      return;
    }

    try {
      const response = await fetch(`/api/time-reporting/meetings/${meetingId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchMeetings();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete meeting');
      }
    } catch (error) {
      console.error('Error deleting meeting:', error);
      alert('Network error');
    }
  };

  // Filter and search
  const filteredMeetings = meetings.filter(meeting => {
    const matchesSearch = meeting.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (meeting.description?.toLowerCase().includes(searchQuery.toLowerCase()) || false);
    const matchesCategory = categoryFilter === 'all' || meeting.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && meeting.isActive) ||
                         (statusFilter === 'inactive' && !meeting.isActive);
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Calculate summary
  const summary = {
    totalMeetings: meetings.length,
    activeMeetings: meetings.filter(m => m.isActive).length,
    inactiveMeetings: meetings.filter(m => !m.isActive).length,
    recurringMeetings: meetings.filter(m => m.isRecurring).length,
    totalExpectedHours: meetings.reduce((sum, m) => sum + (m.expectedDurationHours || 0), 0),
  };

  return (
    <div style={{ padding: '40px', maxWidth: '1800px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1
            style={{
              fontSize: '32px',
              fontWeight: 700,
              marginBottom: '8px',
              background: 'linear-gradient(135deg, var(--accent) 0%, #00d4ff 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Meeting Catalog
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>
            Manage meeting definitions for time reporting. Add, edit, or remove meetings that workers can reference.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Plus className="w-4 h-4" />
          Add Meeting
        </button>
      </div>

      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Total Meetings
          </div>
          <div style={{ fontSize: '32px', fontWeight: 600 }}>
            {summary.totalMeetings}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Active
          </div>
          <div style={{ fontSize: '32px', fontWeight: 600, color: '#00ff88' }}>
            {summary.activeMeetings}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Inactive
          </div>
          <div style={{ fontSize: '32px', fontWeight: 600, color: 'var(--text-tertiary)' }}>
            {summary.inactiveMeetings}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Recurring
          </div>
          <div style={{ fontSize: '32px', fontWeight: 600 }}>
            {summary.recurringMeetings}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Total Expected Hours
          </div>
          <div style={{ fontSize: '32px', fontWeight: 600 }}>
            {summary.totalExpectedHours.toFixed(1)}h
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>
              Search
            </label>
            <div style={{ position: 'relative' }}>
              <Search
                className="w-4 h-4"
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-tertiary)',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                placeholder="Search meetings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-primary)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>
              Category
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-primary)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="all">All Categories</option>
              {CATEGORY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-primary)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Meetings Table */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
          Meetings {loading && '(Loading...)'}
        </h3>

        {loading ? (
          <p style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
            Loading meetings...
          </p>
        ) : filteredMeetings.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
            No meetings found. {meetings.length === 0 ? 'Create your first meeting!' : 'Try adjusting your filters.'}
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-primary)', textAlign: 'left' }}>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Title</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Category</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Recurrence</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Expected Duration</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Status</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMeetings.map((meeting) => (
                  <tr key={meeting.id} style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 500 }}>{meeting.title}</div>
                      {meeting.description && (
                        <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                          {meeting.description}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '13px',
                          backgroundColor: 'rgba(var(--accent-rgb), 0.15)',
                          color: 'var(--accent)',
                        }}
                      >
                        {CATEGORY_OPTIONS.find(c => c.value === meeting.category)?.label || 'Other'}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      {meeting.isRecurring ? (
                        <span style={{ color: 'var(--text-primary)' }}>
                          {RECURRENCE_OPTIONS.find(r => r.value === meeting.recurrencePattern)?.label || 'Recurring'}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)' }}>One-time</span>
                      )}
                    </td>
                    <td style={{ padding: '12px', fontFamily: 'monospace' }}>
                      {meeting.expectedDurationHours ? `${meeting.expectedDurationHours.toFixed(1)}h` : '-'}
                    </td>
                    <td style={{ padding: '12px' }}>
                      {meeting.isActive ? (
                        <span style={{ color: '#00ff88' }}>Active</span>
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)' }}>Inactive</span>
                      )}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => openEditModal(meeting)}
                          className="btn-secondary"
                          style={{ fontSize: '13px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Edit className="w-3 h-3" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(meeting.id)}
                          className="btn-secondary"
                          style={{
                            fontSize: '13px',
                            padding: '6px 12px',
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            borderColor: 'rgb(239, 68, 68)',
                            color: 'rgb(239, 68, 68)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div
          onClick={closeModal}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-card"
            style={{
              padding: '32px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 600 }}>
                {editingMeeting ? 'Edit Meeting' : 'Add Meeting'}
              </h2>
              <button
                onClick={closeModal}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Weekly Team Sync"
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-primary)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="Brief description of the meeting purpose..."
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-primary)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-primary)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                  }}
                >
                  {CATEGORY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.isRecurring}
                    onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Recurring Meeting</span>
                </label>
              </div>

              {formData.isRecurring && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    Recurrence Pattern
                  </label>
                  <select
                    value={formData.recurrencePattern}
                    onChange={(e) => setFormData({ ...formData, recurrencePattern: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-primary)',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                    }}
                  >
                    {RECURRENCE_OPTIONS.filter(r => r.value !== 'none').map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Expected Duration (hours)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={formData.expectedDurationHours}
                  onChange={(e) => setFormData({ ...formData, expectedDurationHours: parseFloat(e.target.value) || 0 })}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-primary)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Active (available for time reporting)</span>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={closeModal} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Save className="w-4 h-4" />
                {editingMeeting ? 'Update' : 'Create'} Meeting
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
