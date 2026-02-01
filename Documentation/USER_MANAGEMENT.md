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
| **MANAGER** | Can manage projects and ingestion jobs. Has access to Time Tracking and Bonus Windows to monitor team performance. |
| **ADMIN** | Full system control, including user creation, role management, system configuration, and all MANAGER capabilities. |

## 3. User Management (Admins)

Administrators can manage users via the **Admin → User Management** page:

- **Create Users**: Add new users with temporary passwords
- **Change Roles**: Promote or demote users between USER, MANAGER, and ADMIN
- **Reset Passwords**: Set new temporary passwords for users (forces password change on next login)

## 5. Self-Service Password Change

Users can change their own passwords at any time without administrator intervention:

1. Click on your **Email/Username** in the top-right header to open the profile dropdown.
2. Select **Change Password**.
3. Enter and confirm your new password in the modal dialog.
4. Click **Update Password**.

## 6. Implementation Summary

- Database: `profiles` table in the `public` schema.
- Middleware: Intercepts requests to check for `PENDING` or `mustResetPassword` states.
- Server Actions: Securely clear flags and update roles using the `SUPABASE_SERVICE_ROLE_KEY` to bypass Row Level Security (RLS) when necessary.
