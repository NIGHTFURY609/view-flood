-- Donations must never exceed what a camp asked for. The pledge path now
-- rejects an over-pledge, but rows created before that guard can already sit
-- above needed_qty (e.g. "9 of 1 kg pledged"). Clamp them so the public and
-- admin views read correctly. Individual need_pledges rows are kept as-is —
-- this only corrects the rolled-up counter on camp_needs.
UPDATE public.camp_needs
   SET pledged_qty = needed_qty,
       updated_at = now()
 WHERE pledged_qty > needed_qty;
