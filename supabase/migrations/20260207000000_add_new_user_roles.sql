-- Add new user roles: QA, CORE, FLEET
-- This migration adds the new role hierarchy while maintaining backwards compatibility with MANAGER

-- Add new enum values to UserRole
ALTER TYPE "public"."UserRole" ADD VALUE IF NOT EXISTS 'QA';
ALTER TYPE "public"."UserRole" ADD VALUE IF NOT EXISTS 'CORE';
ALTER TYPE "public"."UserRole" ADD VALUE IF NOT EXISTS 'FLEET';

-- Note: MANAGER is kept for backwards compatibility
-- Future migrations may migrate MANAGER users to FLEET

-- Optionally migrate existing MANAGER users to FLEET
-- Uncomment the line below if you want to migrate now:
-- UPDATE public.profiles SET role = 'FLEET' WHERE role = 'MANAGER';
