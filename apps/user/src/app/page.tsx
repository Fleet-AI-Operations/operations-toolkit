import { redirect } from 'next/navigation';
import { createClient } from '@repo/auth/server';

export default async function UserPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>User App</h1>
      <p>Welcome to the User application.</p>
      <ul>
        <li>Port: 3001</li>
        <li>Role Required: USER+</li>
        <li>Features: Dashboard, Links, Time Tracking (coming soon)</li>
      </ul>
    </div>
  );
}
