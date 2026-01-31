'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

export function LoginForm() {
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | undefined>()
  const [message, setMessage] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setError(searchParams.get('error') || undefined)
    setMessage(searchParams.get('message') || undefined)
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(undefined)

    const formData = new FormData(e.currentTarget)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Login failed')
        setLoading(false)
        return
      }

      // Success - redirect to home
      window.location.href = '/'
    } catch (err) {
      setError('An unexpected error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="glass-card" style={{ width: '100%', maxWidth: '400px' }}>
      <h1 className="premium-gradient" style={{ marginBottom: '8px', fontSize: '2rem' }}>Welcome Back</h1>
      <p style={{ color: 'rgba(255, 255, 255, 0.6)', marginBottom: '32px' }}>
        Sign in to access operations tools.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label htmlFor="email" style={{ fontSize: '0.9rem', fontWeight: '500' }}>Email Address</label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            className="input-field"
            required
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label htmlFor="password" style={{ fontSize: '0.9rem', fontWeight: '500' }}>Password</label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            className="input-field"
            required
          />
        </div>

        {error && (
          <div style={{
            color: 'var(--error)',
            fontSize: '0.85rem',
            background: 'rgba(255, 68, 68, 0.1)',
            padding: '10px',
            borderRadius: '8px'
          }}>
            {error}
          </div>
        )}

        {message && (
          <div style={{
            color: 'var(--success)',
            fontSize: '0.85rem',
            background: 'rgba(0, 255, 136, 0.1)',
            padding: '10px',
            borderRadius: '8px'
          }}>
            {message}
          </div>
        )}

        <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '12px' }}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}
