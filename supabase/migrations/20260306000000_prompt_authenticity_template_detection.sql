-- Add template detection fields to prompt_authenticity_records
ALTER TABLE public.prompt_authenticity_records
  ADD COLUMN IF NOT EXISTS is_likely_templated BOOLEAN,
  ADD COLUMN IF NOT EXISTS template_confidence DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS template_indicators JSONB,
  ADD COLUMN IF NOT EXISTS detected_template TEXT;

CREATE INDEX IF NOT EXISTS idx_par_is_likely_templated
  ON public.prompt_authenticity_records (is_likely_templated);
