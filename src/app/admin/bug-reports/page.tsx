'use client'

import { useEffect, useState } from 'react'
import styles from './page.module.css'

interface BugReport {
  id: string
  userEmail: string
  pageUrl: string
  description: string
  createdAt: string
  userAgent: string | null
  status: string
  assignedTo: string | null
  assignedToEmail: string | null
}

export default function BugReportsPage() {
  const [reports, setReports] = useState<BugReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/bug-reports')

      if (!response.ok) {
        throw new Error('Failed to fetch bug reports')
      }

      const data = await response.json()
      setReports(data.bugReports)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (id: string, status: string, assignedTo?: string) => {
    try {
      setUpdatingId(id)
      const response = await fetch('/api/bug-reports', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, status, assignedTo }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.details || errorData.error || 'Failed to update bug report')
      }

      // Refresh the reports list
      await fetchReports()
    } catch (err) {
      console.error('Error updating bug report:', err)
      alert(err instanceof Error ? err.message : 'Failed to update bug report')
    } finally {
      setUpdatingId(null)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return '#fbbf24' // amber
      case 'IN_PROGRESS':
        return '#60a5fa' // blue
      case 'RESOLVED':
        return '#34d399' // green
      default:
        return '#9ca3af' // gray
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'Pending'
      case 'IN_PROGRESS':
        return 'In Progress'
      case 'RESOLVED':
        return 'Resolved'
      default:
        return status
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Bug Reports</h1>
        <div className={styles.loading}>Loading bug reports...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Bug Reports</h1>
        <div className={styles.error}>{error}</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Bug Reports</h1>
        <button onClick={fetchReports} className={styles.refreshButton}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
          </svg>
          Refresh
        </button>
      </div>

      {reports.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No bug reports yet.</p>
        </div>
      ) : (
        <div className={styles.reportsList}>
          {reports.map((report) => (
            <div key={report.id} className={styles.reportCard}>
              <div className={styles.reportHeader}>
                <div className={styles.headerTop}>
                  <div className={styles.userInfo}>
                    <span className={styles.userEmail}>{report.userEmail}</span>
                    <span className={styles.separator}>•</span>
                    <span className={styles.date}>{formatDate(report.createdAt)}</span>
                  </div>
                  <div
                    className={styles.statusBadge}
                    style={{ backgroundColor: getStatusColor(report.status) + '20', color: getStatusColor(report.status) }}
                  >
                    {getStatusLabel(report.status)}
                  </div>
                </div>

                {report.assignedToEmail && (
                  <div className={styles.assignedTo}>
                    Assigned to: {report.assignedToEmail}
                  </div>
                )}

                <div className={styles.statusControls}>
                  <select
                    className={styles.statusSelect}
                    value={report.status}
                    onChange={(e) => updateStatus(report.id, e.target.value)}
                    disabled={updatingId === report.id}
                  >
                    <option value="PENDING">Pending</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="RESOLVED">Resolved</option>
                  </select>

                  {!report.assignedTo && (
                    <button
                      className={styles.assignButton}
                      onClick={() => updateStatus(report.id, report.status === 'PENDING' ? 'IN_PROGRESS' : (report.status || 'IN_PROGRESS'), 'self')}
                      disabled={updatingId === report.id}
                    >
                      Assign to me
                    </button>
                  )}

                  {updatingId === report.id && (
                    <span className={styles.updating}>Updating...</span>
                  )}
                </div>
              </div>

              <div className={styles.reportBody}>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Page:</span>
                  <span className={styles.fieldValue}>
                    {(() => {
                      try {
                        const url = new URL(report.pageUrl)
                        return url.pathname + url.search + url.hash
                      } catch {
                        return report.pageUrl
                      }
                    })()}
                  </span>
                </div>

                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Description:</span>
                  <p className={styles.description}>{report.description}</p>
                </div>

                {report.userAgent && (
                  <details className={styles.details}>
                    <summary className={styles.detailsSummary}>User Agent</summary>
                    <code className={styles.userAgent}>{report.userAgent}</code>
                  </details>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
