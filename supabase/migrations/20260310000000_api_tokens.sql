-- API tokens: long-lived bearer tokens for programmatic API access.
-- Admins create tokens scoped to their own account; tokens inherit the owner's role.
-- Only the SHA-256 hash is stored — the plaintext token is shown once at creation.

CREATE TABLE IF NOT EXISTS public.api_tokens (
  id            text        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name          text        NOT NULL,
  token_hash    text        NOT NULL UNIQUE,
  token_prefix  text        NOT NULL,  -- first 8 hex chars after 'otk_', for display
  owner_id      uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by_id uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_used_at  timestamptz,
  expires_at    timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_tokens_owner_id     ON public.api_tokens(owner_id);
CREATE INDEX IF NOT EXISTS idx_api_tokens_token_hash   ON public.api_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_api_tokens_created_at   ON public.api_tokens(created_at DESC);
