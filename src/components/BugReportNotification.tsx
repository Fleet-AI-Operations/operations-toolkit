'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bug } from 'lucide-react';

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
        if (response.ok) {
          const data = await response.json();
          setUnassignedCount(data.count);
        }
      } catch (error) {
        console.error('Failed to fetch unassigned bug reports count:', error);
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
    <Link
      href="/admin/bug-reports"
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
    </Link>
  );
}
