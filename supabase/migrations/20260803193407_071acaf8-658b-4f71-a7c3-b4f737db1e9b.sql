DELETE FROM public.camp_checkins;
UPDATE public.camps SET checkin_count = 0, last_checkin_at = NULL WHERE checkin_count > 0;