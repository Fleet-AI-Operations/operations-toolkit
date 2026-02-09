import { redirect } from 'next/navigation';
import { createClient } from '@repo/auth/server';

export default async function FleetPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Fleet App</h1>
      <p>Welcome to the Fleet application.</p>
      <ul>
        <li>Port: 3004</li>
        <li>Role Required: FLEET+</li>
        <li>Features: Data Ingestion, Project Management, Analytics, Bonus Windows, Activity Tracking</li>
      </ul>
    </div>
  );
}
