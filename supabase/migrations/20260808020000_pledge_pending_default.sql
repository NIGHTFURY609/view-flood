-- New donations now start "pending" (awaiting admin review) instead of being
-- auto-verified. admin_verified becomes nullable:
--   NULL  = pending  (not reviewed, does NOT count toward the camp's needs)
--   true  = verified (admin confirmed, counts)
--   false = unverified (admin reviewed and rejected, does NOT count)
--
-- The recompute trigger already sums only `admin_verified` (IS TRUE), so NULL
-- and false are both excluded from pledged_qty automatically. Existing pledges
-- keep their current true/false value — only new inserts default to NULL.
--
-- Apply with the DIRECT connection (port 5432):
--   psql "$SUPABASE_DB_URL_DIRECT" -f supabase/migrations/20260808020000_pledge_pending_default.sql
-- Idempotent.

ALTER TABLE public.need_pledges ALTER COLUMN admin_verified DROP DEFAULT;
ALTER TABLE public.need_pledges ALTER COLUMN admin_verified DROP NOT NULL;
