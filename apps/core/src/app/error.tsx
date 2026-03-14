'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Core] Unhandled error:', error);
  }, [error]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      gap: '1rem',
      padding: '2rem',
      textAlign: 'center',
    }}>
      <h2 style={{ fontSize: '1.5rem', color: 'var(--error, #ff4444)' }}>Something went wrong</h2>
      <p style={{ color: 'rgba(255,255,255,0.6)', maxWidth: '400px' }}>
        An unexpected error occurred. You can try again or contact support if the problem persists.
      </p>
      <button
        onClick={reset}
        style={{
          padding: '0.5rem 1.5rem',
          background: 'var(--accent, #0070f3)',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '0.9rem',
        }}
      >
        Try again
      </button>
    </div>
  );
}
