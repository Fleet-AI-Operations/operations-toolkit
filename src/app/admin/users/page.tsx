
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { updateUserRole } from './actions'

export default async function AdminUsersPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    const profile = await prisma.profile.findUnique({
        where: { id: user.id }
    })

    if (profile?.role !== 'ADMIN') {
        return (
            <div className="container" style={{ textAlign: 'center', marginTop: '100px' }}>
                <h1 style={{ color: 'var(--error)' }}>Access Denied</h1>
                <p style={{ color: 'rgba(255, 255, 255, 0.6)' }}>Only administrators can access this area.</p>
            </div>
        )
    }

    const allUsers = await prisma.profile.findMany({
        orderBy: { createdAt: 'desc' }
    })

    return (
        <div className="container">
            <h1 className="premium-gradient" style={{ marginBottom: '8px' }}>User Management</h1>
            <p style={{ color: 'rgba(255, 255, 255, 0.6)', marginBottom: '40px' }}>
                Delegate roles and manage system access.
            </p>

            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'rgba(255, 255, 255, 0.03)' }}>
                        <tr>
                            <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.4)' }}>Email</th>
                            <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.4)' }}>Role</th>
                            <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.4)' }}>Joined</th>
                            <th style={{ textAlign: 'right', padding: '16px 24px', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.4)' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {allUsers.map((u) => (
                            <tr key={u.id} style={{ borderTop: '1px solid var(--border)' }}>
                                <td style={{ padding: '20px 24px', fontWeight: '500' }}>{u.email}</td>
                                <td style={{ padding: '20px 24px' }}>
                                    <span style={{ 
                                        fontSize: '0.7rem', 
                                        padding: '4px 8px', 
                                        borderRadius: '4px',
                                        background: u.role === 'ADMIN' ? 'rgba(0, 112, 243, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                        color: u.role === 'ADMIN' ? 'var(--accent)' : 'inherit',
                                        fontWeight: 'bold'
                                    }}>
                                        {u.role}
                                    </span>
                                </td>
                                <td style={{ padding: '20px 24px', color: 'rgba(255, 255, 255, 0.4)', fontSize: '0.9rem' }}>
                                    {new Date(u.createdAt).toLocaleDateString()}
                                </td>
                                <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                                    <form action={async (formData) => {
                                        'use server'
                                        const newRole = formData.get('role') as any
                                        await updateUserRole(u.id, newRole)
                                    }} style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                        <select 
                                            name="role" 
                                            defaultValue={u.role} 
                                            className="input-field" 
                                            style={{ width: '120px', padding: '6px 10px', fontSize: '0.85rem' }}
                                        >
                                            <option value="USER">USER</option>
                                            <option value="MANAGER">MANAGER</option>
                                            <option value="ADMIN">ADMIN</option>
                                        </select>
                                        <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                                            Update
                                        </button>
                                    </form>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
