import Ingestion from '@/components/Ingestion';
import { createClient } from '@repo/auth/server';
import { prisma } from '@repo/database';
import { redirect } from 'next/navigation';

export const metadata = {
    title: 'Ingest | Task Data',
    description: 'Upload tasks and feedback.',
};

export default async function IngestPage() {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        redirect('/login');
    }

    // Check user role
    const profile = await prisma.profile.findUnique({
        where: { id: user.id },
        select: { role: true }
    });

    // Only allow ADMIN and FLEET roles
    if (!profile || (profile.role !== 'ADMIN' && profile.role !== 'FLEET')) {
        redirect('/');
    }

    return (
        <main style={{ padding: '40px 0' }}>
            <Ingestion />
        </main>
    );
}
