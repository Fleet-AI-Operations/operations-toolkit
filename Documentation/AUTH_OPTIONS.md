# Authentication in Operations Tools

The project uses **Supabase Auth (SSR)** as its core authentication and authorization engine.

## Current Implementation: Supabase Auth

This is the fully implemented authentication strategy in the codebase.

- **Infrastructure**: Powered by `@supabase/ssr` with a custom `profiles` table in Prisma for role management.
- **Workflow**:
  - **Email/Password**: Standard signup and login flows are implemented.
  - **Middleware**: Directs users based on their session status, approval state (`PENDING` role), and `mustResetPassword` flag.
  - **Server Actions**: Mutations (like password resets) are handled via Next.js Server Actions for reliability.
  - **Security**: Supabase Row Level Security (RLS) is used as a foundation, with Server Actions and the Admin client providing secure bypasses for system tasks.

## Alternatives (Not Implemented)

While the system is optimized for Supabase, other strategies were considered:

### 1. Auth.js (NextAuth.js)

A flexible library for multiple providers. We chose Supabase because it provided the database and auth in a single, well-integrated package.

### 2. Clerk

A managed service that was considered for ease of use. Supabase was selected to keep the data layer (PostgreSQL) and the identity layer tightly coupled and potentially more cost-effective for high-volume use.

### 3. Custom Auth

Building a session manager from scratch was rejected due to security risks and the high maintenance overhead compared to using a battle-tested service like Supabase.

---

### Verification

If you need to verify or extend the authentication system:

1. Check `src/lib/supabase/` for client/server initialization.
2. Check `src/middleware.ts` for routing and session protection.
3. Check `src/app/auth/` for the implementation of signup, login, and password reset.
4. Check `src/app/auth/reset-password/actions.ts` for secure mutations.
