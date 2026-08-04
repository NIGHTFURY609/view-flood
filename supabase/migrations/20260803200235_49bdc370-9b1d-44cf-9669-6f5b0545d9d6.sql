CREATE TABLE public.camp_needs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_id uuid NOT NULL REFERENCES public.camps(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  label text,
  unit text NOT NULL DEFAULT 'units',
  needed_qty integer NOT NULL DEFAULT 0,
  pledged_qty integer NOT NULL DEFAULT 0,
  urgency urgency_level NOT NULL DEFAULT 'normal',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (camp_id, item_key)
);

GRANT SELECT ON public.camp_needs TO anon;
GRANT SELECT ON public.camp_needs TO authenticated;
GRANT ALL ON public.camp_needs TO service_role;

ALTER TABLE public.camp_needs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "camp needs are public" ON public.camp_needs FOR SELECT TO anon, authenticated USING (true);

CREATE INDEX camp_needs_camp_idx ON public.camp_needs(camp_id);

CREATE TRIGGER camp_needs_updated_at BEFORE UPDATE ON public.camp_needs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.need_pledges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  need_id uuid NOT NULL REFERENCES public.camp_needs(id) ON DELETE CASCADE,
  camp_id uuid NOT NULL REFERENCES public.camps(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  donor_name text NOT NULL,
  donor_phone text NOT NULL,
  phone_verified boolean NOT NULL DEFAULT false,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.need_pledges TO service_role;

ALTER TABLE public.need_pledges ENABLE ROW LEVEL SECURITY;

CREATE INDEX need_pledges_need_idx ON public.need_pledges(need_id);

CREATE OR REPLACE FUNCTION public.bump_need_pledge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.camp_needs
     SET pledged_qty = pledged_qty + NEW.quantity,
         updated_at = now()
   WHERE id = NEW.need_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER need_pledges_bump AFTER INSERT ON public.need_pledges
FOR EACH ROW EXECUTE FUNCTION public.bump_need_pledge();