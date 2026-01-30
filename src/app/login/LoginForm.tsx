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

  async function handleSignup(e: React.MouseEvent) {
    e.preventDefault()
    setLoading(true)

    const form = (e.target as HTMLElement).closest('form')
    if (!form) return

    const formData = new FormData(form)

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Signup failed')
        setLoading(false)
        return
      }

      // Success - redirect to login with message
      window.location.href = '/login?message=' + encodeURIComponent('Check your email to continue the signup process.')
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
          <button
            type="button"
            onClick={handleSignup}
            disabled={loading}
            style={{
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '0.9rem',
              textAlign: 'center',
              marginTop: '8px',
              background: 'none',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1
            }}
          >
            Don't have an account? <span style={{ color: 'var(--accent)' }}>Sign Up</span>
          </button>
        </div>
      </form>
    </div>
  )
}
