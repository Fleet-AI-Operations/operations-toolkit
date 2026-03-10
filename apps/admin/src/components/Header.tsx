import { createClient } from '@repo/auth/server'
import { hasMinRole } from '@repo/auth'
import { prisma } from '@repo/database'
import Link from 'next/link'
import BalanceIndicator from './AI/BalanceIndicator'
import UserProfileDropdown from './navigation/UserProfileDropdown'
import BugReportNotification from './BugReportNotification'
import UserBugReportTracker from './UserBugReportTracker'
import { SimilarityFlagsButton, ReviewRequestedButton } from '@repo/ui/components'

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

    let openFlagCount = 0
    if (profile && hasMinRole(profile.role, 'CORE')) {
        try {
            const result = await prisma.$queryRaw<[{ count: bigint }]>`
                SELECT COUNT(*) as count FROM public.similarity_flags WHERE status = 'OPEN'
            `
            openFlagCount = Number(result[0]?.count ?? 0)
        } catch (err) {
            console.error('[Header] Failed to fetch similarity flag count:', err)
        }
    }

    let reviewRequestedCount = 0
    if (profile && hasMinRole(profile.role, 'FLEET')) {
        try {
            reviewRequestedCount = await prisma.workerFlag.count({
                where: { flagType: 'REVIEW_REQUESTED', status: { in: ['OPEN', 'UNDER_REVIEW'] } },
            })
        } catch (err) {
            console.error('[Header] Failed to fetch review-requested count:', err)
        }
    }

    const coreBaseUrl = process.env.NEXT_PUBLIC_CORE_APP_URL || 'http://localhost:3003'
    const fleetBaseUrl = process.env.NEXT_PUBLIC_FLEET_APP_URL || 'http://localhost:3004'

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
                {/* ProjectSelector removed - environment filtering now handled per-page */}
            </div>

            {user ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {profile?.role === 'ADMIN' && <BalanceIndicator />}
                    {profile && hasMinRole(profile.role, 'CORE') && (
                        <SimilarityFlagsButton openCount={openFlagCount} flagsUrl={`${coreBaseUrl}/similarity-flags`} />
                    )}
                    {profile && hasMinRole(profile.role, 'FLEET') && (
                        <ReviewRequestedButton count={reviewRequestedCount} workforceUrl={`${fleetBaseUrl}/workforce-monitoring`} />
                    )}
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
