# User Management & Access Delegation

In this Supabase + Next.js setup, user management is handled by **Supabase Auth**, while the **application logic** (roles and delegation) is typically managed through custom metadata or a dedicated `profiles` table.

## 1. Where do users live?

-   **Supabase (auth schema)**: The `auth.users` table is managed internally by Supabase. It stores emails, passwords, and sessions. You can view these users in the **Supabase Dashboard -> Authentication -> Users**.
-   **Prisma (public schema)**: To store application-specific data (like a user's name, bio, or custom roles), we should create a `Profile` model that links to the Supabase User ID.

## 2. Managing Roles

There are two primary ways to manage roles like "Admin" or "Manager":

### Option A: Supabase Custom Claims (Recommended)
You can store roles directly in the user's `app_metadata`. This is visible in the JWT, meaning it's accessible in the Next.js Middleware and Supabase RLS policies WITHOUT an extra database query.

**How to delegate:**
An Admin can call a Supabase Edge Function or a Server Action that updates another user's metadata:

```typescript
// Admin promoting another user
const { data, error } = await supabase.auth.admin.updateUserById(
  'user-id-to-promote',
  { app_metadata: { role: 'admin' } }
)
```

### Option B: Profiles Table
Create a `profiles` table in your Prisma schema.

```prisma
model Profile {
  id     String @id // This matches the Supabase User ID
  role   String @default("USER") // USER, MANAGER, ADMIN
  email  String
}
```

**How to delegate:**
Admins simply update the `role` field in the `Profile` table via a Prisma query.

## 3. Delegating Access (Workflow)

To implement delegation for the **Deel Bonus Zone**, follow this flow:

1.  **System Admin**: The first user (typically you) is manually set as `ADMIN` in the Supabase Dashboard.
2.  **Admin UI**: Create an "Organization Management" page where the Admin can see a list of all users.
3.  **Promotion**: Beside each user, add a dropdown to change their role (e.g., Change "User" to "Bonus Manager").
4.  **Verification**:
    -   **UI level**: The `Header.tsx` only shows the "Bonus Zone" link if `user.app_metadata.role === 'admin'`.
    -   **API level**: The middleware or server actions check the role before executing logic.

## 4. Summary of Access Levels

| Role | Access |
| :--- | :--- |
| **User** | View personal dashboard, own records. |
| **Manager** | View assigned projects, configure bonus criteria. |
| **Admin** | Full system access, manage windows, **delegate roles to others**. |

---

### Next Step Recommendation
I recommend implementing a **Profiles** table and a basic **Admin Dashboard** to allow you to manage these roles visually rather than through the console.
