-- Kerala Camp Check — public requirement requests (moderated intake for camp needs).
--
-- Apply with the DIRECT connection (port 5432), not the transaction pooler:
--   psql "$SUPABASE_DB_URL_DIRECT" -f supabase/migrations/20260806000000_camp_requirements.sql
--
-- Idempotent.
--
-- Until now, camp_needs rows only ever arrived via seed migrations. This adds
-- the intake path: anyone on a camp page can submit what that camp needs, it
-- lands here as 'pending', and an admin approving it upserts into camp_needs.
-- Nothing here is public — approval is what makes a requirement visible.

-- ---------------------------------------------------------------------------
-- The submission
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.camp_requirements (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    camp_id         uuid NOT NULL REFERENCES public.camps(id) ON DELETE CASCADE,
    submitter_name  text NOT NULL,
    submitter_phone text NOT NULL,
    note            text,
    -- text + CHECK rather than an enum: CREATE TYPE is not idempotent without a
    -- DO block, and this file has to be safely re-runnable.
    status          text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_at     timestamptz,
    reviewed_by     uuid REFERENCES public.users(id) ON DELETE SET NULL,
    review_note     text,
    ip_hash         text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Its line items
--
-- A child table rather than a JSONB array on the parent: approval upserts each
-- item into camp_needs individually, and the admin queue aggregates across them.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.camp_requirement_items (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    requirement_id uuid NOT NULL REFERENCES public.camp_requirements(id) ON DELETE CASCADE,
    category       text NOT NULL,
    -- A catalogue key (matching camp_needs.item_key), or other_<slug> for a
    -- free-text item the catalogue does not cover.
    item_key       text NOT NULL,
    -- Human label. Required for free-text items, which have no dictionary entry.
    label          text,
    unit           text NOT NULL DEFAULT 'units',
    quantity       integer NOT NULL CHECK (quantity > 0 AND quantity <= 1000000)
);

-- ---------------------------------------------------------------------------
-- Access
--
-- These rows carry submitter PII (phone), so they follow the reports/image_flags
-- lockdown, NOT camp_needs' public-select posture. The API connects as the
-- database owner and bypasses RLS; the pydantic response models are the real
-- exposure boundary.
-- ---------------------------------------------------------------------------

ALTER TABLE public.camp_requirements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.camp_requirements FROM anon, authenticated;
GRANT ALL ON public.camp_requirements TO service_role;

ALTER TABLE public.camp_requirement_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.camp_requirement_items FROM anon, authenticated;
GRANT ALL ON public.camp_requirement_items TO service_role;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- Backs both the pending review queue and the per-camp bubble counters in the
-- admin panel. Partial, because only pending rows are ever counted.
CREATE INDEX IF NOT EXISTS camp_requirements_pending_idx
    ON public.camp_requirements (camp_id, created_at DESC)
    WHERE status = 'pending';

-- The admin list is browsed newest-first across all statuses.
CREATE INDEX IF NOT EXISTS camp_requirements_created_idx
    ON public.camp_requirements (created_at DESC);

-- Abuse windows count by phone over the last 24h.
CREATE INDEX IF NOT EXISTS camp_requirements_phone_idx
    ON public.camp_requirements (submitter_phone, created_at DESC);

CREATE INDEX IF NOT EXISTS camp_requirement_items_req_idx
    ON public.camp_requirement_items (requirement_id);

-- ---------------------------------------------------------------------------
-- updated_at, via the shared trigger function (same as camps / camp_needs)
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS camp_requirements_updated_at ON public.camp_requirements;
CREATE TRIGGER camp_requirements_updated_at BEFORE UPDATE ON public.camp_requirements
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
