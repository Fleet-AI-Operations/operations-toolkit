'use client'

export function LoginForm({ error, message }: { error?: string; message?: string }) {
  return (
    <div className="glass-card" style={{ width: '100%', maxWidth: '400px' }}>
      <h1 className="premium-gradient" style={{ marginBottom: '8px', fontSize: '2rem' }}>Welcome Back</h1>
      <p style={{ color: 'rgba(255, 255, 255, 0.6)', marginBottom: '32px' }}>
        Sign in to access operations tools.
      </p>

      <form action="/api/auth/login" method="POST" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
          <button type="submit" className="btn-primary">
            Sign In
          </button>
          <button
            type="button"
            onClick={(e) => {
              const form = e.currentTarget.closest('form');
              if (form) {
                form.action = '/api/auth/signup';
                form.submit();
              }
            }}
            style={{
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '0.9rem',
              textAlign: 'center',
              marginTop: '8px',
              background: 'none',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Don't have an account? <span style={{ color: 'var(--accent)' }}>Sign Up</span>
          </button>
        </div>
      </form>
    </div>
  )
}
