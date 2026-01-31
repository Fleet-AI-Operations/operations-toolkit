'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
    const router = useRouter();

    useEffect(() => {
        // Redirect to AI settings by default
        router.push('/admin/ai-settings');
    }, [router]);

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
            <div style={{ textAlign: 'center' }}>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '16px', opacity: 0.6 }}>
                    Redirecting to admin console...
                </h2>
            </div>
        </div>
    );
}
