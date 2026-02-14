import { redirect } from 'next/navigation';
import { createClient } from '@repo/auth/server';

export default async function UserPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Redirect to Time Tracking page (User app landing page)
  redirect('/time-tracking');
}
