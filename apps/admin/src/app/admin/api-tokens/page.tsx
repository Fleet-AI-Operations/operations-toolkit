import { redirect } from 'next/navigation';
import { createClient } from '@repo/auth/server';
import { getUserRole } from '@repo/auth/utils';
import ApiTokensClient from './ApiTokensClient';

export default async function ApiTokensPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    const role = await getUserRole(user.id);
    if (role !== 'ADMIN') {
        redirect('/');
    }

    return <ApiTokensClient />;
}
