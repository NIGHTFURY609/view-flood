-- Kerala Camp Check — admin portal, image moderation, and the indexes the
-- server-side filtering actually needs.
--
-- Apply with the DIRECT connection (port 5432), not the transaction pooler:
--   psql "$SUPABASE_DB_URL_DIRECT" -f supabase/migrations/20260804000000_admin_portal_and_indexes.sql
--
-- The Supabase CLI and MCP cannot reach this project (it is Lovable
-- Cloud-managed and outside this account's organisation), so DDL goes over psql.
-- Every statement is idempotent so a partial run can be repeated safely.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

-- earthdistance gives indexed radius search over the existing numeric lat/lng
-- columns. Chosen over PostGIS deliberately: it needs no geometry column, no
-- backfill and no change to the seeded rows, and duplicate detection only ever
-- asks "anything within 150 m?" — not a general spatial workload.
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------
-- Admin identity
-- ---------------------------------------------------------------------------

-- A valid Supabase JWT proves authentication only. Membership HERE is what
-- grants admin authority, so the two can never be conflated.
CREATE TABLE IF NOT EXISTS public.admin_users (
    id           uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    email        text NOT NULL,
    display_name text,
    role         text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'reviewer')),
    created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_users FROM anon, authenticated;
GRANT ALL ON public.admin_users TO service_role;

-- camps.verified_by was a bare uuid with no referential integrity.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'camps_verified_by_fkey'
    ) THEN
        ALTER TABLE public.camps
            ADD CONSTRAINT camps_verified_by_fkey
            FOREIGN KEY (verified_by) REFERENCES public.admin_users (id) ON DELETE SET NULL;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Image moderation
-- ---------------------------------------------------------------------------

-- In the prototype the "report this photo" button inserted an audit row and did
-- nothing else: report_images.hidden was never set anywhere, and no query ever
-- listed flagged photos. This table gives the flag somewhere to land and a
-- reviewer something to work through.
CREATE TABLE IF NOT EXISTS public.image_flags (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    image_id    uuid NOT NULL REFERENCES public.report_images (id) ON DELETE CASCADE,
    reason      text NOT NULL,
    ip_hash     text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    resolved_by uuid REFERENCES public.admin_users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS image_flags_open_idx
    ON public.image_flags (created_at DESC) WHERE resolved_at IS NULL;

-- One flag per image per network per day: enough to register concern, not
-- enough for one person to bury a legitimate photo.
CREATE UNIQUE INDEX IF NOT EXISTS image_flags_ip_daily_uniq
    ON public.image_flags (
        image_id, ip_hash, ((created_at AT TIME ZONE 'Asia/Kolkata')::date)
    )
    WHERE ip_hash IS NOT NULL;

ALTER TABLE public.image_flags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.image_flags FROM anon, authenticated;
GRANT ALL ON public.image_flags TO service_role;

-- ---------------------------------------------------------------------------
-- Indexes for server-side filtering
--
-- The prototype downloaded up to 3,000 rows and filtered in the browser, so
-- none of these existed. Every one backs a filter the API now runs in SQL.
-- ---------------------------------------------------------------------------

-- Radius search for duplicate detection (150 m) and "camps near me".
CREATE INDEX IF NOT EXISTS camps_earth_idx
    ON public.camps USING gist (ll_to_earth(latitude::float8, longitude::float8))
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Facilities filter, queried with @> (has ALL of these).
CREATE INDEX IF NOT EXISTS camps_amenities_idx
    ON public.camps USING gin (amenities);

-- Free-text search across the name fields and landmark. Trigram rather than
-- tsvector because the queries are substring/fuzzy ("ranni", "GHSS"), not
-- natural language, and trigram serves ILIKE '%…%' directly.
CREATE INDEX IF NOT EXISTS camps_name_trgm_idx
    ON public.camps USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS camps_name_ml_trgm_idx
    ON public.camps USING gin (name_ml gin_trgm_ops);
CREATE INDEX IF NOT EXISTS camps_locality_trgm_idx
    ON public.camps USING gin (village_or_locality gin_trgm_ops);

-- The default list view: district + status + verification, newest first.
CREATE INDEX IF NOT EXISTS camps_filter_idx
    ON public.camps (district_code, verification_state, status, updated_at DESC);

-- "Government list" default: report_count = 0 AND status <> 'active'.
CREATE INDEX IF NOT EXISTS camps_predesignated_idx
    ON public.camps (district_code, updated_at DESC)
    WHERE report_count = 0 AND status <> 'active';

-- Duplicate-detection name shortlist.
CREATE INDEX IF NOT EXISTS camps_lsg_lower_idx
    ON public.camps (district_code, lower(lsg_name));

-- Requirements list, ordered by urgency.
CREATE INDEX IF NOT EXISTS camp_needs_urgency_idx
    ON public.camp_needs (urgency DESC, updated_at DESC);

-- Rate-limit lookups on the OTP table (per phone and per IP, last hour).
CREATE INDEX IF NOT EXISTS otp_ip_recent_idx
    ON public.otp_challenges (ip_hash, created_at DESC);

-- Volume check on report submission (same phone, last 24h).
CREATE INDEX IF NOT EXISTS reports_reporter_recent_idx
    ON public.reports (reporter_phone_primary, submitted_at DESC);

-- Admin queue: unverified camps joined to their reports.
CREATE INDEX IF NOT EXISTS reports_camp_idx
    ON public.reports (camp_id, submitted_at DESC);

-- Audit log viewer, filtered by entity.
CREATE INDEX IF NOT EXISTS audit_log_entity_idx
    ON public.audit_log (entity_type, entity_id, created_at DESC);
