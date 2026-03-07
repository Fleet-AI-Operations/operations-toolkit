'use client';

import { useState, useEffect } from 'react';
import { Bug } from 'lucide-react';

const ADMIN_BUG_REPORTS_URL = `${process.env.NEXT_PUBLIC_ADMIN_APP_URL || 'http://localhost:3005'}/bug-reports`;

interface BugReportNotificationProps {
  userRole: string;
}

export default function BugReportNotification({ userRole }: BugReportNotificationProps) {
  const [unassignedCount, setUnassignedCount] = useState<number>(0);

  useEffect(() => {
    // Only fetch for admins
    if (userRole !== 'ADMIN') return;

    const fetchUnassignedCount = async () => {
      try {
        const response = await fetch('/api/bug-reports/unassigned-count');
        if (!response.ok) {
          console.error('Failed to fetch unassigned bug reports count:', { status: response.status, statusText: response.statusText });
          return;
        }
        let data: { count?: number };
        try {
          data = await response.json();
        } catch {
          console.error('Failed to fetch unassigned bug reports count: invalid JSON in response', { contentType: response.headers.get('content-type') });
          return;
        }
        setUnassignedCount(data.count ?? 0);
      } catch (error) {
        console.error('Failed to fetch unassigned bug reports count: network error', error);
      }
    };

    fetchUnassignedCount();
    // Refresh count every 30 seconds
    const interval = setInterval(fetchUnassignedCount, 30000);
    return () => clearInterval(interval);
  }, [userRole]);

  // Only show for admins with unassigned reports
  if (userRole !== 'ADMIN' || unassignedCount === 0) return null;

  return (
    <a
      href={ADMIN_BUG_REPORTS_URL}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        borderRadius: '8px',
        background: 'rgba(255, 77, 77, 0.1)',
        border: '1px solid rgba(255, 77, 77, 0.3)',
        color: '#ff4d4d',
        textDecoration: 'none',
        fontSize: '0.85rem',
        fontWeight: 500,
        transition: 'all 0.2s ease',
        position: 'relative'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255, 77, 77, 0.15)';
        e.currentTarget.style.borderColor = 'rgba(255, 77, 77, 0.5)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255, 77, 77, 0.1)';
        e.currentTarget.style.borderColor = 'rgba(255, 77, 77, 0.3)';
      }}
      title={`${unassignedCount} unassigned bug report${unassignedCount !== 1 ? 's' : ''}`}
    >
      <Bug size={16} />
      <span style={{
        background: '#ff4d4d',
        color: '#fff',
        fontSize: '0.7rem',
        fontWeight: 700,
        padding: '2px 6px',
        borderRadius: '10px',
        minWidth: '20px',
        textAlign: 'center'
      }}>
        {unassignedCount}
      </span>
    </a>
  );
}
