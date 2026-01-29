
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Loader2, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    const handleSubmit = async (e: any) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            setLoading(false);
            return;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters long');
            setLoading(false);
            return;
        }

        try {
            if (!supabase) {
                throw new Error('Supabase client failed to initialize. Please check your NEXT_PUBLIC_SUPABASE_URL environment variable.');
            }

            // 1. Update Supabase Auth password
            const { error: authError } = await supabase.auth.updateUser({
                password: password
            });

            if (authError) throw authError;

            // 2. Update profile in Prisma via an API call (to be created or use exist logic)
            // For now, let's assume we have a simple PATCH endpoint or we do it here if RLS allows
            // Better to use an API route to handle the side effect cleanly
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            if (!res.ok) {
                const data = await res.json();
                console.error('[Reset Password] API Error:', data);
                throw new Error(data.error || 'Failed to update profile');
            }

            const data = await res.json();
            console.log('[Reset Password] API Response Detail:', data);

            if (data.updated === 0 || data.currentState === true) {
                const diag = data.diagnostics || {};
                const msg = data.updated === 0 
                    ? `Update failed (0 rows affected). ID: ${diag.id}, Email: ${diag.email}.`
                    : `Update ran, but the flag remained TRUE. State: ${data.currentState}, Found: ${data.found}.`;
                
                throw new Error(`${msg} Please check if you have duplicate records in your profiles table.`);
            }

            setSuccess(true);
            setTimeout(() => {
                router.push('/');
            }, 2000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '20px' }}>
                <div className="glass-card" style={{ width: '100%', maxWidth: '400px', textAlign: 'center', padding: '40px' }}>
                    <CheckCircle2 size={64} color="var(--success)" style={{ marginBottom: '24px' }} />
                    <h1 className="premium-gradient" style={{ marginBottom: '16px' }}>Password Reset!</h1>
                    <p style={{ color: 'rgba(255,255,255,0.6)' }}>Your password has been updated. Redirecting you to the dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '20px' }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '400px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <div style={{ padding: '8px', background: 'rgba(0, 112, 243, 0.1)', borderRadius: '8px' }}>
                        <Lock size={24} color="var(--accent)" />
                    </div>
                    <h1 className="premium-gradient" style={{ fontSize: '1.5rem' }}>Secure Your Account</h1>
                </div>
                
                <p style={{ color: 'rgba(255, 255, 255, 0.6)', marginBottom: '32px', fontSize: '0.95rem', lineHeight: '1.5' }}>
                    An administrator has created your account. For your security, please choose a new password before continuing.
                </p>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.9rem', fontWeight: '500' }}>New Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="At least 8 characters"
                            className="input-field"
                            required
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.9rem', fontWeight: '500' }}>Confirm Password</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Must match"
                            className="input-field"
                            required
                        />
                    </div>

                    {error && (
                        <div style={{ color: 'var(--error)', fontSize: '0.85rem', background: 'rgba(255, 68, 68, 0.1)', padding: '10px', borderRadius: '8px' }}>
                            {error}
                        </div>
                    )}

                    <button type="submit" disabled={loading} className="btn-primary" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                        {loading ? <Loader2 className="animate-spin" size={20} /> : 'Reset Password & Continue'}
                    </button>
                </form>
            </div>
        </div>
    );
}
