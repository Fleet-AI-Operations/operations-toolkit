-- Add status tracking and claim workflow to similarity_flags
ALTER TABLE public.similarity_flags
  ADD COLUMN status TEXT NOT NULL DEFAULT 'OPEN',
  ADD COLUMN claimed_by_email TEXT,
  ADD COLUMN claimed_at TIMESTAMPTZ;

-- Allow CORE/FLEET/ADMIN/MANAGER roles to update flags (for claiming)
CREATE POLICY "similarity_flags_core_fleet_admin_update"
  ON public.similarity_flags FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND role IN ('CORE', 'FLEET', 'ADMIN', 'MANAGER')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND role IN ('CORE', 'FLEET', 'ADMIN', 'MANAGER')
  ));
