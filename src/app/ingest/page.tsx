import Ingestion from '@/components/Ingestion';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/permissions';

export const metadata = {
    title: 'Ingest | Task Data',
    description: 'Upload tasks and feedback.',
};

export default async function IngestPage() {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        redirect('/auth/login');
    }

    // Check user role
    const profile = await prisma.profile.findUnique({
        where: { id: user.id },
        select: { role: true }
    });

    // Only allow FLEET role and above
    if (!profile || !hasPermission(profile.role, 'FLEET')) {
        redirect('/');
    }

    return (
        <main style={{ padding: '40px 0' }}>
            <Ingestion />
        </main>
    );
}
