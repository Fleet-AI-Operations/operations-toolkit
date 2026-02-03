'use client'

import { useEffect, useState, Fragment } from 'react'
import { useRoleCheck } from '@/hooks/useRoleCheck'
import { getStatusPriority, getStatusLabel, getStatusColor } from '@/lib/bug-reports'
import styles from './page.module.css'

interface BugReport {
  id: string
  reportNumber: number
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
  const { isAuthorized } = useRoleCheck({
    allowedRoles: ['ADMIN'],
    redirectOnUnauthorized: '/',
    redirectOnUnauthenticated: '/login'
  })

  const [reports, setReports] = useState<BugReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

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

      // Validate response structure
      if (!data.bugReports || !Array.isArray(data.bugReports)) {
        console.error('Invalid API response: bugReports is not an array')
        setError('Invalid response from server')
        setReports([])
        return
      }

      // Sort by status priority (PENDING > IN_PROGRESS > RESOLVED), then by date (newest first)
      const sortedReports = data.bugReports.sort((a: BugReport, b: BugReport) => {
        const statusDiff = getStatusPriority(a.status) - getStatusPriority(b.status)
        if (statusDiff !== 0) return statusDiff

        // Within same status, sort by newest first
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })

      setReports(sortedReports)
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

  if (isAuthorized === null) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Checking permissions...</div>
      </div>
    )
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
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>ID</th>
                <th className={styles.th}>Status</th>
                <th className={styles.th}>Assigned To</th>
                <th className={styles.th}>Created By</th>
                <th className={styles.th}>Time</th>
                <th className={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <Fragment key={report.id}>
                  <tr
                    className={`${styles.tableRow} ${expandedId === report.id ? styles.expandedRow : ''}`}
                    onClick={() => setExpandedId(expandedId === report.id ? null : report.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setExpandedId(expandedId === report.id ? null : report.id)
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-expanded={expandedId === report.id}
                    aria-label={`Bug report #${report.reportNumber} from ${report.userEmail} - ${getStatusLabel(report.status)}`}
                  >
                    <td className={styles.td}>
                      <span className={styles.reportNumber}>#{report.reportNumber}</span>
                    </td>
                    <td className={styles.td}>
                      <div
                        className={styles.statusBadge}
                        style={{ backgroundColor: getStatusColor(report.status) + '20', color: getStatusColor(report.status) }}
                      >
                        {getStatusLabel(report.status)}
                      </div>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.assignmentText}>
                        {report.assignedToEmail || <span className={styles.unassigned}>Unassigned</span>}
                      </span>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.userEmail}>{report.userEmail}</span>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.date}>{formatDate(report.createdAt)}</span>
                    </td>
                    <td className={styles.td}>
                      <svg
                        className={`${styles.expandIcon} ${expandedId === report.id ? styles.expandIconRotated : ''}`}
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </td>
                  </tr>
                  {expandedId === report.id && (
                    <tr key={`${report.id}-details`} className={styles.detailsRow}>
                      <td colSpan={6} className={styles.detailsCell}>
                        <div className={styles.detailsContent}>
                          <div className={styles.detailsSection}>
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
                              <div className={styles.field}>
                                <span className={styles.fieldLabel}>User Agent:</span>
                                <code className={styles.userAgent}>{report.userAgent}</code>
                              </div>
                            )}
                          </div>

                          <div className={styles.detailsActions}>
                            <div className={styles.statusControls}>
                              <select
                                className={styles.statusSelect}
                                value={report.status}
                                onChange={(e) => {
                                  e.stopPropagation()
                                  updateStatus(report.id, e.target.value)
                                }}
                                disabled={updatingId === report.id}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <option value="PENDING">Pending</option>
                                <option value="IN_PROGRESS">In Progress</option>
                                <option value="RESOLVED">Resolved</option>
                              </select>

                              {!report.assignedTo && (
                                <button
                                  className={styles.assignButton}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    updateStatus(report.id, report.status === 'PENDING' ? 'IN_PROGRESS' : (report.status || 'IN_PROGRESS'), 'self')
                                  }}
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
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
