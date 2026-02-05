-- Fix projects table id column to have default value
-- This matches the Prisma schema expectation: @default(dbgenerated("gen_random_uuid()::text"))

ALTER TABLE public.projects
ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
