-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create enum types
CREATE TYPE "UserRole" AS ENUM ('PENDING', 'USER', 'MANAGER', 'ADMIN');
CREATE TYPE "RecordType" AS ENUM ('TASK', 'FEEDBACK');
CREATE TYPE "RecordCategory" AS ENUM ('TOP_10', 'BOTTOM_10');

-- Create profiles table (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role "UserRole" DEFAULT 'PENDING'::"UserRole" NOT NULL,
  "mustResetPassword" BOOLEAN DEFAULT FALSE NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  "ownerId" UUID REFERENCES public.profiles(id),
  "lastTaskAnalysis" TEXT,
  "lastFeedbackAnalysis" TEXT,
  guidelines TEXT,
  "guidelinesFileName" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create analytics_jobs table
CREATE TABLE IF NOT EXISTS public.analytics_jobs (
  id TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'PENDING' NOT NULL,
  "totalRecords" INTEGER DEFAULT 0 NOT NULL,
  "processedCount" INTEGER DEFAULT 0 NOT NULL,
  error TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create data_records table
CREATE TABLE IF NOT EXISTS public.data_records (
  id TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  type "RecordType" NOT NULL,
  category "RecordCategory",
  source TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  embedding vector(1536), -- pgvector type for semantic search (1536 dimensions for text-embedding-3-small)
  "hasBeenReviewed" BOOLEAN DEFAULT FALSE NOT NULL,
  "isCategoryCorrect" BOOLEAN,
  "reviewedBy" TEXT,
  "alignmentAnalysis" TEXT,
  "ingestJobId" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create ingest_jobs table
CREATE TABLE IF NOT EXISTS public.ingest_jobs (
  id TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  type "RecordType" NOT NULL,
  status TEXT DEFAULT 'PENDING' NOT NULL,
  "totalRecords" INTEGER DEFAULT 0 NOT NULL,
  "savedCount" INTEGER DEFAULT 0 NOT NULL,
  "skippedCount" INTEGER DEFAULT 0 NOT NULL,
  "skippedDetails" JSONB,
  error TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create system_settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_data_records_project ON public.data_records("projectId");
CREATE INDEX IF NOT EXISTS idx_data_records_type ON public.data_records(type);
CREATE INDEX IF NOT EXISTS idx_data_records_category ON public.data_records(category);
-- Vector similarity search index (ivfflat with cosine distance for semantic search)
CREATE INDEX IF NOT EXISTS idx_data_records_embedding ON public.data_records USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_ingest_jobs_project ON public.ingest_jobs("projectId");
CREATE INDEX IF NOT EXISTS idx_analytics_jobs_project ON public.analytics_jobs("projectId");

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create helper function to check admin status
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'ADMIN'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RLS policies for profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles" ON public.profiles
  FOR ALL USING (public.is_admin());

-- Create function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'PENDING');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signups
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
