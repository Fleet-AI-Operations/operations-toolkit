-- ============================================================
-- MENTORSHIP PODS
-- One CORE team leader + N QA team members per pod.
-- Used for the mentorship initiative dashboard.
-- ============================================================

CREATE TABLE public.mentorship_pods (
    id           TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
    name         TEXT        NOT NULL,
    core_leader_id UUID      NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT mentorship_pods_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_mentorship_pods_core_leader ON public.mentorship_pods(core_leader_id);

-- ============================================================
-- MENTORSHIP POD MEMBERS
-- QA team members assigned to a pod.
-- ============================================================

CREATE TABLE public.mentorship_pod_members (
    id        TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
    pod_id    TEXT        NOT NULL REFERENCES public.mentorship_pods(id) ON DELETE CASCADE,
    user_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT mentorship_pod_members_pkey PRIMARY KEY (id),
    CONSTRAINT mentorship_pod_members_pod_user_unique UNIQUE (pod_id, user_id)
);

CREATE INDEX idx_mentorship_pod_members_pod  ON public.mentorship_pod_members(pod_id);
CREATE INDEX idx_mentorship_pod_members_user ON public.mentorship_pod_members(user_id);
