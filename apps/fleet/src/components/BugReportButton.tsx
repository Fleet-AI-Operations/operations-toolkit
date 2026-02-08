'use client'

import { useState, useRef, useEffect } from 'react'
import styles from './BugReportButton.module.css'

export default function BugReportButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [showToast, setShowToast] = useState(false)

  const closeTimerRef = useRef<NodeJS.Timeout | null>(null)
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null)
  const modalRef = useRef<HTMLDivElement | null>(null)

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  // Focus trap for modal
  useEffect(() => {
    if (!isOpen) return

    const modal = modalRef.current
    if (!modal) return

    // Get all focusable elements in the modal
    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    // Focus first element when modal opens
    firstElement?.focus()

    // Handle tab key to trap focus
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }

    // Handle Escape key to close modal
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleClose = () => {
    // Clear any pending timers
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current)
      toastTimerRef.current = null
    }

    // Close modal and reset state
    setIsOpen(false)
    setSubmitStatus('idle')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitStatus('idle')

    try {
      const response = await fetch('/api/bug-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pageUrl: window.location.href,
          userAgent: navigator.userAgent,
          description,
        }),
      })

      if (response.ok) {
        setSubmitStatus('success')
        setDescription('')
        closeTimerRef.current = setTimeout(() => {
          setIsOpen(false)
          setSubmitStatus('idle')
          setShowToast(true)
          toastTimerRef.current = setTimeout(() => setShowToast(false), 5000)
        }, 2000)
      } else {
        setSubmitStatus('error')
      }
    } catch (error) {
      console.error('Error submitting bug report:', error)
      setSubmitStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {/* Floating Bug Report Button */}
      <button
        className={styles.floatingButton}
        onClick={() => setIsOpen(true)}
        title="Report a Bug"
        aria-label="Report a Bug"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
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
      </button>

      {/* Modal */}
      {isOpen && (
        <div className={styles.modalOverlay} onClick={handleClose}>
          <div
            ref={modalRef}
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="bug-report-modal-title"
          >
            <div className={styles.modalHeader}>
              <h2 id="bug-report-modal-title">Report a Bug</h2>
              <button
                className={styles.closeButton}
                onClick={handleClose}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.infoSection}>
                <p className={styles.infoLabel}>Current Page:</p>
                <p className={styles.infoValue}>{typeof window !== 'undefined' ? window.location.pathname : ''}</p>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="description" className={styles.label}>
                  What action led to this bug?<span className={styles.required}>*</span>
                </label>
                <textarea
                  id="description"
                  className={styles.textarea}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what you were doing when you encountered the bug..."
                  rows={6}
                  required
                  disabled={isSubmitting}
                />
              </div>

              {submitStatus === 'error' && (
                <div className={styles.error}>
                  Failed to submit bug report. Please try again.
                </div>
              )}

              {submitStatus === 'success' && (
                <div className={styles.success}>
                  <svg
                    className={styles.successIcon}
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
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span>Bug report submitted successfully! An admin will review it soon.</span>
                </div>
              )}

              <div className={styles.buttonGroup}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={handleClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={isSubmitting || !description.trim()}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {showToast && (
        <div className={styles.toast}>
          <svg
            className={styles.toastIcon}
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
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <div className={styles.toastContent}>
            <div className={styles.toastTitle}>Bug Report Submitted</div>
            <div className={styles.toastMessage}>An admin will review your report soon.</div>
          </div>
          <button
            className={styles.toastClose}
            onClick={() => setShowToast(false)}
            aria-label="Close notification"
          >
            ×
          </button>
        </div>
      )}
    </>
  )
}
