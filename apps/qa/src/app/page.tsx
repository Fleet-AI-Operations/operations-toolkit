import { redirect } from 'next/navigation';
import { createClient } from '@repo/auth/server';

export default async function QAPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>QA App</h1>
      <p>Welcome to the QA application.</p>
      <ul>
        <li>Port: 3002</li>
        <li>Role Required: QA+</li>
        <li>Features: Dashboard, Top/Bottom 10, Top Prompts, Records, Similarity</li>
      </ul>
    </div>
  );
}
