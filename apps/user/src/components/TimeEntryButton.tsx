'use client'

import Link from 'next/link'
import { Clock } from 'lucide-react'
import styles from './TimeEntryButton.module.css'

export default function TimeEntryButton() {
  const userAppUrl = process.env.NEXT_PUBLIC_USER_APP_URL || 'http://localhost:3001'

  return (
    <Link
      href={`${userAppUrl}/`}
      className={styles.button}
      aria-label="Log Time Entry"
      title="Log Time Entry"
    >
      <Clock size={20} strokeWidth={2} />
    </Link>
  )
}
