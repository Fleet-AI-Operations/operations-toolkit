import { redirect } from 'next/navigation';
import { createClient } from '@repo/auth/server';

export default async function FleetPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Redirect to Analytics page (Fleet app landing page)
  redirect('/analytics');
}
