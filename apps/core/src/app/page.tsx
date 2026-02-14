import { redirect } from 'next/navigation';
import { createClient } from '@repo/auth/server';

export default async function CorePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Redirect to Likert Scoring page (Core app landing page)
  redirect('/likert-scoring');
}
