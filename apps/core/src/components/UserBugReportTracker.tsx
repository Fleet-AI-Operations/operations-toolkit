'use client'

import { useEffect, useState, useRef } from 'react'
import { getStatusPriority, getStatusLabel, getStatusColor } from '@/lib/bug-reports'
import styles from './UserBugReportTracker.module.css'

interface BugReport {
  id: string
  pageUrl: string
  description: string
  createdAt: string
  status: string
}

export default function UserBugReportTracker() {
  const [reports, setReports] = useState<BugReport[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchReports()
    // Refresh every 60 seconds
    const interval = setInterval(fetchReports, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const fetchReports = async () => {
    try {
      const response = await fetch('/api/bug-reports')
      if (response.ok) {
        const data = await response.json()

        // Validate response structure
        if (!data.bugReports || !Array.isArray(data.bugReports)) {
          console.error('Invalid API response: bugReports is not an array')
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

        // If more than 5 reports, only show PENDING and IN_PROGRESS
        const filteredReports = sortedReports.length > 5
          ? sortedReports.filter((r: BugReport) => r.status === 'PENDING' || r.status === 'IN_PROGRESS')
          : sortedReports

        setReports(filteredReports)
      } else {
        console.error('Failed to fetch bug reports:', response.status)
        setReports([])
      }
    } catch (error) {
      console.error('Failed to fetch bug reports:', error)
      setReports([])
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) return 'Just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(date)
  }

  const formatPageUrl = (url: string) => {
    try {
      const urlObj = new URL(url)
      return urlObj.pathname + urlObj.search + urlObj.hash
    } catch {
      return url
    }
  }

  return (
    <div className={styles.container} ref={dropdownRef}>
      <button
        className={styles.iconButton}
        onClick={() => !loading && setIsOpen(!isOpen)}
        aria-label="My Bug Reports"
        title="My Bug Reports"
        disabled={loading}
        style={{ opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m8 2 1.88 1.88" />
          <path d="M14.12 3.88 16 2" />
          <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" />
          <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" />
          <path d="M12 20v-9" />
          <path d="M6.53 9C4.6 8.8 3 7.1 3 5" />
          <path d="M6 13H2" />
          <path d="M3 21c0-2.1 1.7-3.9 3.8-4" />
          <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" />
          <path d="M22 13h-4" />
          <path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" />
        </svg>
        {reports.length > 0 && (
          <span className={styles.badge}>{reports.length}</span>
        )}
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>
            <h3>My Bug Reports</h3>
            <span className={styles.count}>{reports.length}</span>
          </div>

          <div className={styles.reportsList}>
            {reports.length === 0 ? (
              <div className={styles.emptyState}>
                <p>No bug reports submitted yet</p>
              </div>
            ) : (
              reports.map((report) => (
                <div key={report.id} className={styles.reportItem}>
                  <div className={styles.reportHeader}>
                    <div
                      className={styles.statusBadge}
                      style={{
                        backgroundColor: getStatusColor(report.status) + '20',
                        color: getStatusColor(report.status)
                      }}
                    >
                      {getStatusLabel(report.status)}
                    </div>
                    <span className={styles.time}>{formatDate(report.createdAt)}</span>
                  </div>

                  <div className={styles.reportPage}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                      <polyline points="10 17 15 12 10 7" />
                      <line x1="15" y1="12" x2="3" y2="12" />
                    </svg>
                    <span>{formatPageUrl(report.pageUrl)}</span>
                  </div>

                  <p className={styles.reportDescription}>
                    {report.description.length > 100
                      ? report.description.substring(0, 100) + '...'
                      : report.description}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
