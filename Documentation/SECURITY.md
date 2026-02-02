# Security & Best Practices

Complete security guide for the Operations Tools application covering authentication, authorization, data privacy, API security, and deployment best practices.

## Table of Contents

- [Authentication](#authentication)
- [Authorization](#authorization)
- [Data Privacy](#data-privacy)
- [API Security](#api-security)
- [Database Security](#database-security)
- [Deployment Security](#deployment-security)
- [Development Best Practices](#development-best-practices)
- [Security Checklist](#security-checklist)
- [Incident Response](#incident-response)

---

## Authentication

### Supabase Auth

The application uses Supabase Auth for user authentication with the following security features:

**Password Requirements**:
- Minimum 8 characters
- Enforced by Supabase Auth
- Admins can force password resets via `mustResetPassword` flag

**Session Management**:
- Server-side session handling via `src/lib/supabase/server.ts`
- Client-side session handling via `src/lib/supabase/client.ts`
- Secure cookie-based sessions
- Automatic session refresh

**No Self-Service Signup**:
- User creation is admin-only
- Reduces risk of spam accounts
- Implemented via Admin → User Management page

### Authentication Flow

1. User submits credentials to `/api/auth/login`
2. Supabase Auth validates credentials
3. Session created with secure cookies
4. Middleware validates session on subsequent requests
5. Session refreshed automatically before expiration

### Best Practices

✅ **Do:**
- Use server-side session validation for protected routes
- Implement automatic session refresh
- Use secure, httpOnly cookies
- Force password resets for compromised accounts

❌ **Don't:**
- Store passwords in plaintext
- Allow weak passwords
- Skip session validation
- Use localStorage for sensitive tokens

---

## Authorization

### Role-Based Access Control (RBAC)

The application implements RBAC with three roles:

| Role | Permissions |
|------|-------------|
| **PENDING** | No access (awaiting approval) |
| **USER** | Read data, generate analyses, view projects |
| **MANAGER** | USER + time tracking, bonus windows |
| **ADMIN** | MANAGER + user management, settings, bulk operations |

### Role Enforcement

**Server-Side** (Required):
```typescript
// src/app/api/admin/users/route.ts
import { checkUserRole } from '@/lib/auth-helpers';

export async function POST(request: Request) {
  const user = await checkUserRole(['ADMIN']);
  if (!user) {
    return new Response('Forbidden', { status: 403 });
  }
  // Admin-only logic
}
```

**Client-Side** (UI only):
```typescript
// components/AdminNav.tsx
{session?.user?.role === 'ADMIN' && (
  <Link href="/admin/users">User Management</Link>
)}
```

**Important**: Never rely on client-side checks alone. Always validate on the server.

### Row Level Security (RLS)

Supabase RLS policies protect data at the database level:

```sql
-- Example: Users can only see their own profiles
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

-- Example: Only admins can update user roles
CREATE POLICY "Admins can update profiles"
ON profiles FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'ADMIN'
  )
);
```

---

## Data Privacy

### Local-First Architecture

The application processes all data locally to ensure maximum privacy:

- **LM Studio (Local)**: AI runs on user's machine, no data leaves the device
- **OpenRouter (Cloud)**: Optional cloud AI with explicit user consent
- **Database**: Local Supabase or self-hosted PostgreSQL

### Sensitive Data Handling

**Guidelines PDF**:
- Stored as base64-encoded text in database
- Never sent to third parties (used only for local RAG)
- Can be deleted by project owner

**User Data**:
- Emails visible only to admins
- Passwords hashed by Supabase Auth
- No tracking or analytics (unless explicitly enabled)

**API Keys**:
- OpenRouter API key encrypted in database
- Service role keys in environment variables only
- Never exposed to client

### GDPR Compliance

**User Rights**:
- Right to access: Users can export their data via API
- Right to deletion: Admins can delete user accounts
- Right to rectification: Users can update their profiles

**Data Retention**:
- User data retained indefinitely unless deleted
- Logs rotated automatically (not persisted)
- No third-party data sharing

---

## API Security

### Input Validation

**Always validate and sanitize user input:**

```typescript
// Good: Validate input
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
});

const result = schema.safeParse(req.body);
if (!result.success) {
  return new Response('Invalid input', { status: 400 });
}
```

### SQL Injection Prevention

**Use Prisma parameterized queries:**

```typescript
// Good: Parameterized query
const users = await prisma.profile.findMany({
  where: { email: userEmail },
});

// Bad: Never concatenate SQL
// const users = await prisma.$queryRaw`SELECT * FROM profiles WHERE email = '${userEmail}'`;
```

### XSS Prevention

**Sanitize HTML output** (if displaying user-generated content):

```typescript
import DOMPurify from 'isomorphic-dompurify';

// Sanitize user content before displaying
const cleanContent = DOMPurify.sanitize(userContent);
```

**React automatically escapes JSX** - but be careful with:
- `dangerouslySetInnerHTML` (avoid if possible)
- Direct DOM manipulation
- Third-party libraries

### CSRF Protection

Next.js includes built-in CSRF protection for:
- Server Actions
- Form submissions

**For custom API routes:**
```typescript
// Verify request origin
const origin = request.headers.get('origin');
const host = request.headers.get('host');

if (origin && !origin.includes(host)) {
  return new Response('Invalid origin', { status: 403 });
}
```

### Rate Limiting

**Consider adding rate limiting for:**
- Authentication endpoints (prevent brute force)
- AI generation endpoints (prevent abuse)
- User creation endpoints (prevent spam)

Example with Upstash:
```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'),
});

const { success } = await ratelimit.limit(userId);
if (!success) {
  return new Response('Too many requests', { status: 429 });
}
```

---

## Database Security

### Connection Security

**Use SSL for production**:
```bash
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
```

**Environment variables**:
- Never commit `.env.local` to git
- Use Vercel environment variables for production
- Rotate credentials regularly

### Access Control

**Principle of Least Privilege**:
- Application uses `postgres` user (full access)
- Consider creating app-specific user with limited permissions
- Service role key for admin operations only

**Network Security**:
- Local Supabase: Accessible only from localhost
- Production: Restrict access by IP if possible
- Use VPN for remote database access

### Backup & Recovery

**Local Development**:
```bash
# Backup
supabase db dump -f backup.sql

# Restore
supabase db reset --db-url <connection-string>
psql <connection-string> < backup.sql
```

**Production (Supabase Cloud)**:
- Automatic daily backups (retained 7 days)
- Manual backups via Supabase Dashboard
- Point-in-time recovery on paid plans

---

## Deployment Security

### Environment Variables

**Required secrets** (never commit):
```bash
DATABASE_URL                      # Database connection string
SUPABASE_SERVICE_ROLE_KEY        # Admin access to Supabase
OPENROUTER_API_KEY               # OpenRouter API key (if using)
```

**Public variables** (safe to commit):
```bash
NEXT_PUBLIC_SUPABASE_URL         # Supabase project URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  # Publishable key
```

### Vercel Security

**Security Headers**:
```javascript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};
```

**Environment-specific configs**:
- Development: Detailed errors, verbose logging
- Production: Generic errors, minimal logging
- Staging: Similar to production with test data

### HTTPS

**Production**:
- Vercel provides free SSL certificates
- Automatic HTTPS redirect

**Local**:
- Use `http://localhost` (HTTPS not needed)
- Use `vercel dev` for production-like environment

---

## Development Best Practices

### Secure Coding Guidelines

**1. Input Validation**:
- Validate all user input
- Use TypeScript for type safety
- Use Zod for runtime validation

**2. Output Encoding**:
- React escapes JSX automatically
- Sanitize HTML if using `dangerouslySetInnerHTML`
- Encode JSON responses properly

**3. Error Handling**:
```typescript
// Good: Generic error message to user
try {
  await riskyOperation();
} catch (error) {
  console.error('Operation failed:', error); // Log details
  return new Response('An error occurred', { status: 500 }); // Generic to user
}

// Bad: Exposing internal details
// return new Response(error.message, { status: 500 });
```

**4. Logging**:
```typescript
// Good: Log action, not sensitive data
console.log('User login attempt', { userId: user.id });

// Bad: Logging passwords or tokens
// console.log('User login attempt', { email, password });
```

### Dependency Management

**Keep dependencies updated**:
```bash
# Check for updates
npm outdated

# Update dependencies
npm update

# Check for security vulnerabilities
npm audit

# Fix vulnerabilities automatically
npm audit fix
```

**Review before updating**:
- Read changelogs
- Test in development first
- Check for breaking changes

### Code Review

**Security checklist for code reviews**:
- [ ] Authentication checks on all protected routes
- [ ] Input validation on all user inputs
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (proper escaping)
- [ ] Authorization checks for sensitive operations
- [ ] No hardcoded secrets
- [ ] Error messages don't expose internals
- [ ] Logging doesn't include sensitive data

---

## Security Checklist

### Pre-Deployment

- [ ] All environment variables configured
- [ ] Database connection uses SSL
- [ ] Security headers configured
- [ ] Authentication working on all protected routes
- [ ] Authorization enforced server-side
- [ ] RLS policies tested
- [ ] No secrets in git history
- [ ] Dependencies updated and audited
- [ ] Error handling doesn't expose internals

### Production Monitoring

- [ ] Monitor failed login attempts
- [ ] Track API usage for anomalies
- [ ] Review database query performance
- [ ] Check logs for errors
- [ ] Monitor AI API costs (if using OpenRouter)
- [ ] Review RLS policy effectiveness

### Regular Maintenance

**Weekly**:
- Review application logs
- Check for failed authentication attempts
- Monitor API response times

**Monthly**:
- Update dependencies
- Review access logs
- Audit user roles and permissions
- Rotate API keys if needed

**Quarterly**:
- Security audit of codebase
- Review and update RLS policies
- Test backup/restore procedures
- Update documentation

---

## Incident Response

### If You Suspect a Security Issue

**1. Identify the Issue**:
- What happened?
- When did it happen?
- Who is affected?
- What data is at risk?

**2. Contain the Threat**:
- Disable affected accounts
- Revoke compromised API keys
- Block suspicious IP addresses
- Take affected features offline if needed

**3. Investigate**:
- Review application logs
- Check database audit logs
- Identify root cause
- Assess scope of breach

**4. Remediate**:
- Fix the vulnerability
- Update affected systems
- Force password resets if needed
- Restore from backup if necessary

**5. Notify**:
- Inform affected users
- Report to relevant authorities (if required)
- Document the incident

**6. Post-Mortem**:
- Write incident report
- Identify lessons learned
- Update security procedures
- Implement additional safeguards

### Reporting Security Vulnerabilities

If you discover a security vulnerability:

1. **Do not** disclose publicly
2. Email the security team with details
3. Allow time for patching before disclosure
4. Coordinate disclosure timeline

---

## Related Documentation

- [API Reference](./Reference/API_REFERENCE.md) - Authentication requirements for each endpoint
- [Database Schema](./Reference/DATABASE_SCHEMA.md) - RLS policies and access controls
- [User Management](./USER_MANAGEMENT.md) - User roles and permissions
- [Troubleshooting](./TROUBLESHOOTING.md) - Security-related issues

---

*Last Updated: 2024-02-02*
