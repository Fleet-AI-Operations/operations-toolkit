import { redirect } from 'next/navigation';
import { createClient } from '@repo/auth/server';

export default async function CorePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Core App</h1>
      <p>Welcome to the Core application.</p>
      <ul>
        <li>Port: 3003</li>
        <li>Role Required: CORE+</li>
        <li>Features: Likert Scoring, Candidate Review, My Assignments</li>
      </ul>
    </div>
  );
}
