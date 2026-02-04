-- Seed file for local development and preview environments
-- Creates test users with known passwords for each role

-- IMPORTANT: These are test credentials. Never use in production!

-- Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- SAFETY CHECK: Prevent running in production
-- Uses opt-in approach: databases must explicitly allow seeding
-- To enable: ALTER DATABASE postgres SET app.seed_allowed = 'true';
DO $$
DECLARE
    is_seed_allowed BOOLEAN;
BEGIN
    -- Check if seeding is explicitly allowed
    -- Databases must opt-in by setting app.seed_allowed = 'true'
    BEGIN
        is_seed_allowed := current_setting('app.seed_allowed', TRUE) = 'true';
    EXCEPTION
        WHEN OTHERS THEN
            is_seed_allowed := FALSE;
    END;

    -- Block seeding unless explicitly allowed
    IF NOT is_seed_allowed THEN
        RAISE EXCEPTION 'SEED BLOCKED: Database does not have app.seed_allowed = ''true''. This file contains test credentials and should only run in development/preview environments. To enable: ALTER DATABASE postgres SET app.seed_allowed = ''true'';';
    END IF;

    -- Additional check: warn if database URL contains 'supabase.co' (cloud hosting)
    IF current_database() != 'postgres' THEN
        RAISE WARNING 'Running seed data on database: %. This should only be used in dev/preview.', current_database();
    END IF;

    RAISE NOTICE 'SEED SAFETY CHECK PASSED: Seeding allowed on database %', current_database();
END $$;

-- Clean up existing seed users if they exist
DO $$
BEGIN
    -- Delete projects owned by seed users first (to avoid FK constraint issues)
    DELETE FROM public."Project"
    WHERE "ownerId" IN (
        SELECT id FROM public.profiles
        WHERE email IN (
            'admin@test.com',
            'manager@test.com',
            'user@test.com'
        )
    );

    -- Delete profiles
    DELETE FROM public.profiles
    WHERE email IN (
        'admin@test.com',
        'manager@test.com',
        'user@test.com'
    );

    -- Delete auth users
    DELETE FROM auth.users
    WHERE email IN (
        'admin@test.com',
        'manager@test.com',
        'user@test.com'
    );
END $$;

-- Insert test users into auth.users
-- Password for all test users: "test"
-- Using crypt function to hash passwords (requires pgcrypto extension)
INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    role,
    aud
) VALUES
    -- Admin user
    (
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000000',
        'admin@test.com',
        crypt('test', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider":"email","providers":["email"]}',
        '{}',
        false,
        'authenticated',
        'authenticated'
    ),
    -- Manager user
    (
        '00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000000',
        'manager@test.com',
        crypt('test', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider":"email","providers":["email"]}',
        '{}',
        false,
        'authenticated',
        'authenticated'
    ),
    -- Regular user
    (
        '00000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000000',
        'user@test.com',
        crypt('test', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider":"email","providers":["email"]}',
        '{}',
        false,
        'authenticated',
        'authenticated'
    )
ON CONFLICT (id) DO NOTHING;

-- The trigger will automatically create profiles, but we'll update their roles
-- Wait a moment for trigger to execute, then update roles
DO $$
BEGIN
    -- Small delay to ensure trigger has executed
    PERFORM pg_sleep(0.1);

    -- Update or insert profiles with correct roles
    INSERT INTO public.profiles (id, email, role, "createdAt", "updatedAt")
    VALUES
        ('00000000-0000-0000-0000-000000000001', 'admin@test.com', 'ADMIN', NOW(), NOW()),
        ('00000000-0000-0000-0000-000000000002', 'manager@test.com', 'MANAGER', NOW(), NOW()),
        ('00000000-0000-0000-0000-000000000003', 'user@test.com', 'USER', NOW(), NOW())
    ON CONFLICT (id)
    DO UPDATE SET
        role = EXCLUDED.role,
        "updatedAt" = NOW();
END $$;

-- Verify seed data was created
DO $$
DECLARE
    user_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM public.profiles
    WHERE email IN ('admin@test.com', 'manager@test.com', 'user@test.com');

    RAISE NOTICE 'Seed complete: % test users created', user_count;
END $$;
