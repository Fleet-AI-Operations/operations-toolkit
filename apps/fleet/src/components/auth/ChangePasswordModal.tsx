'use client';

import { useState } from 'react';
import { X, Lock, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { updatePasswordAction } from '@/app/api/auth/actions';

interface ChangePasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(false);

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        try {
            const result = await updatePasswordAction(password);
            if (result?.error) {
                setError(result.error);
            } else {
                setSuccess(true);
                setPassword('');
                setConfirmPassword('');
                setTimeout(() => {
                    onClose();
                }, 2000);
            }
        } catch (err) {
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)'
        }}>
            <div 
                className="glass-card" 
                style={{ 
                    width: '100%', 
                    maxWidth: '440px', 
                    padding: '32px',
                    position: 'relative',
                    animation: 'modalFadeIn 0.3s ease-out'
                }}
            >
                <button 
                    onClick={onClose}
                    style={{ 
                        position: 'absolute', 
                        top: '20px', 
                        right: '20px', 
                        color: 'rgba(255, 255, 255, 0.4)',
                        padding: '4px',
                        borderRadius: '6px',
                        transition: 'all 0.2s'
                    }}
                    className="hover-bright"
                >
                    <X size={20} />
                </button>

                <div style={{ marginBottom: '24px' }}>
                    <div style={{ 
                        width: '48px', 
                        height: '48px', 
                        borderRadius: '12px', 
                        background: 'rgba(0, 112, 243, 0.1)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        marginBottom: '16px',
                        color: 'var(--accent)'
                    }}>
                        <Lock size={24} />
                    </div>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Update Password</h2>
                    <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.9rem' }}>
                        Set a new password for your account.
                    </p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'rgba(255, 255, 255, 0.7)' }}>New Password</label>
                        <input 
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="input-field"
                            placeholder="••••••••"
                            required
                            data-testid="new-password-input"
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'rgba(255, 255, 255, 0.7)' }}>Confirm New Password</label>
                        <input 
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="input-field"
                            placeholder="••••••••"
                            required
                            data-testid="confirm-password-input"
                        />
                    </div>

                    {error && (
                        <div style={{ 
                            padding: '12px', 
                            background: 'rgba(255, 68, 68, 0.1)', 
                            border: '1px solid rgba(255, 68, 68, 0.2)', 
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            color: '#ff4444',
                            fontSize: '0.9rem'
                        }}>
                            <AlertCircle size={18} />
                            {error}
                        </div>
                    )}

                    {success && (
                        <div style={{ 
                            padding: '12px', 
                            background: 'rgba(0, 255, 136, 0.1)', 
                            border: '1px solid rgba(0, 255, 136, 0.2)', 
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            color: '#00ff88',
                            fontSize: '0.9rem'
                        }}>
                            <CheckCircle2 size={18} />
                            Password updated successfully!
                        </div>
                    )}

                    <button 
                        type="submit" 
                        className="btn-primary" 
                        disabled={loading || success}
                        data-testid="update-password-submit"
                        style={{ 
                            marginTop: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            opacity: (loading || success) ? 0.7 : 1
                        }}
                    >
                        {loading ? <Loader2 size={18} className="animate-spin" /> : null}
                        {success ? 'Success!' : 'Update Password'}
                    </button>
                </form>
            </div>
        </div>
    );
}
