export default function AdminPage() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Admin App</h1>
      <p>Welcome to the Admin application.</p>
      <ul>
        <li>Port: 3005</li>
        <li>Role Required: ADMIN</li>
        <li>Features: User Management, System Settings, LLM Config</li>
      </ul>
    </div>
  );
}
