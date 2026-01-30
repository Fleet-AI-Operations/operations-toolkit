# User Management & Access Delegation

The Operations Tools uses a hybrid authentication and authorization system. **Supabase Auth** handles identities (emails/passwords), while a **Prisma-managed `profiles` table** handles application-specific roles and access states.

## 1. Automated Onboarding (The Approval Flow)

To ensure security, new signups follow a strict approval workflow:

1. Signup: User creates an account via the `/auth/signup` page.
2. Pending State: The user is assigned the `PENDING` role by default.
3. Waiting Room: Middleware detects the `PENDING` role and redirects the user to `/waiting-approval`. They cannot access any dashboard features.
4. Admin Approval: An administrator visits the **User Management** page to review and approve the user.

## 2. Access Roles

Access is governed by the `role` field in the `profiles` table:

| Role | Description |
| :--- | :--- |
| **PENDING** | Default for new users. Restricted to the `/waiting-approval` page. |
| **USER** | Can view data and run analyses. |
| **MANAGER** | Can manage projects and ingestion jobs. |
| **ADMIN** | Full system control, including role delegation and user approval. |

## 3. Delegation Workflow (Admins)

Administrators can manage users via the **Manage -> Users** section:

- Approval: Change a user's role from `PENDING` to `USER` to grant access.
- Promotion: Elevate trusted users to `MANAGER` or `ADMIN`.
- Manual Creation: Admins can use the "Create User" feature to manually invite users.

## 4. Security: First-Time Login (Password Reset)

When an admin manually creates a user, or when a reset is required for security:

1. The `mustResetPassword` flag is set to `true` in the user's profile.
2. **Force Redirect**: Middleware detects this flag and redirects the user to `/auth/reset-password`.
3. **Action**: The user MUST set a new password.
4. **Completion**: Once the password is saved, a **Server Action** clears the flag, and the user is granted access to the dashboard.

## 5. Implementation Summary

- Database: `profiles` table in the `public` schema.
- Middleware: Intercepts requests to check for `PENDING` or `mustResetPassword` states.
- Server Actions: Securely clear flags and update roles using the `SUPABASE_SERVICE_ROLE_KEY` to bypass Row Level Security (RLS) when necessary.
