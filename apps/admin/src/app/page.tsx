import { redirect } from 'next/navigation';
import { createClient } from '@repo/auth/server';

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Redirect to Bug Reports as the default page
  redirect('/bug-reports');
}
