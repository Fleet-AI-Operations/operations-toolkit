import { redirect } from 'next/navigation';
import { createClient } from '@repo/auth/server';

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Admin App</h1>
      <p>Welcome to the Admin application.</p>
      <ul>
        <li>Port: 3005</li>
        <li>Role Required: ADMIN</li>
        <li>Features: User Management, System Settings, Rater Management, Bug Reports</li>
      </ul>
    </div>
  );
}
