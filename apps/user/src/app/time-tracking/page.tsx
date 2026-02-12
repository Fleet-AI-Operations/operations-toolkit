'use client';

import { useState, useEffect } from 'react';
import { Clock, Plus, Edit2, Trash2, Calendar } from 'lucide-react';

interface TimeEntry {
  id: string;
  date: string;
  hours: number;
  minutes: number;
  category: string;
  count: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UserProfile {
  role: string;
}

const BASE_CATEGORIES = [
  'Writing New Tasks',
  'Updating Tasks Based on Feedback',
  'Time Spent on Instructions or Slack',
  'Platform Downtime',
];

const QA_CATEGORIES = [
  'Time Spent on QA',
];

// Role hierarchy weights for permission checking
const ROLE_WEIGHTS: Record<string, number> = {
  PENDING: 0,
  USER: 1,
  QA: 2,
  CORE: 3,
  FLEET: 4,
  MANAGER: 5,
  ADMIN: 5,
};

function hasQAAccess(role: string): boolean {
  return (ROLE_WEIGHTS[role] || 0) >= ROLE_WEIGHTS.QA;
}

function getCategories(role: string): string[] {
  const categories = [...BASE_CATEGORIES];
  if (hasQAAccess(role)) {
    categories.push(...QA_CATEGORIES);
  }
  return categories;
}

// Categories that should show a count field
const CATEGORIES_WITH_COUNT = [
  'Writing New Tasks',
  'Updating Tasks Based on Feedback',
  'Time Spent on QA',
];

function shouldShowCount(category: string): boolean {
  return CATEGORIES_WITH_COUNT.includes(category);
}

// Pay cycle utilities
function getCurrentPayCycle(): { start: Date; end: Date; period: string } {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const day = today.getDate();

  if (day <= 15) {
    // First pay cycle: 1st to 15th
    return {
      start: new Date(year, month, 1),
      end: new Date(year, month, 15),
      period: `${new Date(year, month, 1).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(year, month, 15).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    };
  } else {
    // Second pay cycle: 16th to end of month
    const lastDay = new Date(year, month + 1, 0).getDate();
    return {
      start: new Date(year, month, 16),
      end: new Date(year, month, lastDay),
      period: `${new Date(year, month, 16).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(year, month, lastDay).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    };
  }
}

function getPreviousPayCycle(): { start: Date; end: Date; period: string } {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const day = today.getDate();

  if (day <= 15) {
    // Currently in first cycle, so previous is second cycle of last month
    const prevMonth = month - 1;
    const prevYear = prevMonth < 0 ? year - 1 : year;
    const adjustedMonth = prevMonth < 0 ? 11 : prevMonth;
    const lastDay = new Date(prevYear, adjustedMonth + 1, 0).getDate();

    return {
      start: new Date(prevYear, adjustedMonth, 16),
      end: new Date(prevYear, adjustedMonth, lastDay),
      period: `${new Date(prevYear, adjustedMonth, 16).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(prevYear, adjustedMonth, lastDay).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    };
  } else {
    // Currently in second cycle, so previous is first cycle of this month
    return {
      start: new Date(year, month, 1),
      end: new Date(year, month, 15),
      period: `${new Date(year, month, 1).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(year, month, 15).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    };
  }
}

export default function TimeTrackingPage() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('USER');
  const [categories, setCategories] = useState<string[]>(BASE_CATEGORIES);

  // Form state
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    hours: 0,
    minutes: 0,
    category: BASE_CATEGORIES[0],
    count: null as number | null,
    notes: '',
  });

