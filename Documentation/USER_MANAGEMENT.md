# User Management & Access Delegation

The Operations Tools uses a hybrid authentication and authorization system. **Supabase Auth** handles identities (emails/passwords), while a **Prisma-managed `profiles` table** handles application-specific roles and access states.

## 1. User Creation (Admin-Only)

For security, **all user accounts must be created by administrators**. Self-service signup has been disabled.

### Creating New Users

1. Navigate to the **Admin → User Management** page
2. Click "Add New User"
3. Enter:
   - Email address
   - Initial temporary password
   - Role (USER, MANAGER, or ADMIN)
4. Click "Create User & Require Password Reset"

The new user will be created with the `mustResetPassword` flag enabled, forcing them to set a new password on first login.

## 2. Access Roles

Access is governed by the `role` field in the `profiles` table:

| Role | Description |
| :--- | :--- |
| **USER** | Can view data and run analyses. |
| **MANAGER** | Can manage projects and ingestion jobs. |
| **ADMIN** | Full system control, including user creation, role management, and system configuration. |

## 3. User Management (Admins)

Administrators can manage users via the **Admin → User Management** page:

- **Create Users**: Add new users with temporary passwords
- **Change Roles**: Promote or demote users between USER, MANAGER, and ADMIN
- **Reset Passwords**: Set new temporary passwords for users (forces password change on next login)

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
