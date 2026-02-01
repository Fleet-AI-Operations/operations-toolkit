'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TimeTrackingPage() {
    const router = useRouter();

    useEffect(() => {
        // Redirect to bonus windows by default
        router.push('/time-tracking/bonus-windows');
    }, [router]);

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
            <div style={{ textAlign: 'center' }}>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '16px', opacity: 0.6 }}>
                    Redirecting...
                </h2>
            </div>
        </div>
    );
}
