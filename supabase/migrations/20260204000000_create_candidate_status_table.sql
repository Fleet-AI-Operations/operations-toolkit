-- Create CandidateStatus table for tracking candidate acceptance/rejection status

CREATE TABLE IF NOT EXISTS public.candidate_status (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  email TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACCEPTED', 'REJECTED')),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create unique constraint on userId and projectId
ALTER TABLE public.candidate_status
ADD CONSTRAINT candidate_status_userId_projectId_key UNIQUE ("userId", "projectId");

-- Create index on projectId
CREATE INDEX idx_candidate_status_project ON public.candidate_status("projectId");

-- Add foreign key constraint to projects table
ALTER TABLE public.candidate_status
ADD CONSTRAINT fk_candidate_status_project
FOREIGN KEY ("projectId") REFERENCES public.projects(id) ON DELETE CASCADE;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_status TO authenticated;
GRANT SELECT ON public.candidate_status TO anon;
