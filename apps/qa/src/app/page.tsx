import { redirect } from 'next/navigation';
import { createClient } from '@repo/auth/server';

export default async function QAPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Redirect to Records page (QA app landing page)
  redirect('/records');
}
