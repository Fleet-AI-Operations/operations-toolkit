'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@repo/auth/client';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const supabase = createClient();

            if (!supabase) {
                setError('Configuration error: Unable to connect to authentication service');
                setLoading(false);
                return;
            }

            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (signInError) {
                setError(signInError.message);
                setLoading(false);
                return;
            }

            // Redirect to home page
            router.push('/');
            router.refresh();
        } catch (err) {
            setError('An unexpected error occurred');
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, rgba(0,112,243,0.1) 0%, rgba(0,0,0,0.95) 100%)'
        }}>
            <div style={{
                background: 'rgba(20, 20, 25, 0.95)',
                backdropFilter: 'blur(20px)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '48px',
                width: '100%',
                maxWidth: '400px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
            }}>
                <h1 className="premium-gradient" style={{
                    fontSize: '2rem',
                    marginBottom: '8px',
                    textAlign: 'center'
                }}>
                    Operations Toolkit
                </h1>
                <p style={{
                    textAlign: 'center',
                    color: 'rgba(255, 255, 255, 0.6)',
                    marginBottom: '32px',
                    fontSize: '0.9rem'
                }}>
                    Sign in to continue
                </p>

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                        <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            fontSize: '0.9rem',
                            fontWeight: 500
                        }}>
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="you@example.com"
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid var(--border)',
                                borderRadius: '6px',
                                color: 'white',
                                fontSize: '0.95rem'
                            }}
                        />
                    </div>

                    <div>
                        <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            fontSize: '0.9rem',
                            fontWeight: 500
                        }}>
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid var(--border)',
                                borderRadius: '6px',
                                color: 'white',
                                fontSize: '0.95rem'
                            }}
                        />
                    </div>

                    {error && (
                        <div style={{
                            padding: '12px',
                            background: 'rgba(255, 77, 77, 0.1)',
                            border: '1px solid rgba(255, 77, 77, 0.3)',
                            borderRadius: '6px',
                            color: '#ff4d4d',
                            fontSize: '0.9rem'
                        }}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary"
                        style={{
                            width: '100%',
                            padding: '12px',
                            fontSize: '1rem',
                            fontWeight: 600,
                            opacity: loading ? 0.6 : 1,
                            cursor: loading ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <div style={{
                    marginTop: '24px',
                    paddingTop: '24px',
                    borderTop: '1px solid var(--border)',
                    textAlign: 'center',
                    fontSize: '0.85rem',
                    color: 'rgba(255, 255, 255, 0.5)'
                }}>
                    Test accounts: user@test.com, qa@test.com, core@test.com, fleet@test.com, admin@test.com<br />
                    Password: test
                </div>
            </div>
        </div>
    );
}
