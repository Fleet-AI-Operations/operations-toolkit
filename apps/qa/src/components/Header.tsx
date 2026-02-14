import { createClient } from '@repo/auth/server'
import Link from 'next/link'
import BalanceIndicator from './AI/BalanceIndicator'
import UserProfileDropdown from './navigation/UserProfileDropdown'
import ProjectSelector from './navigation/ProjectSelector'
import BugReportNotification from './BugReportNotification'
import UserBugReportTracker from './UserBugReportTracker'
import TimeEntryButton from './TimeEntryButton'

export default async function Header() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let profile = null
    if (user) {
        const { data: profileData, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()
        
        if (error && error.code !== 'PGRST116') {
            console.error('[Header] Profile fetch error:', error.message)
        }
        
        profile = {
            role: profileData?.role || user.user_metadata?.role || 'USER'
        }
    }

    return (
        <header style={{
            height: 'var(--topbar-height)',
            borderBottom: '1px solid var(--border)',
            padding: '0 40px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--glass)',
            backdropFilter: 'blur(10px)',
            position: 'sticky',
            top: 0,
            zIndex: 90,
            width: '100%'
        }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
                {user && <ProjectSelector />}
            </div>

            {user ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {profile?.role === 'ADMIN' && <BalanceIndicator />}
                    <TimeEntryButton />
                    <UserBugReportTracker />
                    <BugReportNotification userRole={profile?.role || 'USER'} />
                    <UserProfileDropdown
                        email={user.email || ''}
                        role={profile?.role || 'USER'}
                    />
                </div>
            ) : (
                <Link href="/login" style={{ 
                    fontSize: '0.9rem', 
                    color: 'var(--accent)', 
                    fontWeight: '500',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: 'rgba(0, 112, 243, 0.1)'
                }}>
                    Sign In
                </Link>
            )}
        </header>
    )
}
