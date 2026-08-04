CREATE TABLE public.camp_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_id uuid NOT NULL REFERENCES public.camps(id) ON DELETE CASCADE,
  phone text NOT NULL,
  ip_hash text NOT NULL,
  is_open boolean NOT NULL DEFAULT true,
  note text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  day date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX camp_checkins_phone_uniq ON public.camp_checkins (camp_id, phone, day);
CREATE UNIQUE INDEX camp_checkins_ip_uniq ON public.camp_checkins (camp_id, ip_hash, day);
CREATE INDEX camp_checkins_camp_idx ON public.camp_checkins (camp_id, created_at DESC);

GRANT ALL ON public.camp_checkins TO service_role;
ALTER TABLE public.camp_checkins ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.camps
  ADD COLUMN checkin_count integer NOT NULL DEFAULT 0,
  ADD COLUMN last_checkin_at timestamptz;

CREATE OR REPLACE FUNCTION public.bump_camp_checkin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.camps
     SET checkin_count = checkin_count + 1,
         last_checkin_at = NEW.created_at,
         status_last_confirmed_at = GREATEST(COALESCE(status_last_confirmed_at, NEW.created_at), NEW.created_at)
   WHERE id = NEW.camp_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER camp_checkins_bump
AFTER INSERT ON public.camp_checkins
FOR EACH ROW EXECUTE FUNCTION public.bump_camp_checkin();