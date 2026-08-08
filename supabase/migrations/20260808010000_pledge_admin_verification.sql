-- Admin verification of donations.
--
-- A pledge now carries an admin_verified flag. camp_needs.pledged_qty is the
-- sum of admin-verified pledges only, so unverifying a pledge returns its
-- quantity to "still needed". New pledges default to verified (they count
-- immediately, as before) — an admin unverifies fakes or mistakes.
--
-- Apply with the DIRECT connection (port 5432), not the transaction pooler:
--   psql "$SUPABASE_DB_URL_DIRECT" -f supabase/migrations/20260808010000_pledge_admin_verification.sql
-- Idempotent.

ALTER TABLE public.need_pledges
  ADD COLUMN IF NOT EXISTS admin_verified boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

-- Backs the verified-sum recompute below.
CREATE INDEX IF NOT EXISTS need_pledges_verified_idx
  ON public.need_pledges (need_id) WHERE admin_verified;

-- pledged_qty is now a derived total of admin-verified pledges. Replace the old
-- blind-add trigger with a recompute that runs on any pledge insert/update/delete.
CREATE OR REPLACE FUNCTION public.recompute_need_pledged()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  nid uuid := COALESCE(NEW.need_id, OLD.need_id);
BEGIN
  UPDATE public.camp_needs
     SET pledged_qty = COALESCE(
           (SELECT SUM(quantity) FROM public.need_pledges
             WHERE need_id = nid AND admin_verified), 0),
         updated_at = now()
   WHERE id = nid;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS need_pledges_bump ON public.need_pledges;
DROP TRIGGER IF EXISTS need_pledges_recompute ON public.need_pledges;
CREATE TRIGGER need_pledges_recompute
AFTER INSERT OR UPDATE OR DELETE ON public.need_pledges
FOR EACH ROW EXECUTE FUNCTION public.recompute_need_pledged();

-- Backfill: set every need's pledged_qty from its verified pledges so the column
-- matches the new definition. All existing pledges default to verified.
UPDATE public.camp_needs n
   SET pledged_qty = COALESCE(
         (SELECT SUM(quantity) FROM public.need_pledges p
           WHERE p.need_id = n.id AND p.admin_verified), 0);
