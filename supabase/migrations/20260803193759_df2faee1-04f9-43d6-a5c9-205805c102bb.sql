ALTER TABLE public.camp_checkins
  ADD COLUMN IF NOT EXISTS people_count integer,
  ADD COLUMN IF NOT EXISTS family_count integer,
  ADD COLUMN IF NOT EXISTS children_count integer,
  ADD COLUMN IF NOT EXISTS amenities text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.camps
  ADD COLUMN IF NOT EXISTS reported_people_count integer,
  ADD COLUMN IF NOT EXISTS reported_family_count integer,
  ADD COLUMN IF NOT EXISTS reported_children_count integer,
  ADD COLUMN IF NOT EXISTS amenities text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS occupancy_updated_at timestamp with time zone;

CREATE OR REPLACE FUNCTION public.bump_camp_checkin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.camps
     SET checkin_count = checkin_count + 1,
         last_checkin_at = NEW.created_at,
         status_last_confirmed_at = GREATEST(COALESCE(status_last_confirmed_at, NEW.created_at), NEW.created_at),
         reported_people_count = COALESCE(NEW.people_count, reported_people_count),
         reported_family_count = COALESCE(NEW.family_count, reported_family_count),
         reported_children_count = COALESCE(NEW.children_count, reported_children_count),
         amenities = CASE WHEN array_length(NEW.amenities, 1) IS NULL THEN amenities ELSE NEW.amenities END,
         occupancy_updated_at = CASE
           WHEN NEW.people_count IS NOT NULL
             OR NEW.family_count IS NOT NULL
             OR NEW.children_count IS NOT NULL
             OR array_length(NEW.amenities, 1) IS NOT NULL
           THEN NEW.created_at ELSE occupancy_updated_at END
   WHERE id = NEW.camp_id;
  RETURN NEW;
END;
$function$;