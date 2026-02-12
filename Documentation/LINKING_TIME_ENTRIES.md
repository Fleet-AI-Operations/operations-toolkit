# Linking Time Entries to New Users

## Overview

When time entries are created via the browser extension for users who don't exist yet, they are stored with a `NULL` userId and the user's email address. When the user account is eventually created, these entries need to be linked to the new user.

## Automatic Linking (Recommended)

The best approach is to automatically link time entries when a new user is created. This can be done in the user creation endpoint.

### Implementation Example

Add this to your user creation logic (in `/apps/admin/src/app/api/admin/users/route.ts` or wherever users are created):

```typescript
// After creating the user in Supabase and the profile
const profile = await prisma.profile.create({
  data: {
    id: newUser.id,
    email: email.toLowerCase(),
    role: role,
  },
});

// Link any existing time entries to this user
const linkedEntries = await prisma.timeEntry.updateMany({
  where: {
    email: email.toLowerCase(),
    userId: null,
  },
  data: {
    userId: profile.id,
  },
});

console.log(`Linked ${linkedEntries.count} time entries to new user ${email}`);
```

## Manual Linking (Database Query)

If you need to manually link time entries for a specific user, you can run this SQL query:

```sql
-- Link time entries for a specific email
UPDATE public.time_entries
SET user_id = (SELECT id FROM public.profiles WHERE email = 'user@example.com')
WHERE email = 'user@example.com'
  AND user_id IS NULL;
```

## Bulk Linking (All Unlinked Entries)

To link all unlinked time entries to their respective users in bulk:

```sql
-- Link all unlinked entries where a matching user exists
UPDATE public.time_entries te
SET user_id = p.id
FROM public.profiles p
WHERE te.email = p.email
  AND te.user_id IS NULL;
```

## Viewing Unlinked Entries

To see how many time entries are waiting to be linked:

```sql
-- Count unlinked entries by email
SELECT email, COUNT(*) as entry_count
FROM public.time_entries
WHERE user_id IS NULL
GROUP BY email
ORDER BY entry_count DESC;
```

## API Endpoint for Viewing Time Entries

Users can view their time entries (both linked and unlinked) via the authenticated endpoint:

```
GET /api/time-entries?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
```

The Row Level Security (RLS) policies ensure users can see:
1. Entries where `user_id` matches their ID
2. Entries where `email` matches their profile email (even if `user_id` is NULL)

This means when a user logs in, they'll automatically see all their time entries, including those created before their account existed.

## Best Practices

1. **Always link immediately**: Link time entries as part of the user creation transaction
2. **Log linking activity**: Keep track of how many entries were linked for auditing
3. **Validate emails**: Ensure email consistency (lowercase) to prevent linking failures
4. **Monitor unlinked entries**: Periodically check for orphaned time entries

## Example: Automatic Linking in User Creation Flow

```typescript
// apps/admin/src/app/api/admin/users/route.ts (example)

export async function POST(request: NextRequest) {
  try {
    const { email, role, tempPassword } = await request.json();

    // Create user in Supabase Auth
    const { data: newUser, error } = await supabase.auth.admin.createUser({
      email: email.toLowerCase(),
      password: tempPassword,
      email_confirm: true,
    });

    if (error || !newUser.user) {
      return NextResponse.json({ error: error?.message }, { status: 400 });
    }

    // Create profile
    const profile = await prisma.profile.create({
      data: {
        id: newUser.user.id,
        email: email.toLowerCase(),
        role,
        mustResetPassword: true,
      },
    });

    // 🔗 Link existing time entries
    const linkedResult = await prisma.timeEntry.updateMany({
      where: {
        email: email.toLowerCase(),
        userId: null,
      },
      data: {
        userId: profile.id,
      },
    });

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        id: cuid(),
        action: 'USER_CREATED',
        entityType: 'profile',
        entityId: profile.id,
        userId: profile.id,
        userEmail: profile.email,
        metadata: {
          role,
          linkedTimeEntries: linkedResult.count,
        },
      },
    });

    return NextResponse.json({
      success: true,
      user: profile,
      linkedTimeEntries: linkedResult.count,
    });

  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
```

## Troubleshooting

### Entries Not Linking

**Problem**: Time entries aren't being linked when users are created.

**Solution**: Check for case sensitivity issues in email addresses:

```sql
-- Find mismatched cases
SELECT DISTINCT te.email, p.email
FROM public.time_entries te
LEFT JOIN public.profiles p ON LOWER(te.email) = LOWER(p.email)
WHERE te.user_id IS NULL
  AND p.email IS NOT NULL;
```

If found, fix with:

```sql
-- Fix case sensitivity
UPDATE public.time_entries te
SET user_id = p.id
FROM public.profiles p
WHERE LOWER(te.email) = LOWER(p.email)
  AND te.user_id IS NULL;
```

### Duplicate Entries

**Problem**: Same email has entries with both NULL and non-NULL userId.

**Solution**: This is expected! It means some entries were created before the user existed (NULL) and some after (non-NULL). The linking process should convert all NULL entries to use the userId.

## Monitoring Query

Run this periodically to monitor linking health:

```sql
-- Health check for time entry linking
SELECT
  'Total Entries' as metric,
  COUNT(*) as count
FROM public.time_entries

UNION ALL

SELECT
  'Linked Entries' as metric,
  COUNT(*) as count
FROM public.time_entries
WHERE user_id IS NOT NULL

UNION ALL

SELECT
  'Unlinked Entries' as metric,
  COUNT(*) as count
FROM public.time_entries
WHERE user_id IS NULL

UNION ALL

SELECT
  'Unlinked with Existing User' as metric,
  COUNT(*) as count
FROM public.time_entries te
INNER JOIN public.profiles p ON LOWER(te.email) = LOWER(p.email)
WHERE te.user_id IS NULL;
```

The last metric ("Unlinked with Existing User") should ideally be 0 - if it's not, run the bulk linking query to fix it.