  useEffect(() => {
    fetchUserProfile();
    fetchEntries();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const response = await fetch('/api/auth/profile');
      if (response.ok) {
        const data = await response.json();
        const role = data.profile?.role || 'USER';
        setUserRole(role);
        const availableCategories = getCategories(role);
        setCategories(availableCategories);
        // Update form default category if needed
        setFormData(prev => ({
          ...prev,
          category: availableCategories[0],
        }));
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchEntries = async () => {
    try {
      // Calculate date 14 days ago
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      const startDate = fourteenDaysAgo.toISOString().split('T')[0];

      const response = await fetch(`/api/time-entries?startDate=${startDate}`);
      if (!response.ok) throw new Error('Failed to fetch entries');
      const data = await response.json();
      setEntries(data.entries);
    } catch (error) {
      console.error('Error fetching entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Validate that time is not 0h 0m
      if (formData.hours === 0 && formData.minutes === 0) {
        alert('Time cannot be 0h 0m. Please enter at least 1 minute.');
        setSubmitting(false);
        return;
      }

      const url = editingId ? `/api/time-entries/${editingId}` : '/api/time-entries';
      const method = editingId ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save entry');
      }

      // Reset form and refresh entries
      setFormData({
        date: new Date().toISOString().split('T')[0],
        hours: 0,
        minutes: 0,
        category: categories[0],
        count: null,
        notes: '',
      });
      setEditingId(null);
      await fetchEntries();
    } catch (error) {
      console.error('Error saving entry:', error);
      alert(error instanceof Error ? error.message : 'Failed to save entry');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (entry: TimeEntry) => {
    setFormData({
      date: entry.date,
      hours: entry.hours,
      minutes: entry.minutes,
      category: entry.category,
      count: entry.count,
      notes: entry.notes || '',
    });
    setEditingId(entry.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/time-entries/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete entry');

      await fetchEntries();
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert('Failed to delete entry');
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      hours: 0,
      minutes: 0,
      category: categories[0],
      count: null,
      notes: '',
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (hours: number, minutes: number) => {
    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    return parts.length > 0 ? parts.join(' ') : '0m';
  };

  const calculateTotalMinutes = () => {
    return entries.reduce((total, entry) => {
      return total + (entry.hours * 60) + entry.minutes;
    }, 0);
  };

  const getTotalTime = () => {
    const totalMinutes = calculateTotalMinutes();
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return formatTime(hours, minutes);
  };

  const getCategoryTotal = (category: string) => {
    const totalMinutes = entries
      .filter(e => e.category === category)
      .reduce((total, entry) => total + (entry.hours * 60) + entry.minutes, 0);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return formatTime(hours, minutes);
  };

  const getPayCycleTotal = (startDate: Date, endDate: Date) => {
    const totalMinutes = entries
      .filter(e => {
        // Compare date strings directly to avoid timezone issues
        const entryDateStr = e.date.split('T')[0]; // Extract YYYY-MM-DD
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        return entryDateStr >= startDateStr && entryDateStr <= endDateStr;
      })
      .reduce((total, entry) => total + (entry.hours * 60) + entry.minutes, 0);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return formatTime(hours, minutes);
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.6)' }}>Loading time entries...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="premium-gradient" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
          <Clock size={32} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
          Time Tracking
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.6)' }}>
          Record your daily work hours by category
        </p>
      </div>

      {/* Pay Cycle Summary */}
      {(() => {
        const currentCycle = getCurrentPayCycle();
        const previousCycle = getPreviousPayCycle();

        return (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(0, 112, 243, 0.15) 0%, rgba(0, 112, 243, 0.05) 100%)',
              border: '1px solid rgba(0, 112, 243, 0.4)',
              borderRadius: '12px',
              padding: '1.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem' }}>
                <Calendar size={20} style={{ marginRight: '0.5rem', color: '#0070f3' }} />
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0070f3' }}>
                  Current Pay Cycle
                </div>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.5rem' }}>
                {currentCycle.period}
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700 }}>
                {getPayCycleTotal(currentCycle.start, currentCycle.end)}
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '1.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem' }}>
                <Calendar size={20} style={{ marginRight: '0.5rem', color: 'rgba(255,255,255,0.6)' }} />
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
                  Previous Pay Cycle
                </div>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.5rem' }}>
                {previousCycle.period}
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>
                {getPayCycleTotal(previousCycle.start, previousCycle.end)}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div style={{
          background: 'rgba(0, 112, 243, 0.1)',
          border: '1px solid rgba(0, 112, 243, 0.3)',
          borderRadius: '8px',
          padding: '1.5rem'
        }}>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
            Total Time
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>
            {getTotalTime()}
          </div>
        </div>

        {categories.map(category => (
          <div key={category} style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '1.5rem'
          }}>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              {category}
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
              {getCategoryTotal(category)}
            </div>
          </div>
        ))}
      </div>

      {/* Entry Form */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '2rem',
        marginBottom: '2rem'
      }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center' }}>
          {editingId ? (
            <>
              <Edit2 size={20} style={{ marginRight: '0.5rem' }} />
              Edit Time Entry
            </>
          ) : (
            <>
              <Plus size={20} style={{ marginRight: '0.5rem' }} />
              Add Time Entry
            </>
          )}
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                Date
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '0.95rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                Hours
              </label>
              <input
                type="number"
                min="0"
                max="23"
                value={formData.hours}
                onChange={(e) => setFormData({ ...formData, hours: parseInt(e.target.value) || 0 })}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '0.95rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                Minutes
              </label>
              <input
                type="number"
                min="0"
                max="59"
                value={formData.minutes}
                onChange={(e) => setFormData({ ...formData, minutes: parseInt(e.target.value) || 0 })}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '0.95rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value, count: null })}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '0.95rem'
                }}
              >
                {categories.map(cat => (
                  <option key={cat} value={cat} style={{ background: '#1a1a1f' }}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {shouldShowCount(formData.category) && (
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                  Count <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>(optional)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.count ?? ''}
                  onChange={(e) => setFormData({ ...formData, count: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="Number of tasks"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'white',
                    fontSize: '0.95rem'
                  }}
                />
              </div>
            )}
          </div>

          {/* Additional Notes Field */}
          <div style={{ marginTop: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
              Additional Notes <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>(optional)</span>
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add any additional context or details..."
              rows={3}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                color: 'white',
                fontSize: '0.95rem',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>

          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem' }}>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '0.95rem',
                opacity: submitting ? 0.6 : 1,
                cursor: submitting ? 'not-allowed' : 'pointer'
              }}
            >
              {submitting ? 'Saving...' : editingId ? 'Update Entry' : 'Add Entry'}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                style={{
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.95rem',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'rgba(255,255,255,0.8)',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Entries List */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '1.25rem' }}>Your Time Entries</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'} (past 14 days)
          </p>
        </div>

        {entries.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <Calendar size={48} style={{ color: 'rgba(255,255,255,0.3)', marginBottom: '1rem' }} />
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1rem' }}>
              No time entries yet
            </p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
              Add your first time entry using the form above
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, fontSize: '0.9rem' }}>Date</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, fontSize: '0.9rem' }}>Time</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, fontSize: '0.9rem' }}>Category</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, fontSize: '0.9rem' }}>Count</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, fontSize: '0.9rem' }}>Notes</th>
                  <th style={{ padding: '1rem', textAlign: 'right', fontWeight: 600, fontSize: '0.9rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '1rem' }}>{formatDate(entry.date)}</td>
                    <td style={{ padding: '1rem' }}>{formatTime(entry.hours, entry.minutes)}</td>
                    <td style={{ padding: '1rem', color: 'rgba(255,255,255,0.8)' }}>{entry.category}</td>
                    <td style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>
                      {entry.count !== null && entry.count !== undefined ? entry.count : '—'}
                    </td>
                    <td style={{
                      padding: '1rem',
                      color: 'rgba(255,255,255,0.6)',
                      maxWidth: '200px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }} title={entry.notes || undefined}>
                      {entry.notes || '—'}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleEdit(entry)}
                          style={{
                            padding: '0.5rem',
                            background: 'rgba(0, 112, 243, 0.1)',
                            border: '1px solid rgba(0, 112, 243, 0.3)',
                            borderRadius: '6px',
                            color: '#0070f3',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center'
                          }}
                          title="Edit entry"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(entry.id)}
                          style={{
                            padding: '0.5rem',
                            background: 'rgba(255, 77, 77, 0.1)',
                            border: '1px solid rgba(255, 77, 77, 0.3)',
                            borderRadius: '6px',
                            color: '#ff4d4d',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center'
                          }}
                          title="Delete entry"
                        >
                          <Trash2 size={16} />
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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'rgba(20, 20, 25, 0.98)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Delete Time Entry?</h3>
            <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '2rem' }}>
              This action cannot be undone. Are you sure you want to delete this time entry?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'rgba(255,255,255,0.8)',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#ff4d4d',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
