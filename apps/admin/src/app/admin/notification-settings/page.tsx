'use client';

import { useState, useEffect } from 'react';
import { Bell, Save, Loader2, CheckCircle2, XCircle, Mail, Users, X } from 'lucide-react';

interface Admin {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

interface NotificationConfig {
  [notificationType: string]: string[]; // notification type -> array of admin IDs
}

const NOTIFICATION_TYPES = [
  {
    key: 'BUG_REPORT_CREATED',
    label: 'Bug Report Created',
    description: 'Send email when a new bug report is submitted by a user'
  },
  {
    key: 'USER_CREATED',
    label: 'User Created',
    description: 'Send email when a new user account is created'
  },
  {
    key: 'AI_CALL_USED',
    label: 'AI Call Used',
    description: 'Send email when an AI call is made (alignment analysis, similarity check, etc.)'
  }
];

export default function NotificationSettingsPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [config, setConfig] = useState<NotificationConfig>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load admins and current configuration
      const [adminsRes, configRes] = await Promise.all([
        fetch('/api/admin/notification-settings/admins'),
        fetch('/api/admin/notification-settings')
      ]);

      if (!adminsRes.ok || !configRes.ok) {
        throw new Error('Failed to load data');
      }

      const adminsData = await adminsRes.json();
      const configData = await configRes.json();

      setAdmins(adminsData.admins);

      // Transform settings array into config object
      const configMap: NotificationConfig = {};
      NOTIFICATION_TYPES.forEach(type => {
        configMap[type.key] = [];
      });

      configData.settings.forEach((setting: { userId: string; notificationType: string; enabled: boolean }) => {
        if (setting.enabled && configMap[setting.notificationType]) {
          configMap[setting.notificationType].push(setting.userId);
        }
      });

      setConfig(configMap);
    } catch (error) {
      console.error('Failed to load data:', error);
      setStatus({ type: 'error', message: 'Failed to load notification settings.' });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/admin/notification-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config })
      });

      if (!res.ok) throw new Error('Failed to save');

      setStatus({ type: 'success', message: 'Notification settings saved successfully.' });
      setTimeout(() => setStatus(null), 3000);
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to save notification settings.' });
    } finally {
      setSaving(false);
    }
  };

  const toggleAdmin = (notificationType: string, adminId: string) => {
    setConfig(prev => {
      const current = prev[notificationType] || [];
      const isEnabled = current.includes(adminId);

      return {
        ...prev,
        [notificationType]: isEnabled
          ? current.filter(id => id !== adminId)
          : [...current, adminId]
      };
    });
  };

  const getAdminName = (admin: Admin) => {
    if (admin.firstName || admin.lastName) {
      return `${admin.firstName || ''} ${admin.lastName || ''}`.trim();
    }
    return admin.email;
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
      <header style={{ marginBottom: '32px' }}>
        <h1 className="premium-gradient" style={{ fontSize: '2rem', marginBottom: '8px' }}>
          Notification Settings
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.6)' }}>
          Configure which admins receive email notifications for system events
        </p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {status && (
          <div className="glass-card" style={{
            padding: '16px 24px',
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

        {NOTIFICATION_TYPES.map(type => {
          const selectedAdmins = config[type.key] || [];
          const unselectedAdmins = admins.filter(admin => !selectedAdmins.includes(admin.id));

          return (
            <div key={type.key} className="glass-card" style={{ padding: '32px' }}>
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <Bell size={24} color="var(--accent)" />
                  <h2 style={{ fontSize: '1.3rem', margin: 0 }}>{type.label}</h2>
                </div>
                <p style={{ fontSize: '0.9rem', opacity: 0.6, marginLeft: '36px' }}>
                  {type.description}
                </p>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <Users size={18} color="var(--accent)" />
                  <h3 style={{ fontSize: '1rem', margin: 0, fontWeight: 600 }}>
                    Selected Admins ({selectedAdmins.length})
                  </h3>
                </div>

                {selectedAdmins.length === 0 ? (
                  <div style={{
                    padding: '20px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    textAlign: 'center',
                    opacity: 0.5,
                    fontSize: '0.9rem'
                  }}>
                    No admins configured. Select admins below to receive this notification.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                    {selectedAdmins.map(adminId => {
                      const admin = admins.find(a => a.id === adminId);
                      if (!admin) return null;

                      return (
                        <div
                          key={adminId}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            borderRadius: '20px',
                            background: 'rgba(147, 51, 234, 0.1)',
                            border: '1px solid rgba(147, 51, 234, 0.3)',
                            color: '#a78bfa',
                            fontSize: '0.9rem'
                          }}
                        >
                          <Mail size={14} />
                          <span>{getAdminName(admin)}</span>
                          <button
                            onClick={() => toggleAdmin(type.key, adminId)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#a78bfa',
                              cursor: 'pointer',
                              padding: '2px',
                              display: 'flex',
                              alignItems: 'center',
                              opacity: 0.7
                            }}
                            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                            onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {unselectedAdmins.length > 0 && (
                  <>
                    <div style={{
                      fontSize: '0.85rem',
                      opacity: 0.5,
                      marginTop: '20px',
                      marginBottom: '12px',
                      paddingTop: '20px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.05)'
                    }}>
                      Available Admins
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {unselectedAdmins.map(admin => (
                        <button
                          key={admin.id}
                          onClick={() => toggleAdmin(type.key, admin.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            borderRadius: '20px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            color: 'rgba(255, 255, 255, 0.7)',
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                          }}
                        >
                          <Mail size={14} />
                          <span>{getAdminName(admin)}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}

        <div style={{ position: 'sticky', bottom: '20px', zIndex: 10 }}>
          <button
            onClick={saveSettings}
            disabled={saving}
            className="btn-primary"
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '8px',
              padding: '16px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
            }}
          >
            {saving ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Saving...
              </>
            ) : (
              <>
                <Save size={20} />
                Save All Notification Settings
              </>
            )}
          </button>
        </div>

        <div className="glass-card" style={{ padding: '20px', background: 'rgba(0,112,243,0.05)', border: '1px solid rgba(0,112,243,0.2)' }}>
          <div style={{ display: 'flex', gap: '12px', color: '#0070f3' }}>
            <Bell size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>Note:</div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>
                Email notifications will be sent to the selected admins' registered email addresses. Make sure selected admins check their spam folders if they don't receive expected notifications.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
