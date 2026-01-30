
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { signOut } from '@/app/api/auth/actions'

export default async function WaitingApprovalPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Check if they are actually pending
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'PENDING') {
        redirect('/')
    }

    return (
        <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            minHeight: '100vh',
            padding: '20px',
            textAlign: 'center'
        }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '500px', padding: '40px' }}>
                <div style={{ 
                    fontSize: '3rem', 
                    marginBottom: '20px' 
                }}>⏳</div>
                <h1 className="premium-gradient" style={{ marginBottom: '16px', fontSize: '2rem' }}>Account Pending</h1>
                <p style={{ color: 'rgba(255, 255, 255, 0.7)', lineHeight: '1.6', marginBottom: '32px' }}>
                    Welcome to the <b>Operations Tools</b>. Your account has been created successfully, but it requires approval from an administrator before you can access the dashboard.
                </p>
                <div style={{ 
                    background: 'rgba(0, 112, 243, 0.1)', 
                    padding: '16px', 
                    borderRadius: '12px', 
                    fontSize: '0.9rem',
                    color: 'var(--accent)',
                    marginBottom: '32px'
                }}>
                    We'll review your request shortly. Please check back later!
                </div>

                <form action={signOut}>
                    <button type="submit" style={{ 
                        color: 'rgba(255, 255, 255, 0.5)', 
                        fontSize: '0.9rem',
                        textDecoration: 'underline'
                    }}>
                        Sign out and try another account
                    </button>
                </form>
            </div>
        </div>
    )
}
